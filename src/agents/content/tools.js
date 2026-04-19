'use strict';

const { getPool } = require('../../db/pool');
const { getPrisma } = require('../../lib/prisma');
const nblm = require('../../services/notebooklm');
const { getNotebookKeyForContentType } = require('../../jobs/workers/contentResearch');

const TOOL_DEFINITIONS = [
  {
    name: 'get_cpm_benchmarks',
    description: 'Get CPM and rate benchmarks for a niche. Returns real data from Creatrbase\'s benchmark table. Use this when writing about creator earnings, niche value, or rate expectations.',
    input_schema: {
      type: 'object',
      properties: {
        niche_slug: { type: 'string', description: 'Niche slug e.g. "gaming", "personal-finance", "beauty"' },
        country: { type: 'string', description: 'ISO country code e.g. "gb", "us". Omit for all countries.' },
      },
      required: ['niche_slug'],
    },
  },
  {
    name: 'get_niche_data',
    description: 'Get full niche page data including description, typical brand categories, and anonymised signal stats. Use when writing niche pages or any content specific to a creator niche.',
    input_schema: {
      type: 'object',
      properties: {
        niche_slug: { type: 'string', description: 'Niche slug' },
      },
      required: ['niche_slug'],
    },
  },
  {
    name: 'list_published_content',
    description: 'List published content items for internal linking suggestions. Returns titles and slugs.',
    input_schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['blog', 'comparison', 'niche', 'threshold', 'research', 'all'], description: 'Content type to list. Use "all" for everything.' },
        limit: { type: 'number', description: 'Max items to return', default: 30 },
      },
    },
  },
  {
    name: 'get_platform_stats',
    description: 'Get real Creatrbase platform statistics: creator count, confirmed deals, niche coverage, signal events. Use to make factual claims about the platform.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_voice_memory',
    description: 'Get editorial voice memory entries — Anthony\'s confirmed positions on topics. Always read this before writing to ensure content reflects established positions.',
    input_schema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Filter by topic keyword (optional)' },
      },
    },
  },
  {
    name: 'save_draft',
    description: 'Save the current structured draft. Call this when you have a complete or near-complete draft ready for review. The draft will appear in the Draft Preview tab.',
    input_schema: {
      type: 'object',
      properties: {
        content_type: { type: 'string', enum: ['blog', 'comparison', 'niche', 'threshold', 'research'] },
        fields: {
          type: 'object',
          description: 'Content-type-specific fields. Blog: {title, slug, excerpt, body_markdown, category_slug, meta_description, reading_time_min}. Comparison: {title, slug, competitor_name, competitor_url, content_markdown, comparison_table, meta_description}. Niche: {slug, display_name, description, typical_brand_categories, analysis_markdown, meta_description}. Threshold: {slug, metric_name, title, content_markdown, meta_description}. Research: {slug, title, summary_markdown, key_findings, meta_description}.',
        },
      },
      required: ['content_type', 'fields'],
    },
  },
  {
    name: 'search_research',
    description: 'Search the research corpus for this topic. Ask a specific question to get a synthesised answer from current sources. Use this for fact-checking, finding recent examples, or getting specific data points.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Specific question to ask the research corpus' },
        content_type: { type: 'string', description: 'Content type being drafted (determines which notebook to query)' },
      },
      required: ['query', 'content_type'],
    },
  },
];

const TOOL_HANDLERS = {
  async get_cpm_benchmarks({ niche_slug, country }) {
    const pool = getPool();
    const params = [niche_slug];
    let sql = 'SELECT platform, country, audience_tier, cpm_low, cpm_high, typical_rate_low, typical_rate_high, currency, source FROM cpm_benchmarks WHERE niche_slug = $1';
    if (country) {
      sql += ' AND country = $2';
      params.push(country);
    }
    sql += ' ORDER BY country, platform, audience_tier';
    const { rows } = await pool.query(sql, params);
    return { niche_slug, benchmarks: rows, count: rows.length };
  },

  async get_niche_data({ niche_slug }) {
    const pool = getPool();
    const { rows: [niche] } = await pool.query('SELECT * FROM niche_pages WHERE slug = $1', [niche_slug]);
    if (!niche) return { error: `Niche "${niche_slug}" not found` };

    const { rows: signals } = await pool.query(
      `SELECT COUNT(*) as deal_count, AVG((payload->>'agreedRate')::numeric) as avg_rate
       FROM signal_events se
       JOIN brand_creator_interactions bci ON se.source_interaction_id = bci.id
       WHERE se.signal_type = 'deal_closed' AND se.status = 'applied'
       AND bci.niche = $1`,
      [niche_slug]
    );

    return { niche, signal_stats: signals[0] };
  },

  async list_published_content({ type = 'all', limit = 30 }) {
    const pool = getPool();
    const prisma = getPrisma();
    const results = [];

    if (type === 'all' || type === 'blog') {
      const posts = await prisma.blogPost.findMany({
        where: { status: 'published' },
        select: { slug: true, title: true, publishedAt: true },
        orderBy: { publishedAt: 'desc' },
        take: limit,
      });
      results.push(...posts.map(p => ({ type: 'blog', slug: `/blog/${p.slug}`, title: p.title })));
    }

    const tables = { comparison: 'comparison_pages', niche: 'niche_pages', threshold: 'threshold_pages', research: 'research_reports' };
    for (const [t, table] of Object.entries(tables)) {
      if (type !== 'all' && type !== t) continue;
      const { rows } = await pool.query(
        `SELECT slug, title, published_at FROM ${table} WHERE status = 'published' ORDER BY published_at DESC LIMIT $1`,
        [limit]
      );
      results.push(...rows.map(r => ({ type: t, slug: `/${t === 'niche' ? 'niche' : t === 'comparison' ? 'compare' : t === 'threshold' ? 'threshold' : 'research'}/${r.slug}`, title: r.title })));
    }

    return { items: results.slice(0, limit) };
  },

  async get_platform_stats() {
    const pool = getPool();
    const { rows } = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM creators) AS creator_count,
        (SELECT COUNT(*) FROM signal_events WHERE signal_type = 'deal_closed' AND status = 'applied') AS confirmed_deals,
        (SELECT COUNT(DISTINCT niche_slug) FROM cpm_benchmarks) AS niches_covered,
        (SELECT COUNT(*) FROM signal_events WHERE status = 'applied') AS total_signals,
        (SELECT COUNT(*) FROM blog_posts WHERE status = 'published') AS published_articles
    `);
    return rows[0];
  },

  async get_voice_memory({ topic }) {
    const pool = getPool();
    let sql = "SELECT topic, position, context, confidence, source FROM voice_memory WHERE deprecated_at IS NULL";
    const params = [];
    if (topic) {
      sql += ' AND topic ILIKE $1';
      params.push(`%${topic}%`);
    }
    sql += ' ORDER BY confidence DESC, created_at DESC LIMIT 50';
    const { rows } = await pool.query(sql, params);
    return { entries: rows };
  },

  async save_draft({ content_type, fields }, ctx) {
    const pool = getPool();
    await pool.query(
      'UPDATE content_sessions SET current_draft = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify({ content_type, fields, saved_at: new Date().toISOString() }), ctx.sessionId]
    );
    return { saved: true, content_type, slug: fields.slug || null };
  },

  async search_research({ query, content_type }) {
    const notebookKey = getNotebookKeyForContentType(content_type);
    try {
      const result = await nblm.ask(notebookKey, query, { timeoutMs: 60000 });
      return { answer: result.answer || result.text || JSON.stringify(result) };
    } catch (err) {
      return { error: `Research query failed: ${err.message}` };
    }
  },
};

module.exports = { TOOL_DEFINITIONS, TOOL_HANDLERS };
