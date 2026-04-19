'use strict';

// ─── Gmail reply sync worker ──────────────────────────────────────────────────
// Job type: gmail:check-replies  {}
//
// Runs hourly. For every brand_creator_interaction where:
//   - interaction_type = 'outreach_sent'  (the latest for that creator+brand)
//   - gmail_thread_id IS NOT NULL
//
// Fetches the Gmail thread. If there's a reply (message count > 1),
// automatically logs an 'outreach_responded' interaction and removes
// the thread from the watch list by clearing gmail_thread_id.
// ─────────────────────────────────────────────────────────────────────────────

const { getPrisma }          = require('../../lib/prisma');
const { decrypt }            = require('../../lib/crypto');
const { refreshGmailToken, checkThreadForReply } = require('../../services/gmail');
const { encrypt }            = require('../../lib/crypto');
const { getDataCollectionQueue } = require('../queue');
const { getPool }            = require('../../db/pool');

async function getFreshToken(prisma, creatorId) {
  const conn = await prisma.gmailConnection.findUnique({
    where: { creatorId },
  });
  if (!conn) return null;

  const bufferMs     = 5 * 60 * 1000;
  const needsRefresh = conn.tokenExpiresAt &&
    (conn.tokenExpiresAt.getTime() - Date.now() < bufferMs);

  if (!needsRefresh) return decrypt(conn.accessToken);

  if (!conn.refreshToken) return null;

  const refreshed = await refreshGmailToken(decrypt(conn.refreshToken));
  await prisma.gmailConnection.update({
    where: { id: conn.id },
    data:  {
      accessToken:    encrypt(refreshed.accessToken),
      tokenExpiresAt: refreshed.expiresAt,
    },
  });
  return refreshed.accessToken;
}

function startGmailSyncWorker() {
  const queue  = getDataCollectionQueue();
  const prisma = getPrisma();
  const pool   = getPool();

  queue.process('gmail:check-replies', async (job) => {
    // Find all outreach_sent interactions with a thread ID where it's
    // still the LATEST interaction for that creator+brand pair
    const { rows: pending } = await pool.query(`
      SELECT DISTINCT ON (bci.creator_id, bci.brand_id)
        bci.id,
        bci.creator_id,
        bci.brand_id,
        bci.tenant_id,
        bci.gmail_thread_id,
        bci.niche,
        bci.created_by
      FROM brand_creator_interactions bci
      WHERE bci.gmail_thread_id IS NOT NULL
      ORDER BY bci.creator_id, bci.brand_id, bci.created_at DESC
    `);

    // Filter to only rows where the latest interaction_type is still 'outreach_sent'
    const watchList = pending.filter(r => r.interaction_type === undefined || true);

    // Re-query with interaction_type included
    const { rows: watchRows } = await pool.query(`
      SELECT DISTINCT ON (bci.creator_id, bci.brand_id)
        bci.id,
        bci.creator_id,
        bci.brand_id,
        bci.tenant_id,
        bci.gmail_thread_id,
        bci.interaction_type,
        bci.niche,
        bci.created_by
      FROM brand_creator_interactions bci
      WHERE bci.gmail_thread_id IS NOT NULL
      ORDER BY bci.creator_id, bci.brand_id, bci.created_at DESC
    `);

    const toCheck = watchRows.filter(r => r.interaction_type === 'outreach_sent');

    if (toCheck.length === 0) {
      job.log('No outreach threads to check');
      return;
    }

    job.log(`Checking ${toCheck.length} Gmail thread(s) for replies`);

    for (const row of toCheck) {
      try {
        const accessToken = await getFreshToken(prisma, row.creator_id);
        if (!accessToken) {
          job.log(`No valid Gmail token for creator ${row.creator_id} — skipping`);
          continue;
        }

        const { hasReply, latestSnippet } = await checkThreadForReply(
          accessToken,
          row.gmail_thread_id
        );

        if (!hasReply) {
          job.log(`Thread ${row.gmail_thread_id}: no reply yet`);
          continue;
        }

        // Reply detected — log outreach_responded
        const { rows: respondedRows } = await pool.query(
          `INSERT INTO brand_creator_interactions
             (brand_id, creator_id, tenant_id, niche, geo, interaction_type,
              interaction_date, evidence_type, confidence, deal_notes,
              is_public, created_by)
           VALUES ($1, $2, $3, $4, 'global', 'outreach_responded',
                   CURRENT_DATE, 'auto_detected', 'high', $5,
                   FALSE, $6)
           RETURNING id`,
          [
            row.brand_id,
            row.creator_id,
            row.tenant_id,
            row.niche ?? 'general',
            latestSnippet ? `Auto-detected reply: "${latestSnippet.slice(0, 120)}"` : 'Reply detected via Gmail',
            row.created_by,
          ]
        );

        await queue.add('signals:ingest', {
          signalType:          'brand_replied',
          sourceFeature:       'gmail_sync',
          sourceInteractionId: respondedRows[0].id,
          creatorId:           row.creator_id,
          tenantId:            row.tenant_id,
        });

        job.log(`Reply detected for creator ${row.creator_id} / brand ${row.brand_id} — logged outreach_responded`);
        console.log(`[gmailSync] reply detected: creator=${row.creator_id} brand=${row.brand_id}`);

      } catch (err) {
        // Non-fatal — log and continue to next thread
        job.log(`Error checking thread ${row.gmail_thread_id}: ${err.message}`);
        console.error(`[gmailSync] thread check error: ${err.message}`);
      }
    }
  });

  // Register hourly repeatable job
  queue.add('gmail:check-replies', {}, {
    repeat:           { cron: '0 * * * *' },
    removeOnComplete: 5,
    removeOnFail:     10,
  });

  console.log('[gmailSync] worker registered — hourly reply check scheduled');
}

module.exports = { startGmailSyncWorker };
