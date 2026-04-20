'use strict';

const { authenticate }         = require('../../middleware/authenticate');
const { requireAdmin }         = require('../../middleware/requireAdmin');
const { getPool }              = require('../../db/pool');
const { encrypt, decrypt }     = require('../../lib/crypto');
const { sendEmail, refreshGmailToken, ensureLabel, applyLabel } = require('../../services/gmail');

const VALID_EVENT_TYPES = ['note','stage_change','outreach_sent','reply_received','meeting_booked','signed_up'];
const VALID_STAGES      = ['identified','contacted','responded','signed_up','active','rejected'];

async function acquisitionRoutes(app) {
  const preHandler = [authenticate, requireAdmin];

  // ── Admin Gmail helpers ───────────────────────────────────────────────────

  async function getAdminGmailToken(pool) {
    const { rows } = await pool.query(
      'SELECT id, gmail_address, access_token, refresh_token, token_expires_at, label_id FROM admin_gmail_connections LIMIT 1'
    );
    if (rows.length === 0) throw new Error('Admin Gmail not connected');
    const conn = rows[0];

    const bufferMs     = 5 * 60 * 1000;
    const tokenExpires = conn.token_expires_at ? new Date(conn.token_expires_at) : null;
    const needsRefresh = tokenExpires && (tokenExpires.getTime() - Date.now() < bufferMs);

    if (needsRefresh && conn.refresh_token) {
      const refreshed = await refreshGmailToken(decrypt(conn.refresh_token));
      await pool.query(
        `UPDATE admin_gmail_connections
         SET access_token = $1, token_expires_at = $2, updated_at = NOW()
         WHERE id = $3`,
        [encrypt(refreshed.accessToken), refreshed.expiresAt, conn.id]
      );
      return { accessToken: refreshed.accessToken, gmailAddress: conn.gmail_address, labelId: conn.label_id };
    }

    return { accessToken: decrypt(conn.access_token), gmailAddress: conn.gmail_address, labelId: conn.label_id };
  }

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
    const { platform, channel_url, channel_name, niche, est_subs, notes, email } = req.body || {};
    if (!channel_name) return reply.code(400).send({ error: 'channel_name is required' });

    const { rows } = await pool.query(
      `INSERT INTO creator_prospects (platform, channel_url, channel_name, niche, est_subs, notes, email, assigned_admin_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [platform || 'other', channel_url || null, channel_name, niche || null, est_subs || null, notes || null, email || null, req.user.userId]
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

    const { platform, channel_url, channel_name, niche, est_subs, stage, assigned_admin_id, notes, converted_user_id, email } = req.body || {};

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
           email             = $10,
           updated_at        = NOW()
       WHERE id = $11 RETURNING *`,
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
        email             !== undefined ? email             : c.email,
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

  // POST /api/admin/acquisition/prospects/:id/send-email
  app.post('/api/admin/acquisition/prospects/:id/send-email', { preHandler }, async (req, reply) => {
    const pool = getPool();
    const { subject, body: emailBody } = req.body || {};
    if (!subject || !emailBody) return reply.code(400).send({ error: 'subject and body are required' });

    const { rows: prospectRows } = await pool.query('SELECT * FROM creator_prospects WHERE id = $1', [req.params.id]);
    if (prospectRows.length === 0) return reply.code(404).send({ error: 'Prospect not found' });
    const prospect = prospectRows[0];
    if (!prospect.email) return reply.code(400).send({ error: 'Prospect has no email address' });

    let adminGmail;
    try { adminGmail = await getAdminGmailToken(pool); }
    catch (err) { return reply.code(400).send({ error: err.message }); }

    let messageId, threadId;
    try {
      const result = await sendEmail({
        accessToken: adminGmail.accessToken,
        from:        `Creatrbase Team <${adminGmail.gmailAddress}>`,
        to:          prospect.email,
        subject,
        body:        emailBody,
      });
      messageId = result.messageId;
      threadId  = result.threadId;
    } catch (err) {
      app.log.error({ err }, 'Admin outreach send failed');
      return reply.code(502).send({ error: 'Failed to send email' });
    }

    if (adminGmail.labelId) {
      try { await applyLabel(adminGmail.accessToken, messageId, adminGmail.labelId); } catch (_) {}
    }

    await pool.query(
      `UPDATE creator_prospects
       SET gmail_thread_id = $1, gmail_message_id = $2, outreach_subject = $3, updated_at = NOW()
       WHERE id = $4`,
      [threadId, messageId, subject, req.params.id]
    );
    await pool.query(
      `INSERT INTO prospect_events (prospect_id, admin_id, event_type, channel, note)
       VALUES ($1, $2, 'outreach_sent', 'email', $3)`,
      [req.params.id, req.user.userId, `Sent: ${subject}`]
    );

    return { ok: true, threadId };
  });

  // POST /api/admin/acquisition/prospects/:id/follow-up
  app.post('/api/admin/acquisition/prospects/:id/follow-up', { preHandler }, async (req, reply) => {
    const pool = getPool();
    const { body: emailBody } = req.body || {};
    if (!emailBody) return reply.code(400).send({ error: 'body is required' });

    const { rows: prospectRows } = await pool.query('SELECT * FROM creator_prospects WHERE id = $1', [req.params.id]);
    if (prospectRows.length === 0) return reply.code(404).send({ error: 'Prospect not found' });
    const prospect = prospectRows[0];
    if (!prospect.email) return reply.code(400).send({ error: 'Prospect has no email address' });
    if (!prospect.gmail_thread_id) return reply.code(400).send({ error: 'No existing thread to follow up on' });

    let adminGmail;
    try { adminGmail = await getAdminGmailToken(pool); }
    catch (err) { return reply.code(400).send({ error: err.message }); }

    const subject = prospect.outreach_subject ? `Re: ${prospect.outreach_subject}` : 'Following up';

    let messageId, threadId;
    try {
      const result = await sendEmail({
        accessToken: adminGmail.accessToken,
        from:        `Creatrbase Team <${adminGmail.gmailAddress}>`,
        to:          prospect.email,
        subject,
        body:        emailBody,
        threadId:    prospect.gmail_thread_id,
      });
      messageId = result.messageId;
      threadId  = result.threadId;
    } catch (err) {
      app.log.error({ err }, 'Admin follow-up send failed');
      return reply.code(502).send({ error: 'Failed to send follow-up email' });
    }

    if (adminGmail.labelId) {
      try { await applyLabel(adminGmail.accessToken, messageId, adminGmail.labelId); } catch (_) {}
    }

    await pool.query('UPDATE creator_prospects SET updated_at = NOW() WHERE id = $1', [req.params.id]);
    await pool.query(
      `INSERT INTO prospect_events (prospect_id, admin_id, event_type, channel, note)
       VALUES ($1, $2, 'outreach_sent', 'email', $3)`,
      [req.params.id, req.user.userId, `Follow-up sent: ${subject}`]
    );

    return { ok: true, threadId };
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
