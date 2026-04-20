'use strict';

// ─── Gmail Pub/Sub push webhook ───────────────────────────────────────────────
//
//   POST /api/webhooks/gmail?token=<PUBSUB_WEBHOOK_TOKEN>
//
// Google Cloud Pub/Sub pushes a notification here whenever a new message arrives
// in a watched Gmail inbox. The payload is a base64-encoded JSON string:
//   { emailAddress: string, historyId: string }
//
// Flow:
//   1. Verify the shared token in the query string
//   2. Decode the Pub/Sub data envelope
//   3. Find the creator by Gmail address
//   4. Fetch new messages since the stored historyId checkpoint
//   5. For each new message whose threadId is tracked in brand_creator_interactions,
//      queue gmail:classify-thread
//   6. Advance the history_id checkpoint
//
// Always returns 2xx so Pub/Sub acknowledges and does not retry unnecessarily.
// ─────────────────────────────────────────────────────────────────────────────

const { getPrisma }             = require('../../lib/prisma');
const { getPool }               = require('../../db/pool');
const { decrypt, encrypt }      = require('../../lib/crypto');
const { refreshGmailToken, getHistorySince } = require('../../services/gmail');
const { getDataCollectionQueue } = require('../../jobs/queue');

async function gmailWebhookRoutes(app) {

  app.post('/api/webhooks/gmail', async (req, reply) => {

    // ── 1. Verify shared secret ───────────────────────────────────────────────

    const expectedToken = process.env.PUBSUB_WEBHOOK_TOKEN;
    if (!expectedToken || req.query.token !== expectedToken) {
      app.log.warn('Gmail webhook: invalid or missing token');
      return reply.code(401).send({ error: 'Unauthorised' });
    }

    // ── 2. Decode Pub/Sub envelope ────────────────────────────────────────────

    let emailAddress, incomingHistoryId;
    try {
      const rawData = req.body?.message?.data;
      if (!rawData) return reply.code(200).send({ ok: true }); // empty ping — ack
      const decoded = JSON.parse(Buffer.from(rawData, 'base64').toString('utf-8'));
      emailAddress      = decoded.emailAddress;
      incomingHistoryId = decoded.historyId ? String(decoded.historyId) : null;
    } catch (err) {
      app.log.warn({ err }, 'Gmail webhook: malformed Pub/Sub payload');
      return reply.code(200).send({ ok: true }); // ack to prevent infinite retry
    }

    if (!emailAddress) return reply.code(200).send({ ok: true });

    // ── 3. Ack immediately — Pub/Sub retries if we take > 600s ───────────────

    reply.code(200).send({ ok: true });

    // ── 4. Process asynchronously after responding ────────────────────────────

    setImmediate(async () => {
      try {
        const pool   = getPool();
        const prisma = getPrisma();
        const queue  = getDataCollectionQueue();

        // Find the creator's Gmail connection
        const { rows: connRows } = await pool.query(
          `SELECT gc.id, gc.creator_id, gc.tenant_id, gc.history_id,
                  gc.access_token, gc.refresh_token, gc.token_expires_at
           FROM gmail_connections gc
           WHERE gc.gmail_address = $1
           LIMIT 1`,
          [emailAddress]
        );
        if (connRows.length === 0) {
          // ── Admin Gmail branch ─────────────────────────────────────────────
          const { rows: adminRows } = await pool.query(
            'SELECT id, access_token, refresh_token, token_expires_at, history_id FROM admin_gmail_connections WHERE gmail_address = $1 LIMIT 1',
            [emailAddress]
          );
          if (adminRows.length === 0) {
            app.log.warn({ emailAddress }, 'Gmail webhook: no connection found for address');
            return;
          }
          const adminConn = adminRows[0];

          // Get fresh token for admin
          let adminToken;
          const aBufferMs     = 5 * 60 * 1000;
          const aTokenExpires = adminConn.token_expires_at ? new Date(adminConn.token_expires_at) : null;
          const aNeedsRefresh = aTokenExpires && (aTokenExpires.getTime() - Date.now() < aBufferMs);

          if (aNeedsRefresh && adminConn.refresh_token) {
            const refreshed = await refreshGmailToken(decrypt(adminConn.refresh_token));
            await pool.query(
              `UPDATE admin_gmail_connections SET access_token = $1, token_expires_at = $2, updated_at = NOW() WHERE id = $3`,
              [encrypt(refreshed.accessToken), refreshed.expiresAt, adminConn.id]
            );
            adminToken = refreshed.accessToken;
          } else {
            adminToken = decrypt(adminConn.access_token);
          }

          const storedAdminHistoryId = adminConn.history_id;
          if (!storedAdminHistoryId) {
            await pool.query(
              `UPDATE admin_gmail_connections SET history_id = $1 WHERE id = $2`,
              [incomingHistoryId, adminConn.id]
            );
            return;
          }

          let adminMessages, adminNextHistoryId;
          try {
            ({ messages: adminMessages, nextHistoryId: adminNextHistoryId } =
              await getHistorySince(adminToken, storedAdminHistoryId));
          } catch (err) {
            if (err.message.includes('410')) {
              await pool.query(
                `UPDATE admin_gmail_connections SET history_id = NULL, watch_expiry = NULL WHERE id = $1`,
                [adminConn.id]
              );
              app.log.warn('Admin Gmail history expired (410) — watch cleared');
            } else {
              app.log.error({ err }, 'Admin Gmail history fetch error');
            }
            return;
          }

          if (adminMessages.length > 0) {
            const newThreadIds = [...new Set(adminMessages.map(m => m.threadId))];
            const placeholders = newThreadIds.map((_, i) => `$${i + 1}`).join(', ');
            const { rows: matchedProspects } = await pool.query(
              `SELECT id, stage FROM creator_prospects WHERE gmail_thread_id IN (${placeholders})`,
              newThreadIds
            );

            for (const prospect of matchedProspects) {
              if (prospect.stage === 'responded' || prospect.stage === 'signed_up' || prospect.stage === 'active') continue;
              await pool.query(
                `INSERT INTO prospect_events (prospect_id, admin_id, event_type, channel, note)
                 VALUES ($1, NULL, 'reply_received', 'email', 'Reply detected via Gmail push')`,
                [prospect.id]
              );
              await pool.query(
                `UPDATE creator_prospects SET stage = 'responded', updated_at = NOW() WHERE id = $1`,
                [prospect.id]
              );
              app.log.info({ prospectId: prospect.id }, 'Prospect reply detected — stage advanced to responded');
            }
          }

          await pool.query(
            `UPDATE admin_gmail_connections SET history_id = $1 WHERE id = $2`,
            [adminNextHistoryId, adminConn.id]
          );
          return;
        }
        const conn = connRows[0];

        // ── 5. Get fresh access token ─────────────────────────────────────────

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

        // ── 6. Fetch new messages since stored checkpoint ─────────────────────

        const storedHistoryId = conn.history_id;
        if (!storedHistoryId) {
          // No checkpoint yet — store the incoming historyId and wait for next push
          await pool.query(
            `UPDATE gmail_connections SET history_id = $1 WHERE id = $2`,
            [incomingHistoryId, conn.id]
          );
          return;
        }

        let messages, nextHistoryId;
        try {
          ({ messages, nextHistoryId } = await getHistorySince(accessToken, storedHistoryId));
        } catch (err) {
          if (err.message.includes('410')) {
            // History expired — clear checkpoint so the daily fallback re-watches
            await pool.query(
              `UPDATE gmail_connections SET history_id = NULL, watch_expiry = NULL WHERE id = $1`,
              [conn.id]
            );
            app.log.warn({ creatorId: conn.creator_id }, 'Gmail history expired (410) — watch cleared');
          } else {
            app.log.error({ err, creatorId: conn.creator_id }, 'Gmail history fetch error');
          }
          return;
        }

        if (messages.length === 0) {
          // Advance checkpoint even if no matching threads
          await pool.query(
            `UPDATE gmail_connections SET history_id = $1 WHERE id = $2`,
            [nextHistoryId, conn.id]
          );
          return;
        }

        // ── 7. Match new message threadIds against tracked interactions ────────

        const newThreadIds = [...new Set(messages.map(m => m.threadId))];
        const placeholders = newThreadIds.map((_, i) => `$${i + 2}`).join(', ');
        const { rows: matchedThreads } = await pool.query(
          `SELECT DISTINCT ON (bci.creator_id, bci.brand_id)
             bci.creator_id, bci.brand_id, bci.tenant_id, bci.gmail_thread_id
           FROM brand_creator_interactions bci
           WHERE bci.creator_id = $1
             AND bci.gmail_thread_id IN (${placeholders})
           ORDER BY bci.creator_id, bci.brand_id, bci.created_at DESC`,
          [conn.creator_id, ...newThreadIds]
        );

        for (const thread of matchedThreads) {
          await queue.add('gmail:classify-thread', {
            threadId:  thread.gmail_thread_id,
            creatorId: thread.creator_id,
            tenantId:  thread.tenant_id,
            brandId:   thread.brand_id,
          });
        }

        // ── 8. Advance the checkpoint ─────────────────────────────────────────

        await pool.query(
          `UPDATE gmail_connections SET history_id = $1 WHERE id = $2`,
          [nextHistoryId, conn.id]
        );

        if (matchedThreads.length > 0) {
          app.log.info(
            { creatorId: conn.creator_id, matched: matchedThreads.length },
            'Gmail webhook: classify-thread jobs queued'
          );
        }

      } catch (err) {
        app.log.error({ err }, 'Gmail webhook: async processing error');
      }
    });
  });
}

module.exports = { gmailWebhookRoutes };
