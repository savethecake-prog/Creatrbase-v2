'use strict';

const path = require('path');
const fs   = require('fs');
const { authenticate }  = require('../../middleware/authenticate');
const { requireAdmin }  = require('../../middleware/requireAdmin');
const { requireTier }   = require('../../middleware/requireTier');
const { getPool }       = require('../../db/pool');

const SKILLS_DIR = path.join(__dirname, '../../../skills');

const SKILLS_ORDER = [
  'creatrbase-voice',
  'creatrbase-copy-rules',
  'newsletter-curation',
  'newsletter-summarisation',
  'newsletter-subject-lines',
  'editorial-question-generation',
  'editorial-drafting',
  'voice-memory-protocol',
  'source-credibility-tiering',
  'digest-creator-economy',
  'digest-ai-for-creators',
];

// Deterministic avatar colour from user UUID (6 palette options)
const AVATAR_COLOURS = ['#C8AAFF', '#9EFFD8', '#FFBFA3', '#F09870', '#A284E0', '#6EDDB1'];
function avatarColour(userId) {
  if (!userId) return AVATAR_COLOURS[0];
  let sum = 0;
  for (let i = 0; i < userId.length; i++) sum += userId.charCodeAt(i);
  return AVATAR_COLOURS[sum % AVATAR_COLOURS.length];
}

// Initials from display_name
function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

async function isPowerUser(userId) {
  const pool = getPool();
  const { rows } = await pool.query('SELECT is_power_user FROM users WHERE id = $1', [userId]);
  return rows[0]?.is_power_user ?? false;
}

async function roadmapRoutes(app) {

  // ── GET /api/roadmap ──────────────────────────────────────────────────────
  // Authenticated: returns items with upvotes, downvotes, user_vote_type, voter avatars.
  // Free tier: can see all items (no voting). Core+: can vote.
  app.get('/api/roadmap', { preHandler: authenticate }, async (req) => {
    const pool  = getPool();
    const power = await isPowerUser(req.user.userId);

    const { rows } = await pool.query(`
      SELECT
        ri.id,
        ri.title,
        ri.description,
        ri.status,
        ri.visibility,
        ri.sort_order,
        ri.launch_date,
        ri.tag,
        ri.upvotes,
        ri.downvotes,
        ri.shipped_at,
        ri.created_at,
        fv_me.vote_type                                     AS user_vote_type,
        COALESCE(
          json_agg(
            json_build_object(
              'userId',  v_top.user_id,
              'name',    u_top.display_name,
              'colour',  '#C8AAFF'
            ) ORDER BY v_top.created_at ASC
          ) FILTER (WHERE v_top.id IS NOT NULL),
          '[]'::json
        )                                                   AS voters
      FROM roadmap_items ri
      LEFT JOIN feature_votes fv_me
             ON fv_me.roadmap_item_id = ri.id AND fv_me.user_id = $1
      LEFT JOIN LATERAL (
        SELECT fv2.id, fv2.user_id, fv2.created_at
        FROM feature_votes fv2
        WHERE fv2.roadmap_item_id = ri.id AND fv2.vote_type = 'up'
        ORDER BY fv2.created_at ASC
        LIMIT 5
      ) v_top ON true
      LEFT JOIN users u_top ON u_top.id = v_top.user_id
      GROUP BY ri.id, fv_me.vote_type
      ORDER BY
        CASE ri.status
          WHEN 'building'  THEN 1
          WHEN 'launching' THEN 2
          WHEN 'planning'  THEN 3
          WHEN 'scoping'   THEN 4
          WHEN 'shipped'   THEN 5
        END,
        ri.sort_order,
        ri.created_at DESC
    `, [req.user.userId]);

    // Attach deterministic colours server-side
    const items = rows.map(item => ({
      ...item,
      voters: (item.voters || []).map(v => ({
        ...v,
        colour: avatarColour(v.userId),
        initials: initials(v.name),
      })),
    }));

    return { items, isPowerUser: power };
  });

  // ── POST /api/roadmap/:id/vote ────────────────────────────────────────────
  // Core and above can vote. vote_type: 'up' | 'down' | 'remove'
  app.post('/api/roadmap/:id/vote', {
    preHandler: [authenticate, requireTier('core')],
  }, async (req, reply) => {
    const { vote_type } = req.body || {};
    if (!['up', 'down', 'remove'].includes(vote_type)) {
      return reply.code(400).send({ error: 'vote_type must be up, down, or remove' });
    }

    const pool = getPool();

    const { rows: [item] } = await pool.query(
      'SELECT status FROM roadmap_items WHERE id = $1',
      [req.params.id]
    );
    if (!item) return reply.code(404).send({ error: 'Item not found' });
    if (item.status === 'shipped') {
      return reply.code(422).send({ error: 'Voting closed for shipped items' });
    }

    const { rows: [existing] } = await pool.query(
      'SELECT id, vote_type FROM feature_votes WHERE roadmap_item_id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );

    if (vote_type === 'remove' || (existing && existing.vote_type === vote_type)) {
      // Toggle off: delete
      if (existing) {
        await pool.query('DELETE FROM feature_votes WHERE id = $1', [existing.id]);
      }
      return { user_vote_type: null };
    }

    if (existing) {
      // Change vote type
      await pool.query(
        'UPDATE feature_votes SET vote_type = $1 WHERE id = $2',
        [vote_type, existing.id]
      );
    } else {
      // New vote
      await pool.query(
        'INSERT INTO feature_votes (roadmap_item_id, user_id, vote_type) VALUES ($1, $2, $3)',
        [req.params.id, req.user.userId, vote_type]
      );
    }

    return { user_vote_type: vote_type };
  });

  // ── GET /api/power/skills-download ───────────────────────────────────────
  app.get('/api/power/skills-download', { preHandler: authenticate }, async (req, reply) => {
    const power = await isPowerUser(req.user.userId);
    if (!power) return reply.code(403).send({ error: 'Power User status required' });

    const sections = [];
    sections.push('# Creatrbase Prompts & Skills\n');
    sections.push('These are the system prompts used by the Creatrbase AI agents internally.\n');
    sections.push('Paste any section as a Claude.ai system prompt to apply that editorial lens.\n');
    sections.push('---\n');

    for (const name of SKILLS_ORDER) {
      const skillPath = path.join(SKILLS_DIR, name, 'SKILL.md');
      if (!fs.existsSync(skillPath)) continue;
      const content = fs.readFileSync(skillPath, 'utf8').trim();
      sections.push(`\n## ${name}\n\n${content}\n`);
    }

    const body = sections.join('\n');

    reply
      .header('Content-Type', 'text/markdown; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="creatrbase-prompts.md"')
      .send(body);
  });

  // ── Admin CRUD ────────────────────────────────────────────────────────────

  const VALID_STATUSES = ['scoping', 'planning', 'building', 'launching', 'shipped'];
  const VALID_VISIBILITY = ['power_users', 'all'];

  // GET /api/admin/roadmap
  app.get('/api/admin/roadmap', { preHandler: [authenticate, requireAdmin] }, async () => {
    const pool = getPool();
    const { rows } = await pool.query(`
      SELECT
        ri.*,
        COUNT(fv.id)::int AS total_votes
      FROM roadmap_items ri
      LEFT JOIN feature_votes fv ON fv.roadmap_item_id = ri.id
      GROUP BY ri.id
      ORDER BY
        CASE ri.status
          WHEN 'building'  THEN 1 WHEN 'launching' THEN 2
          WHEN 'planning'  THEN 3 WHEN 'scoping'   THEN 4
          WHEN 'shipped'   THEN 5
        END,
        ri.sort_order, ri.created_at DESC
    `);
    return { items: rows };
  });

  // POST /api/admin/roadmap
  app.post('/api/admin/roadmap', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const {
      title,
      description = '',
      status      = 'scoping',
      visibility  = 'all',
      sort_order  = 0,
      launch_date = null,
      tag         = null,
    } = req.body || {};

    if (!title?.trim()) return reply.code(400).send({ error: 'title is required' });
    if (!VALID_STATUSES.includes(status)) return reply.code(400).send({ error: 'invalid status' });
    if (!VALID_VISIBILITY.includes(visibility)) return reply.code(400).send({ error: 'invalid visibility' });
    if (launch_date && isNaN(new Date(launch_date).getTime())) {
      return reply.code(400).send({ error: 'invalid launch_date format' });
    }

    const pool = getPool();
    const { rows: [item] } = await pool.query(
      `INSERT INTO roadmap_items (title, description, status, visibility, sort_order, launch_date, tag)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [title.trim(), description.trim(), status, visibility, sort_order, launch_date || null, tag?.trim() || null]
    );
    return item;
  });

  // PATCH /api/admin/roadmap/:id
  app.patch('/api/admin/roadmap/:id', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const pool = getPool();
    const { rows: [item] } = await pool.query('SELECT * FROM roadmap_items WHERE id = $1', [req.params.id]);
    if (!item) return reply.code(404).send({ error: 'Item not found' });

    const {
      title, description, status, visibility,
      sort_order, launch_date, tag,
    } = req.body || {};

    if (status && !VALID_STATUSES.includes(status)) return reply.code(400).send({ error: 'invalid status' });
    if (launch_date && isNaN(new Date(launch_date).getTime())) {
      return reply.code(400).send({ error: 'invalid launch_date format' });
    }

    const { rows: [updated] } = await pool.query(
      `UPDATE roadmap_items SET
        title       = COALESCE($1, title),
        description = COALESCE($2, description),
        status      = COALESCE($3, status),
        visibility  = COALESCE($4, visibility),
        sort_order  = COALESCE($5, sort_order),
        launch_date = COALESCE($6, launch_date),
        tag         = COALESCE($7, tag)
       WHERE id = $8 RETURNING *`,
      [
        title ?? null, description ?? null, status ?? null, visibility ?? null,
        sort_order ?? null, launch_date ?? null, tag ?? null, req.params.id,
      ]
    );
    return updated;
  });

  // DELETE /api/admin/roadmap/:id
  app.delete('/api/admin/roadmap/:id', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const pool = getPool();
    const { rowCount } = await pool.query('DELETE FROM roadmap_items WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return reply.code(404).send({ error: 'Item not found' });
    return { ok: true };
  });
}

module.exports = { roadmapRoutes };
