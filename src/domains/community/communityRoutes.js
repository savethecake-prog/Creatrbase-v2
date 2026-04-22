'use strict';

const { authenticate }       = require('../../middleware/authenticate');
const { requireAdmin }       = require('../../middleware/requireAdmin');
const { requireTier }        = require('../../middleware/requireTier');
const { getPool }            = require('../../db/pool');
const { resolveTier }        = require('../../services/tierResolver');
const { encrypt, decrypt }   = require('../../lib/crypto');
const { sendEmail, refreshGmailToken } = require('../../services/gmail');

// Compute week_year: YEAR * 100 + ISO_WEEK (UTC to avoid timezone-based cap bypass)
function currentWeekYear() {
  const now  = new Date();
  const jan4 = new Date(Date.UTC(now.getUTCFullYear(), 0, 4));
  const dayDiff = (now.getTime() - jan4.getTime()) / 86400000;
  const week = Math.ceil((dayDiff + jan4.getUTCDay() + 1) / 7);
  return now.getUTCFullYear() * 100 + Math.max(1, week);
}

// Escape HTML special chars for email body
function escapeHtml(text) {
  return text.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[m]));
}

// Weekly suggestion creation caps by tier
const WEEKLY_CAP = { free: 0, core: 1, pro: 2 };

async function getAdminGmailToken(pool) {
  const { rows } = await pool.query(
    'SELECT id, gmail_address, access_token, refresh_token, token_expires_at FROM admin_gmail_connections LIMIT 1'
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
    return { accessToken: refreshed.accessToken, gmailAddress: conn.gmail_address };
  }

  return { accessToken: decrypt(conn.access_token), gmailAddress: conn.gmail_address };
}

async function communityRoutes(app) {

  // ── GET /api/community/categories ────────────────────────────────────────
  app.get('/api/community/categories', { preHandler: authenticate }, async () => {
    const pool = getPool();
    const { rows } = await pool.query(
      'SELECT id, name, slug FROM community_categories ORDER BY sort_order, name'
    );
    return { categories: rows };
  });

  // ── GET /api/community/suggestions ───────────────────────────────────────
  // Free: top 10 by net score, open only.  Core+: full access with filters.
  app.get('/api/community/suggestions', { preHandler: authenticate }, async (req) => {
    const pool      = getPool();
    const tierInfo  = await resolveTier(req.user.tenantId);
    const tier      = tierInfo.tier;
    const isFree    = tier === 'free';

    const {
      category,
      sort     = 'votes',   // votes | new | controversial
      status   = 'open',
      limit    = isFree ? 10 : 25,
      offset   = 0,
    } = req.query || {};

    const params  = [req.user.userId];
    const clauses = ["cs.status != 'archived'"];

    if (isFree) {
      clauses.push("cs.status = 'open'");
    } else if (status) {
      clauses.push(`cs.status = $${params.push(status)}`);
    }

    if (!isFree && category) {
      clauses.push(`cc.slug = $${params.push(category)}`);
    }

    const orderBy = sort === 'new'
      ? 'cs.created_at DESC'
      : sort === 'controversial'
        ? '(cs.upvotes + cs.downvotes) DESC, cs.created_at DESC'
        : '(cs.upvotes - cs.downvotes) DESC, cs.created_at DESC';

    const safeLimit  = Math.min(isFree ? 10 : 50, Math.max(1, parseInt(limit, 10) || 25));
    const safeOffset = isFree ? 0 : Math.max(0, parseInt(offset, 10) || 0);
    const where      = 'WHERE ' + clauses.join(' AND ');

    const { rows } = await pool.query(`
      SELECT
        cs.id,
        cs.title,
        cs.description,
        cs.status,
        cs.upvotes,
        cs.downvotes,
        cs.created_at,
        cc.name         AS category_name,
        cc.slug         AS category_slug,
        cr.display_name AS author_name,
        cv_me.vote_type AS user_vote_type
      FROM community_suggestions cs
      LEFT JOIN community_categories cc ON cc.id = cs.category_id
      LEFT JOIN creators cr ON cr.user_id = cs.user_id
      LEFT JOIN community_votes cv_me
             ON cv_me.suggestion_id = cs.id AND cv_me.user_id = $1
      ${where}
      ORDER BY ${orderBy}
      LIMIT $${params.push(safeLimit)} OFFSET $${params.push(safeOffset)}
    `, params);

    // Weekly cap info
    const weekYear = currentWeekYear();
    const { rows: capRows } = await pool.query(
      'SELECT COUNT(*)::int AS count FROM community_suggestions WHERE user_id = $1 AND week_year = $2',
      [req.user.userId, weekYear]
    );
    const usedThisWeek = capRows[0]?.count ?? 0;
    const cap          = WEEKLY_CAP[tier] ?? 0;

    return {
      suggestions: rows,
      isFree,
      tier,
      weeklyUsed: usedThisWeek,
      weeklyCap:  cap,
    };
  });

  // ── POST /api/community/suggestions ──────────────────────────────────────
  // Core+: create suggestion (weekly cap enforced)
  app.post('/api/community/suggestions', {
    preHandler: [authenticate, requireTier('core')],
  }, async (req, reply) => {
    const { title, description = '', category_id = null } = req.body || {};
    if (!title?.trim()) return reply.code(400).send({ error: 'title is required' });
    if (title.trim().length > 120) return reply.code(400).send({ error: 'title must be 120 characters or fewer' });

    const pool     = getPool();
    const tier     = req.tier; // set by requireTier preHandler
    const cap      = WEEKLY_CAP[tier] ?? 0;
    const weekYear = currentWeekYear();

    const { rows: capRows } = await pool.query(
      'SELECT COUNT(*)::int AS count FROM community_suggestions WHERE user_id = $1 AND week_year = $2',
      [req.user.userId, weekYear]
    );
    const used = capRows[0]?.count ?? 0;
    if (used >= cap) {
      return reply.code(429).send({
        error: `Weekly limit reached. ${tier === 'core' ? 'Core' : 'Pro'} members can post ${cap} suggestion${cap !== 1 ? 's' : ''} per week.`,
        weeklyUsed: used,
        weeklyCap:  cap,
      });
    }

    if (category_id) {
      const { rows: [cat] } = await pool.query(
        'SELECT id FROM community_categories WHERE id = $1', [category_id]
      );
      if (!cat) return reply.code(400).send({ error: 'Invalid category' });
    }

    const { rows: [suggestion] } = await pool.query(
      `INSERT INTO community_suggestions
         (tenant_id, user_id, category_id, title, description, week_year)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, title, description, status, upvotes, downvotes, created_at`,
      [req.user.tenantId, req.user.userId, category_id || null, title.trim(), description.trim(), weekYear]
    );

    return { suggestion };
  });

  // ── POST /api/community/suggestions/:id/vote ─────────────────────────────
  // Core+: up / down / remove
  app.post('/api/community/suggestions/:id/vote', {
    preHandler: [authenticate, requireTier('core')],
  }, async (req, reply) => {
    const { vote_type } = req.body || {};
    if (!['up', 'down', 'remove'].includes(vote_type)) {
      return reply.code(400).send({ error: 'vote_type must be up, down, or remove' });
    }

    const pool = getPool();

    const { rows: [suggestion] } = await pool.query(
      "SELECT id, status FROM community_suggestions WHERE id = $1",
      [req.params.id]
    );
    if (!suggestion) return reply.code(404).send({ error: 'Suggestion not found' });
    if (!['open', 'considering'].includes(suggestion.status)) {
      return reply.code(422).send({ error: 'Voting is closed for this suggestion' });
    }

    const { rows: [existing] } = await pool.query(
      'SELECT id, vote_type FROM community_votes WHERE suggestion_id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );

    if (vote_type === 'remove' || (existing && existing.vote_type === vote_type)) {
      if (existing) await pool.query('DELETE FROM community_votes WHERE id = $1', [existing.id]);
      return { user_vote_type: null };
    }

    if (existing) {
      await pool.query('UPDATE community_votes SET vote_type = $1 WHERE id = $2', [vote_type, existing.id]);
    } else {
      await pool.query(
        'INSERT INTO community_votes (suggestion_id, user_id, vote_type) VALUES ($1, $2, $3)',
        [req.params.id, req.user.userId, vote_type]
      );
    }

    return { user_vote_type: vote_type };
  });

  // ── Admin routes ──────────────────────────────────────────────────────────

  const preHandler = [authenticate, requireAdmin];

  // GET /api/admin/community/suggestions
  app.get('/api/admin/community/suggestions', { preHandler }, async (req) => {
    const pool = getPool();
    const { status, category, search } = req.query || {};
    const safeLimit  = Math.min(100, Math.max(1, parseInt(req.query.limit  ?? '50',  10) || 50));
    const safeOffset = Math.max(0,              parseInt(req.query.offset ?? '0',   10) || 0);

    const params  = [];
    const clauses = [];
    if (status)   clauses.push(`cs.status = $${params.push(status)}`);
    if (category) clauses.push(`cc.slug = $${params.push(category)}`);
    if (search)   clauses.push(`cs.title ILIKE $${params.push(`%${search}%`)}`);

    const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';

    const { rows } = await pool.query(`
      SELECT
        cs.*,
        cc.name        AS category_name,
        cc.slug        AS category_slug,
        cr.display_name AS author_name,
        u.email        AS author_email
      FROM community_suggestions cs
      LEFT JOIN community_categories cc ON cc.id = cs.category_id
      LEFT JOIN users u ON u.id = cs.user_id
      LEFT JOIN creators cr ON cr.user_id = cs.user_id
      ${where}
      ORDER BY cs.created_at DESC
      LIMIT $${params.push(safeLimit)} OFFSET $${params.push(safeOffset)}
    `, params);

    // Count without limit/offset (use the same params minus last two)
    const countParams = params.slice(0, -2);
    const { rows: [{ count }] } = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM community_suggestions cs
       LEFT JOIN community_categories cc ON cc.id = cs.category_id
       ${where}`,
      countParams
    );

    return { suggestions: rows, total: count };
  });

  // PATCH /api/admin/community/suggestions/:id/status
  app.patch('/api/admin/community/suggestions/:id/status', { preHandler }, async (req, reply) => {
    const { status, decline_reason } = req.body || {};
    const VALID = ['open', 'considering', 'declined', 'archived', 'promoted'];
    if (!VALID.includes(status)) return reply.code(400).send({ error: 'invalid status' });
    if (status === 'declined' && !decline_reason?.trim()) {
      return reply.code(400).send({ error: 'decline_reason is required when declining' });
    }

    const pool = getPool();
    const { rows: [item] } = await pool.query(
      'SELECT * FROM community_suggestions WHERE id = $1', [req.params.id]
    );
    if (!item) return reply.code(404).send({ error: 'Suggestion not found' });

    const { rows: [updated] } = await pool.query(
      `UPDATE community_suggestions
       SET status = $1, decline_reason = $2, updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [status, decline_reason?.trim() || null, req.params.id]
    );
    return updated;
  });

  // POST /api/admin/community/suggestions/:id/email-author
  app.post('/api/admin/community/suggestions/:id/email-author', { preHandler }, async (req, reply) => {
    const { subject, message } = req.body || {};
    if (!subject?.trim()) return reply.code(400).send({ error: 'subject is required' });
    if (!message?.trim())  return reply.code(400).send({ error: 'message is required' });

    const pool = getPool();
    const { rows: [item] } = await pool.query(`
      SELECT cs.*, u.email AS author_email, cr.display_name AS author_name
      FROM community_suggestions cs
      JOIN users u ON u.id = cs.user_id
      LEFT JOIN creators cr ON cr.user_id = cs.user_id
      WHERE cs.id = $1
    `, [req.params.id]);
    if (!item) return reply.code(404).send({ error: 'Suggestion not found' });
    if (!item.author_email) return reply.code(422).send({ error: 'Author has no email address' });

    const { accessToken, gmailAddress } = await getAdminGmailToken(pool);
    await sendEmail({
      accessToken,
      from:    gmailAddress,
      to:      item.author_email,
      subject: subject.trim(),
      html:    `<p>${escapeHtml(message.trim()).replace(/\n/g, '<br>')}</p>`,
    });

    return { ok: true };
  });

  // POST /api/admin/community/suggestions/:id/promote
  app.post('/api/admin/community/suggestions/:id/promote', { preHandler }, async (req, reply) => {
    const { status = 'scoping', launch_date = null, tag = null } = req.body || {};

    const pool = getPool();
    const { rows: [item] } = await pool.query(
      'SELECT * FROM community_suggestions WHERE id = $1', [req.params.id]
    );
    if (!item) return reply.code(404).send({ error: 'Suggestion not found' });

    const { rows: [roadmapItem] } = await pool.query(
      `INSERT INTO roadmap_items (title, description, status, visibility, launch_date, tag)
       VALUES ($1, $2, $3, 'all', $4, $5) RETURNING *`,
      [item.title, item.description || '', status, launch_date || null, tag?.trim() || null]
    );

    await pool.query(
      `UPDATE community_suggestions
       SET status = 'promoted', roadmap_item_id = $1, updated_at = NOW()
       WHERE id = $2`,
      [roadmapItem.id, req.params.id]
    );

    return { roadmapItem };
  });
}

module.exports = { communityRoutes };
