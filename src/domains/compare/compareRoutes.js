'use strict';

const { getPool } = require('../../db/pool');
const { authenticate } = require('../../middleware/authenticate');
const { requireAdmin } = require('../../middleware/requireAdmin');

async function compareRoutes(app) {
  const pool = getPool();

  // GET /api/compare — list all published comparisons
  app.get('/api/compare', async () => {
    const { rows } = await pool.query(
      "SELECT id, slug, competitor_name, title, meta_description, published_at, updated_at FROM comparison_pages WHERE status = 'published' ORDER BY published_at DESC"
    );
    return { comparisons: rows };
  });

  // GET /api/compare/:slug — fetch a single comparison
  app.get('/api/compare/:slug', async (req, reply) => {
    const { rows } = await pool.query(
      'SELECT * FROM comparison_pages WHERE slug = $1', [req.params.slug]
    );
    if (!rows[0]) return reply.code(404).send({ error: 'Comparison not found' });
    return { comparison: rows[0] };
  });

  // POST /api/compare — create (admin only)
  app.post('/api/compare', { preHandler: [authenticate, requireAdmin] }, async (req) => {
    const { slug, competitor_name, competitor_url, title, meta_description, content_markdown, content_html, comparison_table, status, published_at } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO comparison_pages (slug, competitor_name, competitor_url, title, meta_description, content_markdown, content_html, comparison_table, status, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [slug, competitor_name, competitor_url || null, title, meta_description, content_markdown || '', content_html || '', JSON.stringify(comparison_table || []), status || 'draft', published_at || null]
    );
    return { comparison: rows[0] };
  });

  // PATCH /api/compare/:id — update (admin only)
  app.patch('/api/compare/:id', { preHandler: [authenticate, requireAdmin] }, async (req) => {
    const fields = req.body;
    const sets = [];
    const vals = [];
    let i = 1;
    for (const [k, v] of Object.entries(fields)) {
      if (['slug', 'competitor_name', 'competitor_url', 'title', 'meta_description', 'content_markdown', 'content_html', 'status', 'published_at'].includes(k)) {
        sets.push(`${k} = $${i++}`);
        vals.push(v);
      } else if (k === 'comparison_table') {
        sets.push(`comparison_table = $${i++}`);
        vals.push(JSON.stringify(v));
      }
    }
    if (sets.length === 0) return { error: 'No valid fields to update' };
    sets.push(`updated_at = NOW()`);
    vals.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE comparison_pages SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, vals
    );
    return { comparison: rows[0] };
  });
}

module.exports = { compareRoutes };
