'use strict';

// ─── Gmail thread classifier worker ──────────────────────────────────────────
// Job type: gmail:check-replies  {}
//
// Runs hourly. For every active Gmail thread (gmail_thread_id IS NOT NULL):
//   - Fetches full thread content
//   - Classifies current deal stage using Claude
//   - If stage has advanced (or gone stale/declined): logs the new interaction
//     and queues the appropriate signal
//   - Clears gmail_thread_id only on terminal states (won/declined)
//   - Stale threads remain watched — deals can re-engage
// ─────────────────────────────────────────────────────────────────────────────

const { getPrisma }              = require('../../lib/prisma');
const { decrypt, encrypt }       = require('../../lib/crypto');
const { refreshGmailToken, getThreadContent } = require('../../services/gmail');
const { classifyThread }         = require('../../services/threadClassifier');
const { getDataCollectionQueue } = require('../queue');
const { getPool }                = require('../../db/pool');

// Terminal states after which we stop watching the thread
const TERMINAL_STAGES = new Set(['deal_completed', 'deal_declined', 'outreach_declined']);

async function getFreshToken(prisma, creatorId) {
  const conn = await prisma.gmailConnection.findUnique({
    where: { creatorId },
  });
  if (!conn) return { accessToken: null, gmailAddress: null };

  const bufferMs     = 5 * 60 * 1000;
  const needsRefresh = conn.tokenExpiresAt &&
    (conn.tokenExpiresAt.getTime() - Date.now() < bufferMs);

  if (!needsRefresh) return { accessToken: decrypt(conn.accessToken), gmailAddress: conn.gmailAddress };

  if (!conn.refreshToken) return { accessToken: null, gmailAddress: conn.gmailAddress };

  const refreshed = await refreshGmailToken(decrypt(conn.refreshToken));
  await prisma.gmailConnection.update({
    where: { id: conn.id },
    data:  {
      accessToken:    encrypt(refreshed.accessToken),
      tokenExpiresAt: refreshed.expiresAt,
    },
  });
  return { accessToken: refreshed.accessToken, gmailAddress: conn.gmailAddress };
}

function startGmailSyncWorker() {
  const queue  = getDataCollectionQueue();
  const prisma = getPrisma();
  const pool   = getPool();

  queue.process('gmail:check-replies', async (job) => {
    // Get all watched threads — newest interaction per creator+brand pair.
    // Includes the brand name and creator's gmail address for the classifier.
    const { rows: watchRows } = await pool.query(`
      SELECT DISTINCT ON (bci.creator_id, bci.brand_id)
        bci.id,
        bci.creator_id,
        bci.brand_id,
        bci.tenant_id,
        bci.gmail_thread_id,
        bci.interaction_type  AS current_stage,
        bci.niche,
        bci.created_by,
        b.brand_name
      FROM brand_creator_interactions bci
      JOIN brands b ON b.id = bci.brand_id
      WHERE bci.gmail_thread_id IS NOT NULL
      ORDER BY bci.creator_id, bci.brand_id, bci.created_at DESC
    `);

    if (watchRows.length === 0) {
      job.log('No active Gmail threads to classify');
      return;
    }

    job.log(`Classifying ${watchRows.length} Gmail thread(s)`);

    for (const row of watchRows) {
      try {
        const { accessToken, gmailAddress } = await getFreshToken(prisma, row.creator_id);
        if (!accessToken || !gmailAddress) {
          job.log(`No valid Gmail token for creator ${row.creator_id} — skipping`);
          continue;
        }

        const { messages } = await getThreadContent(accessToken, row.gmail_thread_id);

        if (messages.length === 0) {
          job.log(`Thread ${row.gmail_thread_id}: empty or deleted`);
          continue;
        }

        // Only classify if there's more than just the creator's outreach (i.e. at least one reply)
        const hasAnyReply = messages.length > 1;
        const currentStageIsStale = row.current_stage === 'stale';
        const shouldCheckStaleness = messages.length >= 1; // always check staleness even with no reply

        if (!hasAnyReply && !shouldCheckStaleness) {
          job.log(`Thread ${row.gmail_thread_id}: no reply yet`);
          continue;
        }

        const result = await classifyThread({
          messages,
          brandName:            row.brand_name,
          creatorEmail:         gmailAddress,
          currentInteractionType: row.current_stage,
        });

        if (!result) {
          job.log(`Thread ${row.gmail_thread_id}: no stage change (${row.current_stage} holds)`);
          continue;
        }

        if (result.confidence < 0.75) {
          job.log(`Thread ${row.gmail_thread_id}: low confidence ${result.confidence} for ${result.interactionType} — skipping auto-advance`);
          continue;
        }

        // Build notes: evidence array + stale context if applicable
        const evidenceStr = result.evidence?.join('; ') ?? '';
        const dealNotes   = result.stale_context
          ? result.stale_context
          : `Auto-detected: ${result.interactionType}${evidenceStr ? '. ' + evidenceStr : ''}.`.slice(0, 500);

        // Insert the new interaction
        const { rows: newRows } = await pool.query(
          `INSERT INTO brand_creator_interactions
             (brand_id, creator_id, tenant_id, niche, geo, interaction_type,
              interaction_date, agreed_rate, rate_currency,
              evidence_type, confidence, deal_notes, is_public, created_by)
           VALUES ($1, $2, $3, $4, 'global', $5,
                   CURRENT_DATE, $6, $7,
                   'auto_detected', 'high', $8, FALSE, $9)
           RETURNING id`,
          [
            row.brand_id,
            row.creator_id,
            row.tenant_id,
            row.niche ?? 'general',
            result.interactionType,
            result.detected_rate    ? Math.round(result.detected_rate * 100) : null,
            result.detected_currency ?? null,
            dealNotes,
            row.created_by,
          ]
        );

        const newInteractionId = newRows[0].id;

        // Queue the appropriate signal
        await queue.add('signals:ingest', {
          signalType:          result.signalType,
          sourceFeature:       'gmail_sync',
          sourceInteractionId: newInteractionId,
          creatorId:           row.creator_id,
          tenantId:            row.tenant_id,
        });

        job.log(`Stage advance: creator=${row.creator_id} brand=${row.brand_id} ${row.current_stage} → ${result.interactionType} (confidence=${result.confidence})`);
        console.log(`[gmailSync] stage advance: creator=${row.creator_id} brand=${row.brand_id} → ${result.interactionType}`);

        // Clear thread watch on terminal states (won / declined)
        // Stale threads remain watched — deals can re-engage
        if (TERMINAL_STAGES.has(result.interactionType)) {
          await pool.query(
            `UPDATE brand_creator_interactions
             SET gmail_thread_id = NULL
             WHERE creator_id = $1 AND brand_id = $2 AND gmail_thread_id IS NOT NULL`,
            [row.creator_id, row.brand_id]
          );
          job.log(`Thread watch cleared (terminal state: ${result.interactionType})`);
        }

      } catch (err) {
        // Non-fatal — log and continue to next thread
        job.log(`Error classifying thread ${row.gmail_thread_id}: ${err.message}`);
        console.error(`[gmailSync] classification error: ${err.message}`);
      }
    }
  });

  queue.add('gmail:check-replies', {}, {
    repeat:           { cron: '0 * * * *' },
    removeOnComplete: 5,
    removeOnFail:     10,
  });

  console.log('[gmailSync] worker registered — hourly thread classification scheduled');
}

module.exports = { startGmailSyncWorker };
