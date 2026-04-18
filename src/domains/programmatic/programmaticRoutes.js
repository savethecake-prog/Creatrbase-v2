'use strict';

const { getPool } = require('../../db/pool');
const { authenticate } = require('../../middleware/authenticate');
const { requireAdmin } = require('../../middleware/requireAdmin');

async function programmaticRoutes(app) {
  const pool = getPool();
  const preHandler = [authenticate, requireAdmin];

  // ── Niche pages ──

  app.get('/api/niche', async () => {
    const { rows } = await pool.query(
      "SELECT id, slug, display_name, meta_description, published_at FROM niche_pages WHERE status = 'published' ORDER BY display_name"
    );
    return { niches: rows };
  });

  app.get('/api/niche/:slug', async (req, reply) => {
    const { rows: [niche] } = await pool.query('SELECT * FROM niche_pages WHERE slug = $1', [req.params.slug]);
    if (!niche) return reply.code(404).send({ error: 'Niche not found' });

    // Fetch CPM benchmarks for this niche
    const { rows: benchmarks } = await pool.query(
      'SELECT * FROM cpm_benchmarks WHERE niche_slug = $1 ORDER BY country, platform, audience_tier', [req.params.slug]
    );

    return { niche, benchmarks };
  });

  app.post('/api/niche', { preHandler }, async (req) => {
    const { slug, display_name, description, typical_brand_categories, analysis_markdown, analysis_html, meta_description, status, published_at } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO niche_pages (slug, display_name, description, typical_brand_categories, analysis_markdown, analysis_html, meta_description, status, published_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [slug, display_name, description || '', typical_brand_categories || [], analysis_markdown || '', analysis_html || '', meta_description || '', status || 'draft', published_at || null]
    );
    return { niche: rows[0] };
  });

  // ── Rate pages ──

  app.get('/api/rates/:country/:niche', async (req, reply) => {
    const { rows: benchmarks } = await pool.query(
      'SELECT * FROM cpm_benchmarks WHERE country = $1 AND niche_slug = $2 ORDER BY platform, audience_tier',
      [req.params.country, req.params.niche]
    );
    if (benchmarks.length < 3) return reply.code(404).send({ error: 'Insufficient data for this combination' });

    const { rows: [niche] } = await pool.query(
      'SELECT display_name, description FROM niche_pages WHERE slug = $1', [req.params.niche]
    );

    return { country: req.params.country, niche_slug: req.params.niche, niche_name: niche?.display_name || req.params.niche, benchmarks };
  });

  // ── CPM benchmarks CRUD (admin) ──

  app.post('/api/cpm-benchmarks', { preHandler }, async (req) => {
    const { niche_slug, platform, country, audience_tier, cpm_low, cpm_high, typical_rate_low, typical_rate_high, currency } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO cpm_benchmarks (niche_slug, platform, country, audience_tier, cpm_low, cpm_high, typical_rate_low, typical_rate_high, currency)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (niche_slug, platform, country, audience_tier) DO UPDATE SET cpm_low=$5, cpm_high=$6, typical_rate_low=$7, typical_rate_high=$8, updated_at=NOW()
       RETURNING *`,
      [niche_slug, platform, country || 'uk', audience_tier, cpm_low, cpm_high, typical_rate_low || null, typical_rate_high || null, currency || 'GBP']
    );
    return { benchmark: rows[0] };
  });

  // ── Threshold pages ──

  app.get('/api/threshold/:slug', async (req, reply) => {
    const { rows: [page] } = await pool.query(
      "SELECT * FROM threshold_pages WHERE slug = $1 AND status = 'published'", [req.params.slug]
    );
    if (!page) return reply.code(404).send({ error: 'Threshold page not found' });
    return { page };
  });

  app.get('/api/threshold', async () => {
    const { rows } = await pool.query(
      "SELECT id, slug, metric_name, title, meta_description FROM threshold_pages WHERE status = 'published' ORDER BY slug"
    );
    return { pages: rows };
  });

  app.post('/api/threshold', { preHandler }, async (req) => {
    const { slug, metric_name, title, meta_description, content_markdown, content_html, status, published_at } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO threshold_pages (slug, metric_name, title, meta_description, content_markdown, content_html, status, published_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [slug, metric_name, title, meta_description || '', content_markdown || '', content_html || '', status || 'draft', published_at || null]
    );
    return { page: rows[0] };
  });

  // ── Research reports ──

  app.get('/api/research/:slug', async (req, reply) => {
    const { rows: [report] } = await pool.query(
      "SELECT * FROM research_reports WHERE slug = $1 AND status = 'published'", [req.params.slug]
    );
    if (!report) return reply.code(404).send({ error: 'Report not found' });
    return { report };
  });

  app.get('/api/research', async () => {
    const { rows } = await pool.query(
      "SELECT id, slug, title, meta_description, published_at FROM research_reports WHERE status = 'published' ORDER BY published_at DESC"
    );
    return { reports: rows };
  });

  app.post('/api/research', { preHandler }, async (req) => {
    const { slug, title, meta_description, summary_markdown, summary_html, key_findings, pdf_url, email_gated, methodology_md, sample_size, period_start, period_end, status, published_at } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO research_reports (slug, title, meta_description, summary_markdown, summary_html, key_findings, pdf_url, email_gated, methodology_md, sample_size, period_start, period_end, status, published_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [slug, title, meta_description, summary_markdown || '', summary_html || '', JSON.stringify(key_findings || []), pdf_url || null, email_gated || false, methodology_md || '', sample_size || null, period_start || null, period_end || null, status || 'draft', published_at || null]
    );
    return { report: rows[0] };
  });
}

module.exports = { programmaticRoutes };
