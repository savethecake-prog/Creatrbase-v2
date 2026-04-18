#!/usr/bin/env node
// scripts/audit-internal-links.js
// Audits internal linking across all published content pages.
// Produces a Markdown report.

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DOMAIN = 'creatrbase.com';
const LINK_RE = /href=["'](https?:\/\/creatrbase\.com)?(\/(blog|compare|niche|rates|threshold|research|scoring-explained|pricing|honesty|score|author)[^\s"'#]*)/gi;

async function audit() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // Fetch all published content
  const [blogRes, compareRes] = await Promise.all([
    pool.query("SELECT slug, title, body_html as html FROM blog_posts WHERE status = 'published'"),
    pool.query("SELECT slug, title, content_html as html FROM comparison_pages WHERE status = 'published'"),
  ]);

  const pages = [
    ...blogRes.rows.map(r => ({ type: 'blog', slug: r.slug, title: r.title, path: `/blog/${r.slug}`, html: r.html || '' })),
    ...compareRes.rows.map(r => ({ type: 'compare', slug: r.slug, title: r.title, path: `/compare/${r.slug}`, html: r.html || '' })),
  ];

  // Build link graph
  const graph = {};
  for (const page of pages) {
    const outbound = [];
    let match;
    const re = new RegExp(LINK_RE.source, 'gi');
    while ((match = re.exec(page.html)) !== null) {
      const linkPath = match[2].replace(/\/$/, '') || '/';
      if (linkPath !== page.path) outbound.push(linkPath);
    }
    graph[page.path] = { type: page.type, title: page.title, outbound: [...new Set(outbound)] };
  }

  // Calculate inbound links
  for (const pagePath of Object.keys(graph)) {
    graph[pagePath].inbound = [];
  }
  for (const [sourcePath, data] of Object.entries(graph)) {
    for (const target of data.outbound) {
      if (graph[target]) {
        graph[target].inbound.push(sourcePath);
      }
    }
  }

  // Run checks
  const issues = [];
  for (const [pagePath, data] of Object.entries(graph)) {
    if (data.type === 'blog') {
      if (data.outbound.length < 3) {
        issues.push({ page: pagePath, issue: `Only ${data.outbound.length} outbound internal links (needs >= 3)`, severity: 'high' });
      }
      if (data.inbound.length < 2) {
        issues.push({ page: pagePath, issue: `Only ${data.inbound.length} inbound links from other articles (needs >= 2)`, severity: 'high' });
      }
    }
    if (data.type === 'compare') {
      const linksToScoring = data.outbound.some(l => l.includes('scoring'));
      if (!linksToScoring) {
        issues.push({ page: pagePath, issue: 'No link to /scoring-explained', severity: 'medium' });
      }
    }

    // Word count check (rough)
    const wordCount = (data.html || '').replace(/<[^>]+>/g, '').split(/\s+/).length;
    const linkDensity = wordCount > 0 ? data.outbound.length / (wordCount / 1500) : 0;
    if (linkDensity > 8) {
      issues.push({ page: pagePath, issue: `Too many links: ${data.outbound.length} links in ~${wordCount} words (max 8 per 1500 words)`, severity: 'low' });
    }
  }

  // Generate report
  const report = [
    '# Internal Link Audit Report',
    `Date: ${new Date().toISOString().slice(0, 10)}`,
    `Pages audited: ${pages.length}`,
    '',
    '## Summary',
    `- Total pages: ${pages.length}`,
    `- Total issues: ${issues.length}`,
    `- High severity: ${issues.filter(i => i.severity === 'high').length}`,
    `- Medium severity: ${issues.filter(i => i.severity === 'medium').length}`,
    '',
    '## Issues',
    ...issues.map(i => `- **[${i.severity.toUpperCase()}]** \`${i.page}\`: ${i.issue}`),
    '',
    '## Per-page breakdown',
    ...Object.entries(graph).map(([pagePath, data]) => [
      `### ${data.title}`,
      `Path: \`${pagePath}\``,
      `Outbound links (${data.outbound.length}): ${data.outbound.join(', ') || 'none'}`,
      `Inbound links (${data.inbound.length}): ${data.inbound.join(', ') || 'none'}`,
      '',
    ].join('\n')),
  ].join('\n');

  const outPath = `/tmp/internal-link-audit-${new Date().toISOString().slice(0, 10)}.md`;
  fs.writeFileSync(outPath, report, 'utf8');
  console.log(`Report written to ${outPath}`);
  console.log(`${pages.length} pages audited, ${issues.length} issues found.`);

  await pool.end();
}

audit().catch(err => { console.error(err); process.exit(1); });
