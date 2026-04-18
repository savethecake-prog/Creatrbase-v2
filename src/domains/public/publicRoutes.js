'use strict';

const { resolveChannelId, getPublicChannelStats } = require('../../services/publicYoutube');
const { getPrisma } = require('../../lib/prisma');

const BASE_URL = 'https://creatrbase.com';

const STATIC_PAGES = [
  { url: '/',                  changefreq: 'weekly',  priority: '1.0' },
  { url: '/scoring-explained', changefreq: 'monthly', priority: '0.8' },
  { url: '/blog',              changefreq: 'daily',   priority: '0.9' },
  { url: '/pricing',           changefreq: 'monthly', priority: '0.8' },
  { url: '/honesty',           changefreq: 'monthly', priority: '0.6' },
  { url: '/score',             changefreq: 'monthly', priority: '0.8' },
  { url: '/author/anthony-saulderson', changefreq: 'monthly', priority: '0.6' },
  { url: '/privacy',           changefreq: 'yearly',  priority: '0.3' },
  { url: '/terms',             changefreq: 'yearly',  priority: '0.3' },
];

function xmlEscape(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function publicRoutes(app) {
  const prisma = getPrisma();

  // GET /sitemap.xml
  app.get('/sitemap.xml', async (_request, reply) => {
    let blogPosts = [];
    let comparisons = [];
    try {
      blogPosts = await prisma.blogPost.findMany({
        where:   { status: 'published' },
        orderBy: { publishedAt: 'desc' },
        select:  { slug: true, publishedAt: true, updatedAt: true },
      });
    } catch (_) {}
    try {
      const { getPool } = require('../../db/pool');
      const pool = getPool();
      const result = await pool.query("SELECT slug, updated_at FROM comparison_pages WHERE status = 'published'");
      comparisons = result.rows;
    } catch (_) {}

    const urls = [
      ...STATIC_PAGES.map(p => ({
        loc:        `${BASE_URL}${p.url}`,
        changefreq: p.changefreq,
        priority:   p.priority,
        lastmod:    new Date().toISOString().slice(0, 10),
      })),
      ...blogPosts.map(p => ({
        loc:        `${BASE_URL}/blog/${xmlEscape(p.slug)}`,
        changefreq: 'monthly',
        priority:   '0.7',
        lastmod:    (p.updatedAt || p.publishedAt || new Date()).toISOString().slice(0, 10),
      })),
      ...comparisons.map(c => ({
        loc:        `${BASE_URL}/compare/${xmlEscape(c.slug)}`,
        changefreq: 'monthly',
        priority:   '0.8',
        lastmod:    (c.updated_at || new Date()).toISOString().slice(0, 10),
      })),
    ];

    // Programmatic pages
    try {
      const nicheRes = await pool.query("SELECT slug, updated_at FROM niche_pages WHERE status = 'published'");
      nicheRes.rows.forEach(r => urls.push({ loc: `${BASE_URL}/niche/${xmlEscape(r.slug)}`, changefreq: 'monthly', priority: '0.6', lastmod: (r.updated_at || new Date()).toISOString().slice(0, 10) }));
      const thresholdRes = await pool.query("SELECT slug, updated_at FROM threshold_pages WHERE status = 'published'");
      thresholdRes.rows.forEach(r => urls.push({ loc: `${BASE_URL}/threshold/${xmlEscape(r.slug)}`, changefreq: 'monthly', priority: '0.6', lastmod: (r.updated_at || new Date()).toISOString().slice(0, 10) }));
      const researchRes = await pool.query("SELECT slug, updated_at FROM research_reports WHERE status = 'published'");
      researchRes.rows.forEach(r => urls.push({ loc: `${BASE_URL}/research/${xmlEscape(r.slug)}`, changefreq: 'monthly', priority: '0.8', lastmod: (r.updated_at || new Date()).toISOString().slice(0, 10) }));
      const rateRes = await pool.query("SELECT country, niche_slug, MAX(updated_at) as updated_at FROM cpm_benchmarks GROUP BY country, niche_slug HAVING COUNT(*) >= 3");
      rateRes.rows.forEach(r => urls.push({ loc: `${BASE_URL}/rates/${xmlEscape(r.country)}/${xmlEscape(r.niche_slug)}`, changefreq: 'monthly', priority: '0.6', lastmod: (r.updated_at || new Date()).toISOString().slice(0, 10) }));
    } catch (_) {}

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...urls.map(u =>
        `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
      ),
      '</urlset>',
    ].join('\n');

    return reply.type('application/xml').send(xml);
  });

  // GET /api/public/youtube-check?url=...
  app.get('/api/public/youtube-check', async (request, reply) => {
    const { url } = request.query;
    if (!url) return reply.code(400).send({ error: 'URL is required' });

    try {
      const apiKey = process.env.YOUTUBE_API_KEY;
      if (!apiKey) throw new Error('Server misconfiguration: YOUTUBE_API_KEY missing');

      const channelId = await resolveChannelId(url, apiKey);
      const stats = await getPublicChannelStats(channelId, apiKey);

      const tiers = [
        { name: 'Emerging', subs: 500, views: 100 },
        { name: 'Giftable', subs: 2000, views: 500 },
        { name: 'Paid Viable', subs: 10000, views: 2500 },
        { name: 'Agency Ready', subs: 50000, views: 10000 }
      ];

      let targetTier = tiers.find(t => stats.subscriberCount < t.subs || stats.avgViewsLast15 < t.views) || tiers[tiers.length - 1];
      const subProgress = Math.min(1, stats.subscriberCount / targetTier.subs);
      const viewProgress = Math.min(1, (stats.avgViewsLast15 || 0) / targetTier.views);
      const overallScore = Math.round(((subProgress + viewProgress) / 2) * 100);

      let insight = '';
      if (stats.subscriberCount < targetTier.subs) {
        const diff = targetTier.subs - stats.subscriberCount;
        insight = `You're just ${diff.toLocaleString()} subscribers away from the '${targetTier.name}' milestone.`;
      } else {
        const diff = targetTier.views - (stats.avgViewsLast15 || 0);
        insight = `Your consistency is key. Add ~${diff.toLocaleString()} average views per video to unlock '${targetTier.name}' opportunities.`;
      }

      return {
        success: true,
        channel: { title: stats.title, thumbnail: stats.thumbnail, subscribers: stats.subscriberCount, avgViews: stats.avgViewsLast15 },
        score: overallScore,
        targetTier: targetTier.name,
        insight
      };
    } catch (err) {
      request.log.error(err);
      return reply.code(err.statusCode || 500).send({ success: false, error: err.message || 'Failed to analyze channel' });
    }
  });

  // POST /api/public/signal — distribution signal logging
  const signalRateLimit = {};
  app.post('/api/public/signal', async (request, reply) => {
    const { signal_type, vector, source_surface, signal_payload } = request.body || {};
    if (!signal_type || !vector || !source_surface) {
      return reply.code(400).send({ error: 'signal_type, vector, source_surface required' });
    }

    const ip = request.headers['x-real-ip'] || request.ip;
    const now = Date.now();
    const key = ip + ':signal';
    if (!signalRateLimit[key]) signalRateLimit[key] = [];
    signalRateLimit[key] = signalRateLimit[key].filter(t => t > now - 60000);
    if (signalRateLimit[key].length >= 10) {
      return reply.code(429).send({ error: 'Rate limited' });
    }
    signalRateLimit[key].push(now);

    await prisma.distributionSignal.create({
      data: {
        signalType:    signal_type,
        vector:        vector,
        sourceSurface: source_surface,
        signalPayload: signal_payload || {},
      },
    });

    return { ok: true };
  });
}

module.exports = publicRoutes;
