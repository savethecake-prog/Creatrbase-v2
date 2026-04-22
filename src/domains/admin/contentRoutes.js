'use strict';

const { v4: uuidv4 } = require('uuid');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const path = require('path');

const { getPool } = require('../../db/pool');
const { getPrisma } = require('../../lib/prisma');
const { authenticate } = require('../../middleware/authenticate');
const { requireAdmin } = require('../../middleware/requireAdmin');
const { handleSessionMessage, endSession } = require('../../agents/content/runner');
const { getOrRefreshBrief, getNotebookKeyForContentType } = require('../../jobs/workers/contentResearch');
const { markdownToHtml } = require('../../lib/markdownToHtml');

const PRERENDER_SCRIPT = path.join(__dirname, '../../../scripts/prerender.js');

async function triggerPrerender(route) {
  try {
    await execFileAsync('node', [PRERENDER_SCRIPT, '--route', route], { timeout: 60000 });
    console.log(`[contentRoutes] Prerendered ${route}`);
  } catch (err) {
    console.warn(`[contentRoutes] Prerender failed for ${route}: ${err.message}`);
  }
}

async function logAdminAction(pool, actorUserId, actionType, actionTarget, metadata = {}) {
  try {
    await pool.query(
      `INSERT INTO admin_action_log (actor_user_id, action_type, action_target, metadata)
       VALUES ($1, $2, $3, $4)`,
      [actorUserId, actionType, actionTarget, JSON.stringify(metadata)]
    );
  } catch { /* non-fatal */ }
}

async function contentRoutes(app) {
  const pool = getPool();
  const prisma = getPrisma();
  const preHandler = [authenticate, requireAdmin];

  // ── List all content ──────────────────────────────────────────────────────

  app.get('/api/admin/content', { preHandler }, async (req) => {
    const { type, status, search, offset = 0, limit = 50 } = req.query;
    const off = Number(offset);
    const lim = Math.min(Number(limit), 100);

    const results = [];

    // Blog (Prisma)
    if (!type || type === 'blog') {
      const where = { ...(status ? { status } : {}), ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}) };
      const posts = await prisma.blogPost.findMany({
        where,
        select: { id: true, slug: true, title: true, status: true, publishedAt: true, updatedAt: true, excerpt: true },
        orderBy: { updatedAt: 'desc' },
        take: lim,
        skip: off,
      });
      results.push(...posts.map(p => ({ ...p, type: 'blog', url: `/blog/${p.slug}` })));
    }

    // Raw SQL content types
    const sqlTypes = [
      { key: 'comparison', table: 'comparison_pages', urlPrefix: '/compare' },
      { key: 'niche',      table: 'niche_pages',      urlPrefix: '/niche' },
      { key: 'threshold',  table: 'threshold_pages',  urlPrefix: '/threshold' },
      { key: 'research',   table: 'research_reports', urlPrefix: '/research' },
    ];

    for (const { key, table, urlPrefix } of sqlTypes) {
      if (type && type !== key) continue;
      const params = [];
      let where = 'WHERE 1=1';
      if (status) { params.push(status); where += ` AND status = $${params.length}`; }
      if (search) { params.push(`%${search}%`); where += ` AND title ILIKE $${params.length}`; }
      params.push(lim, off);
      const { rows } = await pool.query(
        `SELECT id, slug, title, status, published_at AS "publishedAt", updated_at AS "updatedAt" FROM ${table} ${where} ORDER BY updated_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );
      results.push(...rows.map(r => ({ ...r, type: key, url: `${urlPrefix}/${r.slug}` })));
    }

    results.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    return { items: results.slice(0, lim), offset: off, limit: lim };
  });

  // ── Session management ─────────────────────────────────────────────────────

  app.post('/api/admin/content/session/start', { preHandler }, async (req, reply) => {
    const { content_type, content_id } = req.body || {};
    if (!content_type) return reply.code(400).send({ error: 'content_type required' });

    // Get or refresh research brief
    let brief = null;
    try {
      const result = await getOrRefreshBrief(content_type);
      brief = result.text;
    } catch (err) {
      console.warn(`[contentRoutes] Brief fetch failed: ${err.message}`);
    }

    const sessionId = uuidv4();
    await pool.query(
      `INSERT INTO content_sessions (id, content_type, content_id, brief_used, created_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [sessionId, content_type, content_id || null, brief || null, req.user.email || req.user.userId]
    );

    return { sessionId, brief, contentType: content_type };
  });

  app.get('/api/admin/content/session/:id', { preHandler }, async (req, reply) => {
    const { rows: [session] } = await pool.query('SELECT * FROM content_sessions WHERE id = $1', [req.params.id]);
    if (!session) return reply.code(404).send({ error: 'Session not found' });
    return { session };
  });

  app.post('/api/admin/content/session/:id/message', { preHandler }, async (req, reply) => {
    const { message } = req.body || {};
    if (!message) return reply.code(400).send({ error: 'message required' });

    const { rows: [session] } = await pool.query(
      "SELECT id, content_type, status FROM content_sessions WHERE id = $1",
      [req.params.id]
    );
    if (!session) return reply.code(404).send({ error: 'Session not found' });
    if (session.status !== 'active') return reply.code(400).send({ error: 'Session is not active' });

    const result = await handleSessionMessage(req.params.id, message);
    return result;
  });

  app.post('/api/admin/content/session/:id/end', { preHandler }, async (req) => {
    await endSession(req.params.id);
    return { ended: true };
  });

  // ── Publish ───────────────────────────────────────────────────────────────

  app.post('/api/admin/content/session/:id/publish', { preHandler }, async (req, reply) => {
    const { rows: [session] } = await pool.query('SELECT * FROM content_sessions WHERE id = $1', [req.params.id]);
    if (!session) return reply.code(404).send({ error: 'Session not found' });
    if (!session.current_draft) return reply.code(400).send({ error: 'No draft to publish. Use save_draft tool first.' });

    const draft = session.current_draft;
    const { content_type, fields } = draft;
    if (!fields?.slug) return reply.code(400).send({ error: 'Draft is missing slug' });

    try {
      let url;

      if (content_type === 'blog') {
        url = await publishBlog(prisma, pool, fields, session, req.user.userId);
      } else {
        url = await publishGeneric(pool, content_type, fields, session);
      }

      await pool.query("UPDATE content_sessions SET status = 'completed', updated_at = NOW() WHERE id = $1", [session.id]);
      await logAdminAction(pool, req.user.userId, 'content_publish', `${content_type}:${fields.slug}`, { content_type, url });

      // Trigger prerender in background — don't block response
      triggerPrerender(url).catch(() => {});

      return { published: true, url, content_type, slug: fields.slug };
    } catch (err) {
      if (err.code === '23505' || err.message?.includes('unique')) {
        return reply.code(409).send({ error: `Slug "${fields.slug}" is already in use` });
      }
      throw err;
    }
  });

  // ── Get existing content item for edit session ────────────────────────────

  app.get('/api/admin/content/:type/:id', { preHandler }, async (req, reply) => {
    const { type, id } = req.params;

    if (type === 'blog') {
      const post = await prisma.blogPost.findUnique({ where: { id }, include: { category: true } });
      if (!post) return reply.code(404).send({ error: 'Not found' });
      return { item: post };
    }

    const tables = { comparison: 'comparison_pages', niche: 'niche_pages', threshold: 'threshold_pages', research: 'research_reports' };
    const table = tables[type];
    if (!table) return reply.code(400).send({ error: 'Unknown content type' });

    const { rows: [item] } = await pool.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
    if (!item) return reply.code(404).send({ error: 'Not found' });
    return { item };
  });
}

// ── Publish helpers ──────────────────────────────────────────────────────────

async function publishBlog(prisma, pool, fields, session, actorUserId) {
  const {
    slug, title, excerpt, body_markdown, category_slug,
    meta_description, reading_time_min, cover_image_url,
  } = fields;

  const bodyHtml = markdownToHtml(body_markdown || '');

  let categoryId = null;
  if (category_slug) {
    const cat = await prisma.blogCategory.findFirst({ where: { slug: category_slug } });
    categoryId = cat?.id || null;
  }

  if (session.content_id) {
    // Update existing post
    await prisma.blogPost.update({
      where: { id: session.content_id },
      data: {
        title, excerpt, bodyMarkdown: body_markdown, bodyHtml,
        categoryId, status: 'published', publishedAt: new Date(),
        readingTimeMin: reading_time_min ? Number(reading_time_min) : null,
        coverImageUrl: cover_image_url || null,
      },
    });
  } else {
    await prisma.blogPost.create({
      data: {
        slug, title, excerpt, bodyMarkdown: body_markdown, bodyHtml,
        categoryId, authorName: 'Creatrbase',
        status: 'published', publishedAt: new Date(),
        readingTimeMin: reading_time_min ? Number(reading_time_min) : null,
        coverImageUrl: cover_image_url || null,
      },
    });
  }

  return `/blog/${slug}`;
}

async function publishGeneric(pool, content_type, fields, session) {
  const tableMap = {
    comparison: 'comparison_pages',
    niche:      'niche_pages',
    threshold:  'threshold_pages',
    research:   'research_reports',
  };
  const urlPrefixMap = {
    comparison: '/compare',
    niche:      '/niche',
    threshold:  '/threshold',
    research:   '/research',
  };

  const table = tableMap[content_type];
  const urlPrefix = urlPrefixMap[content_type];

  const colMap = {
    comparison: {
      cols: ['slug', 'title', 'competitor_name', 'competitor_url', 'content_markdown', 'content_html', 'comparison_table', 'meta_description', 'status', 'published_at'],
      vals: (f) => [f.slug, f.title, f.competitor_name, f.competitor_url, f.content_markdown, markdownToHtml(f.content_markdown || ''), JSON.stringify(f.comparison_table || []), f.meta_description, 'published', new Date()],
    },
    niche: {
      cols: ['slug', 'display_name', 'description', 'typical_brand_categories', 'analysis_markdown', 'analysis_html', 'meta_description', 'status', 'published_at'],
      vals: (f) => [f.slug, f.display_name, f.description || '', f.typical_brand_categories || [], f.analysis_markdown, markdownToHtml(f.analysis_markdown || ''), f.meta_description, 'published', new Date()],
    },
    threshold: {
      cols: ['slug', 'metric_name', 'title', 'content_markdown', 'content_html', 'meta_description', 'status', 'published_at'],
      vals: (f) => [f.slug, f.metric_name, f.title, f.content_markdown, markdownToHtml(f.content_markdown || ''), f.meta_description, 'published', new Date()],
    },
    research: {
      cols: ['slug', 'title', 'summary_markdown', 'summary_html', 'key_findings', 'meta_description', 'status', 'published_at'],
      vals: (f) => [f.slug, f.title, f.summary_markdown, markdownToHtml(f.summary_markdown || ''), JSON.stringify(f.key_findings || []), f.meta_description, 'published', new Date()],
    },
  };

  const { cols, vals } = colMap[content_type];
  const values = vals(fields);
  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

  if (session.content_id) {
    const setClauses = cols.filter(c => c !== 'slug').map((c, i) => `${c} = $${i + 1}`).join(', ');
    const updateValues = values.filter((_, i) => cols[i] !== 'slug');
    updateValues.push(session.content_id);
    await pool.query(
      `UPDATE ${table} SET ${setClauses}, updated_at = NOW() WHERE id = $${updateValues.length}`,
      updateValues
    );
  } else {
    await pool.query(
      `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`,
      values
    );
  }

  return `${urlPrefix}/${fields.slug}`;
}

module.exports = { contentRoutes };
