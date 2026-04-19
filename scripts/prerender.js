#!/usr/bin/env node
// scripts/prerender.js
// Pre-renders public routes against the running Fastify server.
// Produces static HTML files that crawlers can read.
// Run AFTER deploy: node scripts/prerender.js

require('dotenv').config();
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const BASE_URL = process.env.PRERENDER_URL || 'http://localhost:3000';
const DIST_DIR = path.join(__dirname, '..', 'dist', 'client');

// Static public routes to pre-render
const STATIC_ROUTES = [
  '/',
  '/pricing',
  '/scoring-explained',
  '/honesty',
  '/blog',
  '/privacy',
  '/terms',
  '/author/anthony-saulderson',
  '/score',
];

async function getDynamicRoutes() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const blogResult = await pool.query(
      "SELECT slug FROM blog_posts WHERE status = 'published' ORDER BY published_at DESC"
    );
    const compareResult = await pool.query("SELECT slug FROM comparison_pages WHERE status = 'published'");
    const nicheResult = await pool.query("SELECT slug FROM niche_pages WHERE status = 'published'");
    const thresholdResult = await pool.query("SELECT slug FROM threshold_pages WHERE status = 'published'");
    const researchResult = await pool.query("SELECT slug FROM research_reports WHERE status = 'published'");
    const rateResult = await pool.query("SELECT country, niche_slug FROM cpm_benchmarks GROUP BY country, niche_slug HAVING COUNT(*) >= 3");
    return [
      ...blogResult.rows.map(r => `/blog/${r.slug}`),
      ...compareResult.rows.map(r => `/compare/${r.slug}`),
      ...nicheResult.rows.map(r => `/niche/${r.slug}`),
      ...thresholdResult.rows.map(r => `/threshold/${r.slug}`),
      ...researchResult.rows.map(r => `/research/${r.slug}`),
      ...rateResult.rows.map(r => `/rates/${r.country}/${r.niche_slug}`),
    ];
  } catch (err) {
    console.error('[prerender] Failed to fetch dynamic routes:', err.message);
    return [];
  } finally {
    await pool.end();
  }
}

async function prerender() {
  // --route /path flag: render only a single route (used by content publish)
  const singleRouteIdx = process.argv.indexOf('--route');
  const singleRoute = singleRouteIdx !== -1 ? process.argv[singleRouteIdx + 1] : null;

  let allRoutes;
  if (singleRoute) {
    allRoutes = [singleRoute];
  } else {
    const dynamicRoutes = await getDynamicRoutes();
    allRoutes = [...STATIC_ROUTES, ...dynamicRoutes];
  }

  console.log(`[prerender] Pre-rendering ${allRoutes.length} route(s) against ${BASE_URL}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  let success = 0;
  let failed = 0;

  for (const route of allRoutes) {
    try {
      const page = await browser.newPage();
      await page.setUserAgent('CreatrbasePrerender/1.0');

      const url = `${BASE_URL}${route}`;
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

      // Wait a bit more for React to fully render
      await page.waitForFunction(() => {
        return document.querySelector('h1') || document.querySelector('[data-prerender-ready]') || document.querySelector('main');
      }, { timeout: 10000 }).catch(() => {});

      const html = await page.content();
      await page.close();

      // Determine output path
      let outPath;
      if (route === '/') {
        outPath = path.join(DIST_DIR, '_prerendered', 'index.html');
      } else {
        outPath = path.join(DIST_DIR, '_prerendered', route, 'index.html');
      }

      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, html, 'utf8');

      success++;
      console.log(`  rendered  ${route} (${(html.length / 1024).toFixed(1)}kb)`);

    } catch (err) {
      failed++;
      console.error(`  FAILED   ${route}: ${err.message}`);
    }
  }

  await browser.close();

  console.log(`\n[prerender] Done. ${success} rendered, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

prerender();
