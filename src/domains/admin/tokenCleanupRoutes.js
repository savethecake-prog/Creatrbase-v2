'use strict';

const { authenticate } = require('../../middleware/authenticate');
const { requireAdmin } = require('../../middleware/requireAdmin');
const { getPool } = require('../../db/pool');

// ── Helpers ───────────────────────────────────────────────────────────────────

async function logAdminAction(pool, actorUserId, details) {
  try {
    await pool.query(
      `INSERT INTO admin_action_log (actor_user_id, action_type, action_target, metadata)
       VALUES ($1::uuid, 'token_cleanup', 'token_cleanup', $2::jsonb)`,
      [actorUserId, JSON.stringify(details)]
    );
  } catch { /* non-fatal */ }
}

/**
 * Strip tool_use and tool_result blocks from a messages JSONB array.
 * Keeps role:user text messages and role:assistant text blocks only.
 * Returns the cleaned array.
 */
function stripToolBlocks(messages) {
  if (!Array.isArray(messages)) return messages;
  return messages.reduce((acc, msg) => {
    if (msg.role === 'user') {
      // Keep text content only
      if (typeof msg.content === 'string') {
        acc.push(msg);
      } else if (Array.isArray(msg.content)) {
        const textParts = msg.content.filter(b => b.type === 'text');
        if (textParts.length > 0) {
          acc.push({ ...msg, content: textParts.length === 1 ? textParts[0].text : textParts });
        }
        // Drop messages that were only tool_result blocks
      }
    } else if (msg.role === 'assistant') {
      if (typeof msg.content === 'string') {
        acc.push(msg);
      } else if (Array.isArray(msg.content)) {
        const textBlocks = msg.content.filter(b => b.type === 'text');
        if (textBlocks.length > 0) {
          acc.push({ ...msg, content: textBlocks });
        }
        // Drop assistant turns that were only tool_use with no text
      }
    }
    // Ignore any other role (system etc treated as-is if not user/assistant)
    return acc;
  }, []);
}

/**
 * Trim a messages array to the last N messages.
 */
function trimToLast(messages, n) {
  if (!Array.isArray(messages) || messages.length <= n) return messages;
  return messages.slice(-n);
}

// ── Routes ────────────────────────────────────────────────────────────────────

async function tokenCleanupRoutes(app) {
  const pool = getPool();
  const preHandler = [authenticate, requireAdmin];

  // ── GET /api/admin/token-cleanup/audit ──────────────────────────────────────

  app.get('/api/admin/token-cleanup/audit', { preHandler }, async () => {

    // ── agent_run stats ──
    const { rows: arStats } = await pool.query(`
      SELECT
        COUNT(*)::int                                          AS total_sessions,
        COALESCE(SUM(pg_column_size(output_snapshot)), 0)::bigint AS total_size_bytes,
        COUNT(*) FILTER (
          WHERE status NOT IN ('complete', 'completed')
            AND created_at < NOW() - INTERVAL '7 days'
        )::int                                                 AS old_incomplete
      FROM agent_run
    `);

    const { rows: arByType } = await pool.query(`
      SELECT
        agent_type,
        COUNT(*)::int                                            AS count,
        COALESCE(SUM(pg_column_size(output_snapshot)), 0)::bigint AS total_bytes,
        COALESCE(AVG(pg_column_size(output_snapshot)), 0)::bigint AS avg_bytes,
        -- reclaimable: estimate tool block overhead for complete sessions
        COALESCE(SUM(
          CASE WHEN status IN ('complete', 'completed')
               THEN pg_column_size(output_snapshot) * 0.6
               ELSE 0
          END
        ), 0)::bigint AS reclaimable_bytes
      FROM agent_run
      GROUP BY agent_type
      ORDER BY total_bytes DESC
    `);

    const { rows: arLarge } = await pool.query(`
      SELECT
        id,
        agent_type,
        pg_column_size(output_snapshot)::bigint AS size_bytes,
        created_at,
        status
      FROM agent_run
      ORDER BY pg_column_size(output_snapshot) DESC
      LIMIT 10
    `);

    // ── content_sessions stats ──
    const { rows: csStats } = await pool.query(`
      SELECT
        COUNT(*)::int                                       AS total_sessions,
        COALESCE(SUM(pg_column_size(messages)), 0)::bigint AS total_size_bytes,
        COUNT(*) FILTER (
          WHERE status NOT IN ('completed')
            AND created_at < NOW() - INTERVAL '7 days'
        )::int                                              AS old_incomplete
      FROM content_sessions
    `);

    const { rows: csLarge } = await pool.query(`
      SELECT
        id,
        content_type AS agent_type,
        pg_column_size(messages)::bigint AS size_bytes,
        created_at,
        status
      FROM content_sessions
      ORDER BY pg_column_size(messages) DESC
      LIMIT 10
    `);

    const ar = arStats[0];
    const cs = csStats[0];

    // Estimated reclaimable: sum of agent_run reclaimable + 60% of completed content_sessions
    const { rows: csReclaimable } = await pool.query(`
      SELECT COALESCE(SUM(pg_column_size(messages) * 0.6), 0)::bigint AS reclaimable_bytes
      FROM content_sessions
      WHERE status = 'completed'
    `);

    const arReclaimable = arByType.reduce((s, r) => s + Number(r.reclaimable_bytes), 0);
    const csReclaimableBytes = Number(csReclaimable[0].reclaimable_bytes);

    // Add old incomplete rows as reclaimable too
    const { rows: arOldBytes } = await pool.query(`
      SELECT COALESCE(SUM(pg_column_size(output_snapshot)), 0)::bigint AS bytes
      FROM agent_run
      WHERE status NOT IN ('complete', 'completed')
        AND created_at < NOW() - INTERVAL '7 days'
    `);
    const { rows: csOldBytes } = await pool.query(`
      SELECT COALESCE(SUM(pg_column_size(messages)), 0)::bigint AS bytes
      FROM content_sessions
      WHERE status NOT IN ('completed')
        AND created_at < NOW() - INTERVAL '7 days'
    `);

    const estimatedReclaimable =
      arReclaimable + csReclaimableBytes +
      Number(arOldBytes[0].bytes) + Number(csOldBytes[0].bytes);

    return {
      agent_run: {
        total_sessions:    ar.total_sessions,
        total_size_bytes:  Number(ar.total_size_bytes),
        by_type:           arByType.map(r => ({
          agent_type:        r.agent_type,
          count:             r.count,
          total_bytes:       Number(r.total_bytes),
          avg_bytes:         Number(r.avg_bytes),
          reclaimable_bytes: Number(r.reclaimable_bytes),
        })),
        old_incomplete:    ar.old_incomplete,
        large_sessions:    arLarge.map(r => ({
          id:         r.id,
          agent_type: r.agent_type,
          size_bytes: Number(r.size_bytes),
          created_at: r.created_at,
          status:     r.status,
        })),
      },
      content_sessions: {
        total_sessions:   cs.total_sessions,
        total_size_bytes: Number(cs.total_size_bytes),
        old_incomplete:   cs.old_incomplete,
        large_sessions:   csLarge.map(r => ({
          id:         r.id,
          agent_type: r.agent_type,
          size_bytes: Number(r.size_bytes),
          created_at: r.created_at,
          status:     r.status,
        })),
      },
      estimated_reclaimable_bytes: estimatedReclaimable,
    };
  });

  // ── POST /api/admin/token-cleanup/run ───────────────────────────────────────

  app.post('/api/admin/token-cleanup/run', { preHandler }, async (req, reply) => {
    const { dryRun = true, targets = [] } = req.body || {};

    if (!Array.isArray(targets) || targets.length === 0) {
      return reply.code(400).send({ error: 'targets array is required' });
    }

    const validTargets = ['tool_results', 'old_incomplete', 'completed_old'];
    for (const t of targets) {
      if (!validTargets.includes(t)) {
        return reply.code(400).send({ error: `Unknown target: ${t}` });
      }
    }

    const result = {
      dryRun,
      targets,
      agent_run:        { rows_affected: 0, bytes_before: 0, bytes_after: 0 },
      content_sessions: { rows_affected: 0, bytes_before: 0, bytes_after: 0 },
      total_bytes_before: 0,
      total_bytes_after:  0,
      bytes_reclaimed:    0,
    };

    // ── Measure current sizes ──
    const { rows: [arSize] } = await pool.query(
      `SELECT COALESCE(SUM(pg_column_size(output_snapshot)), 0)::bigint AS bytes FROM agent_run`
    );
    const { rows: [csSize] } = await pool.query(
      `SELECT COALESCE(SUM(pg_column_size(messages)), 0)::bigint AS bytes FROM content_sessions`
    );
    result.agent_run.bytes_before        = Number(arSize.bytes);
    result.content_sessions.bytes_before = Number(csSize.bytes);
    result.total_bytes_before = result.agent_run.bytes_before + result.content_sessions.bytes_before;

    const client = await pool.connect();
    try {
      if (!dryRun) await client.query('BEGIN');

      // ── target: tool_results ──────────────────────────────────────────────
      if (targets.includes('tool_results')) {
        // agent_run: strip tool blocks from output_snapshot.messages for complete sessions
        const { rows: arCompleted } = await client.query(`
          SELECT id, output_snapshot
          FROM agent_run
          WHERE status IN ('complete', 'completed')
            AND output_snapshot IS NOT NULL
            AND output_snapshot != '{}'::jsonb
        `);

        let arToolCount = 0;
        for (const row of arCompleted) {
          const snap = row.output_snapshot;
          if (!snap || typeof snap !== 'object') continue;

          // output_snapshot may contain { messages: [...], ... }
          let changed = false;
          const newSnap = { ...snap };

          if (Array.isArray(snap.messages)) {
            const stripped = stripToolBlocks(snap.messages);
            if (stripped.length !== snap.messages.length) {
              newSnap.messages = stripped;
              changed = true;
            }
          }

          if (changed) {
            if (!dryRun) {
              await client.query(
                `UPDATE agent_run SET output_snapshot = $1::jsonb WHERE id = $2`,
                [JSON.stringify(newSnap), row.id]
              );
            }
            arToolCount++;
          }
        }
        result.agent_run.rows_affected += arToolCount;

        // content_sessions: strip tool blocks from messages for all sessions
        const { rows: csSessions } = await client.query(`
          SELECT id, messages
          FROM content_sessions
          WHERE messages IS NOT NULL
            AND jsonb_array_length(messages) > 0
        `);

        let csToolCount = 0;
        for (const row of csSessions) {
          const msgs = row.messages;
          if (!Array.isArray(msgs)) continue;
          const stripped = stripToolBlocks(msgs);
          if (stripped.length !== msgs.length) {
            if (!dryRun) {
              await client.query(
                `UPDATE content_sessions SET messages = $1::jsonb, updated_at = NOW() WHERE id = $2`,
                [JSON.stringify(stripped), row.id]
              );
            }
            csToolCount++;
          }
        }
        result.content_sessions.rows_affected += csToolCount;
      }

      // ── target: old_incomplete ────────────────────────────────────────────
      if (targets.includes('old_incomplete')) {
        if (dryRun) {
          const { rows: [r] } = await client.query(`
            SELECT COUNT(*)::int AS cnt
            FROM agent_run
            WHERE status IN ('queued', 'running', 'failed')
              AND created_at < NOW() - INTERVAL '7 days'
          `);
          result.agent_run.rows_affected += r.cnt;

          const { rows: [cs] } = await client.query(`
            SELECT COUNT(*)::int AS cnt
            FROM content_sessions
            WHERE status NOT IN ('completed')
              AND created_at < NOW() - INTERVAL '7 days'
          `);
          result.content_sessions.rows_affected += cs.cnt;
        } else {
          const { rowCount: arDel } = await client.query(`
            DELETE FROM agent_run
            WHERE status IN ('queued', 'running', 'failed')
              AND created_at < NOW() - INTERVAL '7 days'
          `);
          result.agent_run.rows_affected += (arDel || 0);

          const { rowCount: csDel } = await client.query(`
            DELETE FROM content_sessions
            WHERE status NOT IN ('completed')
              AND created_at < NOW() - INTERVAL '7 days'
          `);
          result.content_sessions.rows_affected += (csDel || 0);
        }
      }

      // ── target: completed_old ─────────────────────────────────────────────
      if (targets.includes('completed_old')) {
        const KEEP_MESSAGES = 6;

        // agent_run: trim message arrays for completed sessions older than 30 days
        const { rows: arOld } = await client.query(`
          SELECT id, output_snapshot
          FROM agent_run
          WHERE status IN ('complete', 'completed')
            AND created_at < NOW() - INTERVAL '30 days'
            AND output_snapshot IS NOT NULL
        `);

        let arTrimCount = 0;
        for (const row of arOld) {
          const snap = row.output_snapshot;
          if (!snap || typeof snap !== 'object') continue;
          if (!Array.isArray(snap.messages) || snap.messages.length <= KEEP_MESSAGES) continue;
          const trimmed = trimToLast(snap.messages, KEEP_MESSAGES);
          if (!dryRun) {
            await client.query(
              `UPDATE agent_run SET output_snapshot = $1::jsonb WHERE id = $2`,
              [JSON.stringify({ ...snap, messages: trimmed }), row.id]
            );
          }
          arTrimCount++;
        }
        result.agent_run.rows_affected += arTrimCount;

        // content_sessions: trim messages for completed sessions older than 30 days
        const { rows: csOld } = await client.query(`
          SELECT id, messages
          FROM content_sessions
          WHERE status = 'completed'
            AND created_at < NOW() - INTERVAL '30 days'
            AND jsonb_array_length(messages) > $1
        `, [KEEP_MESSAGES]);

        let csTrimCount = 0;
        for (const row of csOld) {
          const msgs = row.messages;
          if (!Array.isArray(msgs) || msgs.length <= KEEP_MESSAGES) continue;
          if (!dryRun) {
            await client.query(
              `UPDATE content_sessions SET messages = $1::jsonb, updated_at = NOW() WHERE id = $2`,
              [JSON.stringify(trimToLast(msgs, KEEP_MESSAGES)), row.id]
            );
          }
          csTrimCount++;
        }
        result.content_sessions.rows_affected += csTrimCount;
      }

      if (!dryRun) await client.query('COMMIT');
    } catch (err) {
      if (!dryRun) await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // ── Measure sizes after (if not dry run) ──
    if (!dryRun) {
      const { rows: [arAfter] } = await pool.query(
        `SELECT COALESCE(SUM(pg_column_size(output_snapshot)), 0)::bigint AS bytes FROM agent_run`
      );
      const { rows: [csAfter] } = await pool.query(
        `SELECT COALESCE(SUM(pg_column_size(messages)), 0)::bigint AS bytes FROM content_sessions`
      );
      result.agent_run.bytes_after        = Number(arAfter.bytes);
      result.content_sessions.bytes_after = Number(csAfter.bytes);
    } else {
      // Dry run: estimate bytes_after as current (we haven't changed anything)
      result.agent_run.bytes_after        = result.agent_run.bytes_before;
      result.content_sessions.bytes_after = result.content_sessions.bytes_before;
    }

    result.total_bytes_after  = result.agent_run.bytes_after + result.content_sessions.bytes_after;
    result.bytes_reclaimed    = result.total_bytes_before - result.total_bytes_after;

    // Log the operation
    await logAdminAction(pool, req.user.userId, {
      dry_run:      dryRun,
      targets,
      bytes_before: result.total_bytes_before,
      bytes_after:  result.total_bytes_after,
      bytes_reclaimed: result.bytes_reclaimed,
      ar_rows:      result.agent_run.rows_affected,
      cs_rows:      result.content_sessions.rows_affected,
    });

    return result;
  });
}

module.exports = { tokenCleanupRoutes };
