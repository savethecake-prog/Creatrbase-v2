'use strict';

const { authenticate } = require('../../middleware/authenticate');
const { requireAdmin }  = require('../../middleware/requireAdmin');
const { getPool }       = require('../../db/pool');

const VALID_EVENT_TYPES = ['note','stage_change','outreach_sent','reply_received','meeting_booked','signed_up'];
const VALID_STAGES      = ['identified','contacted','responded','signed_up','active','rejected'];

async function acquisitionRoutes(app) {
  const preHandler = [authenticate, requireAdmin];

  // GET /api/admin/acquisition/stats
  app.get('/api/admin/acquisition/stats', { preHandler }, async () => {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT stage, COUNT(*)::int AS count FROM creator_prospects GROUP BY stage`
    );
    const by_stage = Object.fromEntries(rows.map(r => [r.stage, r.count]));
    return { total: rows.reduce((s, r) => s + r.count, 0), by_stage };
  });

  // GET /api/admin/acquisition/prospects?stage=&search=&limit=&offset=
  app.get('/api/admin/acquisition/prospects', { preHandler }, async (req) => {
    const pool  = getPool();
    const { stage, search } = req.query || {};
    const limit  = Math.min(200, Math.max(1, parseInt(req.query.limit  ?? '100', 10) || 100));
    const offset = Math.max(0,              parseInt(req.query.offset ?? '0',   10) || 0);

    const params = [];
    const clauses = [];
    if (stage)  { params.push(stage);           clauses.push(`p.stage = $${params.length}`); }
    if (search) { params.push(`%${search}%`);   clauses.push(`(p.channel_name ILIKE $${params.length} OR p.niche ILIKE $${params.length})`); }
    const where = clauses.length ? clauses.join(' AND ') : '1=1';

    const [{ rows }, { rows: countRows }] = await Promise.all([
      pool.query(
        `SELECT p.*,
                COALESCE(u.email,'') AS assigned_admin_email,
                (SELECT COUNT(*)::int FROM prospect_events e WHERE e.prospect_id = p.id) AS event_count,
                (SELECT e2.created_at FROM prospect_events e2 WHERE e2.prospect_id = p.id ORDER BY e2.created_at DESC LIMIT 1) AS last_activity_at
         FROM creator_prospects p
         LEFT JOIN users u ON u.id = p.assigned_admin_id
         WHERE ${where}
         ORDER BY p.updated_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total FROM creator_prospects p WHERE ${where}`,
        params
      ),
    ]);

    return { prospects: rows, total: countRows[0].total };
  });

  // POST /api/admin/acquisition/prospects
  app.post('/api/admin/acquisition/prospects', { preHandler }, async (req, reply) => {
    const pool = getPool();
    const { platform, channel_url, channel_name, niche, est_subs, notes } = req.body || {};
    if (!channel_name) return reply.code(400).send({ error: 'channel_name is required' });

    const { rows } = await pool.query(
      `INSERT INTO creator_prospects (platform, channel_url, channel_name, niche, est_subs, notes, assigned_admin_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [platform || 'other', channel_url || null, channel_name, niche || null, est_subs || null, notes || null, req.user.userId]
    );
    return { prospect: rows[0] };
  });

  // GET /api/admin/acquisition/prospects/:id
  app.get('/api/admin/acquisition/prospects/:id', { preHandler }, async (req, reply) => {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT p.*, COALESCE(u.email,'') AS assigned_admin_email
       FROM creator_prospects p
       LEFT JOIN users u ON u.id = p.assigned_admin_id
       WHERE p.id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return reply.code(404).send({ error: 'Prospect not found' });

    const { rows: events } = await pool.query(
      `SELECT e.*, COALESCE(u.email,'') AS admin_email
       FROM prospect_events e
       LEFT JOIN users u ON u.id = e.admin_id
       WHERE e.prospect_id = $1
       ORDER BY e.created_at ASC`,
      [req.params.id]
    );

    return { prospect: rows[0], events };
  });

  // PATCH /api/admin/acquisition/prospects/:id
  app.patch('/api/admin/acquisition/prospects/:id', { preHandler }, async (req, reply) => {
    const pool = getPool();
    const { rows: cur } = await pool.query('SELECT * FROM creator_prospects WHERE id = $1', [req.params.id]);
    if (cur.length === 0) return reply.code(404).send({ error: 'Prospect not found' });
    const c = cur[0];

    const { platform, channel_url, channel_name, niche, est_subs, stage, assigned_admin_id, notes, converted_user_id } = req.body || {};

    if (stage && !VALID_STAGES.includes(stage)) {
      return reply.code(400).send({ error: `stage must be one of: ${VALID_STAGES.join(', ')}` });
    }

    const { rows } = await pool.query(
      `UPDATE creator_prospects
       SET platform          = $1,
           channel_url       = $2,
           channel_name      = $3,
           niche             = $4,
           est_subs          = $5,
           stage             = $6,
           assigned_admin_id = $7,
           notes             = $8,
           converted_user_id = $9,
           updated_at        = NOW()
       WHERE id = $10 RETURNING *`,
      [
        platform          ?? c.platform,
        channel_url       !== undefined ? channel_url       : c.channel_url,
        channel_name      ?? c.channel_name,
        niche             !== undefined ? niche             : c.niche,
        est_subs          !== undefined ? est_subs          : c.est_subs,
        stage             ?? c.stage,
        assigned_admin_id !== undefined ? assigned_admin_id : c.assigned_admin_id,
        notes             !== undefined ? notes             : c.notes,
        converted_user_id !== undefined ? converted_user_id : c.converted_user_id,
        req.params.id,
      ]
    );

    if (stage && stage !== c.stage) {
      await pool.query(
        `INSERT INTO prospect_events (prospect_id, admin_id, event_type, note)
         VALUES ($1, $2, 'stage_change', $3)`,
        [req.params.id, req.user.userId, `Stage changed from ${c.stage} to ${stage}`]
      );
    }

    return { prospect: rows[0] };
  });

  // DELETE /api/admin/acquisition/prospects/:id
  app.delete('/api/admin/acquisition/prospects/:id', { preHandler }, async (req, reply) => {
    const pool = getPool();
    const { rowCount } = await pool.query('DELETE FROM creator_prospects WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return reply.code(404).send({ error: 'Prospect not found' });
    return { ok: true };
  });

  // POST /api/admin/acquisition/prospects/:id/events
  app.post('/api/admin/acquisition/prospects/:id/events', { preHandler }, async (req, reply) => {
    const pool = getPool();
    const { event_type, channel, note } = req.body || {};
    if (!event_type || !VALID_EVENT_TYPES.includes(event_type)) {
      return reply.code(400).send({ error: `event_type must be one of: ${VALID_EVENT_TYPES.join(', ')}` });
    }
    const { rows: prospectCheck } = await pool.query('SELECT id FROM creator_prospects WHERE id = $1', [req.params.id]);
    if (prospectCheck.length === 0) return reply.code(404).send({ error: 'Prospect not found' });

    const { rows } = await pool.query(
      `INSERT INTO prospect_events (prospect_id, admin_id, event_type, channel, note)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.params.id, req.user.userId, event_type, channel || null, note || null]
    );
    await pool.query('UPDATE creator_prospects SET updated_at = NOW() WHERE id = $1', [req.params.id]);

    return { event: rows[0] };
  });
}

module.exports = { acquisitionRoutes };
