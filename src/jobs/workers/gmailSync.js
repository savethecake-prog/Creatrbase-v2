'use strict';

// ─── Gmail sync worker (event-driven) ────────────────────────────────────────
//
// Job types:
//
//   gmail:classify-thread  { threadId, creatorId, tenantId, brandId? }
//     Triggered by the Pub/Sub webhook (or daily fallback) when a new message
//     arrives in a watched thread. Classifies stage, records advance, queues
//     signal, and sends the creator a "brand replied" email when a reply first
//     arrives.
//
//   gmail:renew-watches  {}
//     Runs Mondays at 3am. Gmail watch registrations expire after 7 days.
//     Renews any connection whose watch_expiry is within 2 days.
//
//   gmail:daily-fallback  {}
//     Runs daily at 3am. Light safety net: for every connection with an active
//     history_id checkpoint, calls history.list and queues classify-thread for
//     any matched threads that may have been missed by push. No Claude calls
//     in this job — only classify-thread jobs do LLM work.
//
// The old hourly gmail:check-replies scan has been removed. Claude is now only
// called when a new message actually arrives in a tracked thread.
// ─────────────────────────────────────────────────────────────────────────────

const { Resend }             = require('resend');
const { getPrisma }          = require('../../lib/prisma');
const { decrypt, encrypt }   = require('../../lib/crypto');
const {
  refreshGmailToken,
  getThreadContent,
  getHistorySince,
  setupGmailWatch,
} = require('../../services/gmail');
const { classifyThread }     = require('../../services/threadClassifier');
const { getDataCollectionQueue } = require('../queue');
const { getPool }            = require('../../db/pool');

const APP_URL = process.env.APP_URL || 'https://creatrbase.com';

// Terminal states after which we stop watching the thread
const TERMINAL_STAGES = new Set(['deal_completed', 'deal_declined', 'outreach_declined']);

// ─── Shared helpers ───────────────────────────────────────────────────────────

function getResend() {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY not set');
  return new Resend(process.env.RESEND_API_KEY);
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function emailWrapper(subject, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#05040A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td align="center" style="padding:32px 16px">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%">
        <tr><td style="padding:0 0 24px">
          <p style="margin:0;font-size:22px;font-weight:900;color:#9EFFD8;letter-spacing:-0.02em">creatrbase</p>
        </td></tr>
        ${bodyHtml}
        <tr><td style="padding:24px 0 0">
          <p style="margin:0;font-size:12px;color:#4A4860;text-align:center">
            You're receiving this from Creatrbase. <a href="${APP_URL}/connections" style="color:#4A4860">Manage preferences</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function card(html) {
  return `<tr><td style="padding:0 0 16px">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
      style="background:#111019;border:1px solid rgba(255,255,255,0.08);border-radius:16px">
      <tr><td style="padding:24px 32px">${html}</td></tr>
    </table>
  </td></tr>`;
}

function ctaButton(text, href) {
  return `<a href="${href}" style="display:inline-block;background:#9EFFD8;color:#05040A;font-size:13px;font-weight:700;padding:10px 22px;border-radius:999px;text-decoration:none">${escHtml(text)}</a>`;
}

async function getTokenForConnection(prisma, conn) {
  const bufferMs     = 5 * 60 * 1000;
  const tokenExpires = conn.tokenExpiresAt ?? conn.token_expires_at;
  const expiresDate  = tokenExpires ? new Date(tokenExpires) : null;
  const needsRefresh = expiresDate && (expiresDate.getTime() - Date.now() < bufferMs);
  const storedRefresh = conn.refreshToken ?? conn.refresh_token;

  if (!needsRefresh) return decrypt(conn.accessToken ?? conn.access_token);
  if (!storedRefresh) return null;

  const refreshed = await refreshGmailToken(decrypt(storedRefresh));
  await prisma.gmailConnection.update({
    where: { id: conn.id },
    data:  { accessToken: encrypt(refreshed.accessToken), tokenExpiresAt: refreshed.expiresAt },
  });
  return refreshed.accessToken;
}

// ─── Brand-replied email ──────────────────────────────────────────────────────

async function sendBrandRepliedEmail(prisma, resend, creatorId, brandName) {
  const creator = await prisma.creator.findUnique({
    where:  { id: creatorId },
    select: { displayName: true, user: { select: { email: true } } },
  });
  if (!creator?.user?.email) return;

  const subject = `${brandName} replied to your outreach`;
  const body = card(`
    <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#7B7A8E">NEW REPLY</p>
    <p style="margin:0 0 8px;font-size:20px;font-weight:800;color:#F5F4FF">${escHtml(brandName)} replied to your outreach</p>
    <p style="margin:0 0 16px;font-size:14px;color:#9B99B0;line-height:1.6">
      A brand you reached out to has responded. Check your inbox and keep the momentum going.
    </p>
    ${ctaButton('View in Outreach →', `${APP_URL}/outreach`)}
  `);

  await resend.emails.send({
    from:    'Creatrbase <notifications@dashboard.creatrbase.com>',
    to:      creator.user.email,
    subject,
    html:    emailWrapper(subject, body),
  });
}

// ─────────────────────────────────────────────────────────────────────────────

function startGmailSyncWorker() {
  const queue  = getDataCollectionQueue();
  const prisma = getPrisma();
  const pool   = getPool();

  // ── gmail:classify-thread ─────────────────────────────────────────────────
  // Classifies a single tracked thread. Triggered by push webhook or daily fallback.

  queue.process('gmail:classify-thread', async (job) => {
    const { threadId, creatorId, tenantId } = job.data;
    if (!threadId || !creatorId) throw new Error('gmail:classify-thread missing threadId or creatorId');

    // Load the most recent tracked interaction for this thread
    const { rows } = await pool.query(`
      SELECT DISTINCT ON (bci.creator_id, bci.brand_id)
        bci.id,
        bci.creator_id,
        bci.brand_id,
        bci.tenant_id,
        bci.gmail_thread_id,
        bci.interaction_type AS current_stage,
        bci.niche,
        bci.created_by,
        b.brand_name
      FROM brand_creator_interactions bci
      JOIN brands b ON b.id = bci.brand_id
      WHERE bci.creator_id = $1
        AND bci.gmail_thread_id = $2
      ORDER BY bci.creator_id, bci.brand_id, bci.created_at DESC
    `, [creatorId, threadId]);

    if (rows.length === 0) {
      job.log(`Thread ${threadId}: no matching interaction found — skipping`);
      return;
    }
    const row = rows[0];

    // Skip if already terminal
    if (TERMINAL_STAGES.has(row.current_stage)) {
      job.log(`Thread ${threadId}: already in terminal state ${row.current_stage}`);
      return;
    }

    const conn = await prisma.gmailConnection.findUnique({ where: { creatorId } });
    if (!conn) {
      job.log(`No Gmail connection for creator ${creatorId} — skipping`);
      return;
    }

    let accessToken;
    try {
      accessToken = await getTokenForConnection(prisma, conn);
    } catch (err) {
      job.log(`Token refresh failed for creator ${creatorId}: ${err.message}`);
      return;
    }
    if (!accessToken) {
      job.log(`No valid token for creator ${creatorId} — skipping`);
      return;
    }

    const { messages } = await getThreadContent(accessToken, threadId);
    if (messages.length === 0) {
      job.log(`Thread ${threadId}: empty or deleted`);
      return;
    }

    const result = await classifyThread({
      messages,
      brandName:              row.brand_name,
      creatorEmail:           conn.gmailAddress,
      currentInteractionType: row.current_stage,
    });

    if (!result) {
      job.log(`Thread ${threadId}: no stage change (${row.current_stage} holds)`);
      return;
    }

    if (result.confidence < 0.75) {
      job.log(`Thread ${threadId}: low confidence ${result.confidence} for ${result.interactionType} — skipping`);
      return;
    }

    // Build deal notes
    const evidenceStr = result.evidence?.join('; ') ?? '';
    const dealNotes   = result.stale_context
      ? result.stale_context
      : `Auto-detected: ${result.interactionType}${evidenceStr ? '. ' + evidenceStr : ''}.`.slice(0, 500);

    // Insert new interaction row
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
        result.detected_rate     ? Math.round(result.detected_rate * 100) : null,
        result.detected_currency ?? null,
        dealNotes,
        row.created_by,
      ]
    );
    const newInteractionId = newRows[0].id;

    // Queue signal
    await queue.add('signals:ingest', {
      signalType:          result.signalType,
      sourceFeature:       'gmail_sync',
      sourceInteractionId: newInteractionId,
      creatorId:           row.creator_id,
      tenantId:            row.tenant_id,
    });

    // Send "brand replied" notification email on first reply
    if (result.signalType === 'brand_replied') {
      try {
        const resend = getResend();
        await sendBrandRepliedEmail(prisma, resend, row.creator_id, row.brand_name);
      } catch (err) {
        job.log(`Brand-replied email failed (non-fatal): ${err.message}`);
      }
    }

    job.log(`Stage advance: ${row.current_stage} → ${result.interactionType} (${result.confidence})`);
    console.log(`[gmailSync] classify-thread: creator=${creatorId} brand=${row.brand_id} → ${result.interactionType}`);

    // Clear thread watch on terminal states
    if (TERMINAL_STAGES.has(result.interactionType)) {
      await pool.query(
        `UPDATE brand_creator_interactions
         SET gmail_thread_id = NULL
         WHERE creator_id = $1 AND brand_id = $2 AND gmail_thread_id IS NOT NULL`,
        [row.creator_id, row.brand_id]
      );
      job.log(`Thread watch cleared (terminal state: ${result.interactionType})`);
    }
  });

  // ── gmail:renew-watches ───────────────────────────────────────────────────
  // Renew Gmail push watches that are about to expire (< 2 days remaining).
  // Runs Mondays 3am.

  queue.process('gmail:renew-watches', async (job) => {
    if (!process.env.GMAIL_PUBSUB_TOPIC) {
      job.log('GMAIL_PUBSUB_TOPIC not set — skipping watch renewal');
      return;
    }

    const { rows } = await pool.query(`
      SELECT id, creator_id, access_token, refresh_token, token_expires_at
      FROM gmail_connections
      WHERE watch_expiry IS NOT NULL
        AND watch_expiry < NOW() + INTERVAL '2 days'
        AND refresh_token IS NOT NULL
    `);

    job.log(`Renewing ${rows.length} expiring Gmail watch(es)`);

    for (const conn of rows) {
      try {
        let accessToken;
        const bufferMs     = 5 * 60 * 1000;
        const tokenExpires = conn.token_expires_at ? new Date(conn.token_expires_at) : null;
        const needsRefresh = tokenExpires && (tokenExpires.getTime() - Date.now() < bufferMs);

        if (needsRefresh) {
          const refreshed = await refreshGmailToken(decrypt(conn.refresh_token));
          await prisma.gmailConnection.update({
            where: { id: conn.id },
            data:  { accessToken: encrypt(refreshed.accessToken), tokenExpiresAt: refreshed.expiresAt },
          });
          accessToken = refreshed.accessToken;
        } else {
          accessToken = decrypt(conn.access_token);
        }

        const watch = await setupGmailWatch(accessToken, process.env.GMAIL_PUBSUB_TOPIC);
        await pool.query(
          `UPDATE gmail_connections SET history_id = $1, watch_expiry = $2 WHERE id = $3`,
          [watch.historyId, watch.expiration, conn.id]
        );
        job.log(`Renewed watch for creator ${conn.creator_id} (expires ${watch.expiration.toISOString()})`);
      } catch (err) {
        job.log(`Watch renewal failed for creator ${conn.creator_id}: ${err.message}`);
        console.error(`[gmailSync] watch renewal error: ${err.message}`);
      }
    }
  });

  // ── gmail:daily-fallback ──────────────────────────────────────────────────
  // Safety net: scan history for all active connections and queue any missed
  // classify-thread jobs. No LLM calls here — only queue dispatch.
  // Runs daily at 3am.

  queue.process('gmail:daily-fallback', async (job) => {
    const { rows: conns } = await pool.query(`
      SELECT id, creator_id, tenant_id, history_id,
             access_token, refresh_token, token_expires_at
      FROM gmail_connections
      WHERE history_id IS NOT NULL
    `);

    if (conns.length === 0) {
      job.log('No connections with active history_id — nothing to scan');
      return;
    }

    job.log(`Daily fallback: scanning ${conns.length} connection(s)`);
    let totalQueued = 0;

    for (const conn of conns) {
      try {
        let accessToken;
        const bufferMs     = 5 * 60 * 1000;
        const tokenExpires = conn.token_expires_at ? new Date(conn.token_expires_at) : null;
        const needsRefresh = tokenExpires && (tokenExpires.getTime() - Date.now() < bufferMs);

        if (needsRefresh && conn.refresh_token) {
          const refreshed = await refreshGmailToken(decrypt(conn.refresh_token));
          await prisma.gmailConnection.update({
            where: { id: conn.id },
            data:  { accessToken: encrypt(refreshed.accessToken), tokenExpiresAt: refreshed.expiresAt },
          });
          accessToken = refreshed.accessToken;
        } else {
          accessToken = decrypt(conn.access_token);
        }

        let messages, nextHistoryId;
        try {
          ({ messages, nextHistoryId } = await getHistorySince(accessToken, conn.history_id));
        } catch (err) {
          if (err.message.includes('410')) {
            await pool.query(
              `UPDATE gmail_connections SET history_id = NULL, watch_expiry = NULL WHERE id = $1`,
              [conn.id]
            );
            job.log(`Creator ${conn.creator_id}: history expired — watch cleared`);
          } else {
            job.log(`Creator ${conn.creator_id}: history fetch error — ${err.message}`);
          }
          continue;
        }

        if (messages.length > 0) {
          const newThreadIds = [...new Set(messages.map(m => m.threadId))];
          const placeholders = newThreadIds.map((_, i) => `$${i + 2}`).join(', ');
          const { rows: matched } = await pool.query(
            `SELECT DISTINCT ON (bci.creator_id, bci.brand_id)
               bci.creator_id, bci.tenant_id, bci.gmail_thread_id, bci.brand_id
             FROM brand_creator_interactions bci
             WHERE bci.creator_id = $1
               AND bci.gmail_thread_id IN (${placeholders})
             ORDER BY bci.creator_id, bci.brand_id, bci.created_at DESC`,
            [conn.creator_id, ...newThreadIds]
          );

          for (const thread of matched) {
            await queue.add('gmail:classify-thread', {
              threadId:  thread.gmail_thread_id,
              creatorId: thread.creator_id,
              tenantId:  thread.tenant_id,
              brandId:   thread.brand_id,
            });
            totalQueued++;
          }
        }

        await pool.query(
          `UPDATE gmail_connections SET history_id = $1 WHERE id = $2`,
          [nextHistoryId, conn.id]
        );

      } catch (err) {
        job.log(`Creator ${conn.creator_id}: fallback error — ${err.message}`);
        console.error(`[gmailSync] daily-fallback error: ${err.message}`);
      }
    }

    job.log(`Daily fallback complete — queued ${totalQueued} classify-thread job(s)`);
    console.log(`[gmailSync] daily-fallback: ${totalQueued} classify-thread jobs queued`);
  });

  // ── Cron schedules ────────────────────────────────────────────────────────

  queue.add('gmail:renew-watches', {}, {
    repeat:           { cron: '0 3 * * 1' }, // Mondays 3am
    removeOnComplete: 3,
    removeOnFail:     5,
  });

  queue.add('gmail:daily-fallback', {}, {
    repeat:           { cron: '0 3 * * *' }, // Daily 3am
    removeOnComplete: 3,
    removeOnFail:     5,
  });

  console.log('[gmailSync] worker registered — event-driven (push webhook + daily fallback)');
}

module.exports = { startGmailSyncWorker };
