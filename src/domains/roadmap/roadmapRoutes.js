'use strict';

const path = require('path');
const fs   = require('fs');
const { authenticate }  = require('../../middleware/authenticate');
const { requireAdmin }  = require('../../middleware/requireAdmin');
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

async function isPowerUser(userId) {
  const pool = getPool();
  const { rows } = await pool.query('SELECT is_power_user FROM users WHERE id = $1', [userId]);
  return rows[0]?.is_power_user ?? false;
}

async function roadmapRoutes(app) {

  // ── Public / power-user read ──────────────────────────────────────────────

  // GET /api/roadmap — items visible to the requesting user with vote counts
  app.get('/api/roadmap', { preHandler: authenticate }, async (req) => {
    const pool      = getPool();
    const power     = await isPowerUser(req.user.userId);
    const visFilter = power ? '' : "AND ri.visibility = 'all'";

    const { rows } = await pool.query(`
      SELECT
        ri.id, ri.title, ri.description, ri.status, ri.visibility,
        ri.sort_order, ri.shipped_at, ri.created_at,
        COUNT(fv.id)::int                                        AS vote_count,
        BOOL_OR(fv.user_id = $1)                                 AS user_voted
      FROM roadmap_items ri
      LEFT JOIN feature_votes fv ON fv.roadmap_item_id = ri.id
      WHERE true ${visFilter}
      GROUP BY ri.id
      ORDER BY
        CASE ri.status
          WHEN 'building'  THEN 1
          WHEN 'thinking'  THEN 2
          WHEN 'testing'   THEN 3
          WHEN 'shipped'   THEN 4
        END,
        ri.sort_order,
        ri.created_at DESC
    `, [req.user.userId]);

    return { items: rows, isPowerUser: power };
  });

  // POST /api/roadmap/:id/vote — toggle vote (power users only)
  app.post('/api/roadmap/:id/vote', { preHandler: authenticate }, async (req, reply) => {
    const power = await isPowerUser(req.user.userId);
    if (!power) return reply.code(403).send({ error: 'Power User status required' });

    const pool = getPool();

    // Only votable on thinking/building items
    const { rows: [item] } = await pool.query(
      "SELECT status FROM roadmap_items WHERE id = $1",
      [req.params.id]
    );
    if (!item) return reply.code(404).send({ error: 'Item not found' });
    if (!['thinking', 'building'].includes(item.status)) {
      return reply.code(422).send({ error: 'Voting closed for this item' });
    }

    // Toggle
    const { rows: [existing] } = await pool.query(
      'SELECT id FROM feature_votes WHERE roadmap_item_id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );

    if (existing) {
      await pool.query('DELETE FROM feature_votes WHERE id = $1', [existing.id]);
      return { voted: false };
    } else {
      await pool.query(
        'INSERT INTO feature_votes (roadmap_item_id, user_id) VALUES ($1, $2)',
        [req.params.id, req.user.userId]
      );
      return { voted: true };
    }
  });

  // ── Skills download ───────────────────────────────────────────────────────

  // GET /api/power/skills-download — power users only, returns concatenated skills as .md
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

  // GET /api/admin/roadmap
  app.get('/api/admin/roadmap', { preHandler: [authenticate, requireAdmin] }, async () => {
    const pool = getPool();
    const { rows } = await pool.query(`
      SELECT ri.*, COUNT(fv.id)::int AS vote_count
      FROM roadmap_items ri
      LEFT JOIN feature_votes fv ON fv.roadmap_item_id = ri.id
      GROUP BY ri.id
      ORDER BY
        CASE ri.status WHEN 'building' THEN 1 WHEN 'thinking' THEN 2 WHEN 'testing' THEN 3 WHEN 'shipped' THEN 4 END,
        ri.sort_order, ri.created_at DESC
    `);
    return { items: rows };
  });

  // POST /api/admin/roadmap
  app.post('/api/admin/roadmap', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const { title, description = '', status = 'thinking', visibility = 'power_users', sort_order = 0 } = req.body || {};
    if (!title?.trim()) return reply.code(400).send({ error: 'title is required' });

    const pool = getPool();
    const { rows: [item] } = await pool.query(
      `INSERT INTO roadmap_items (title, description, status, visibility, sort_order)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [title.trim(), description.trim(), status, visibility, sort_order]
    );
    return item;
  });

  // PATCH /api/admin/roadmap/:id
  app.patch('/api/admin/roadmap/:id', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const { title, description, status, visibility, sort_order } = req.body || {};
    const pool = getPool();

    const { rows: [item] } = await pool.query('SELECT * FROM roadmap_items WHERE id = $1', [req.params.id]);
    if (!item) return reply.code(404).send({ error: 'Item not found' });

    const { rows: [updated] } = await pool.query(
      `UPDATE roadmap_items SET
        title       = COALESCE($1, title),
        description = COALESCE($2, description),
        status      = COALESCE($3, status),
        visibility  = COALESCE($4, visibility),
        sort_order  = COALESCE($5, sort_order)
       WHERE id = $6 RETURNING *`,
      [title ?? null, description ?? null, status ?? null, visibility ?? null, sort_order ?? null, req.params.id]
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
