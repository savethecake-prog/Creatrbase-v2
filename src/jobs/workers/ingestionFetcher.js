'use strict';

const { getDataCollectionQueue } = require('../queue');
const { getPool } = require('../../db/pool');

/**
 * Ingestion fetcher worker.
 * Runs every 4 hours. Fetches RSS sources, parses items,
 * deduplicates against existing items, inserts new ones.
 */

function startIngestionFetcherWorker() {
  const queue = getDataCollectionQueue();

  // Schedule: every 4 hours
  queue.add('ingestionFetch', {}, {
    repeat: { cron: '0 */4 * * *' },
    jobId: 'ingestionFetch-recurring',
  });

  queue.process('ingestionFetch', async () => {
    const pool = getPool();

    const { rows: sources } = await pool.query(
      'SELECT * FROM ingest_source WHERE active = true ORDER BY priority DESC'
    );

    let totalNew = 0;

    for (const source of sources) {
      try {
        const items = await fetchSource(source);
        let inserted = 0;

        for (const item of items) {
          const result = await pool.query(
            `INSERT INTO ingest_item (source_id, external_id, title, url, published_at, summary, tags)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (source_id, external_id) DO NOTHING
             RETURNING id`,
            [source.id, item.id, item.title, item.url, item.published || null, item.summary || null, item.tags || []]
          );
          if (result.rowCount > 0) inserted++;
        }

        await pool.query(
          'UPDATE ingest_source SET last_fetched_at = NOW(), last_success_at = NOW(), last_error = NULL WHERE id = $1',
          [source.id]
        );

        totalNew += inserted;
      } catch (err) {
        await pool.query(
          'UPDATE ingest_source SET last_fetched_at = NOW(), last_error = $1 WHERE id = $2',
          [err.message, source.id]
        );
        console.error(`[ingestion] Failed to fetch ${source.name}: ${err.message}`);
      }
    }

    console.log(`[ingestion] Fetched ${sources.length} sources, ${totalNew} new items`);
  });

  console.log('[ingestionFetcher] worker registered');
}

/**
 * Fetch and parse a single RSS source.
 * Uses a simple XML regex parser to avoid heavy dependencies.
 */
async function fetchSource(source) {
  if (source.source_type !== 'rss') return [];

  const res = await fetch(source.url, {
    headers: { 'User-Agent': 'Creatrbase-Ingestion/1.0' },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const xml = await res.text();
  return parseRSS(xml);
}

/**
 * Simple RSS/Atom parser. Extracts items/entries with title, link, id, pubDate, description.
 * No external dependency.
 */
function parseRSS(xml) {
  const items = [];

  // Try Atom entries first
  const entryMatches = xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  for (const entry of entryMatches) {
    const title = extractTag(entry, 'title');
    const link = extractAttr(entry, 'link', 'href') || extractTag(entry, 'link');
    const id = extractTag(entry, 'id') || link;
    const published = extractTag(entry, 'published') || extractTag(entry, 'updated');
    const summary = extractTag(entry, 'summary') || extractTag(entry, 'content');

    if (title && (link || id)) {
      items.push({
        id: id || link,
        title: stripHtml(title).slice(0, 500),
        url: link || '',
        published: published ? new Date(published) : null,
        summary: summary ? stripHtml(summary).slice(0, 1000) : null,
        tags: [],
      });
    }
  }

  if (items.length > 0) return items;

  // Fall back to RSS items
  const itemMatches = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const item of itemMatches) {
    const title = extractTag(item, 'title');
    const link = extractTag(item, 'link');
    const guid = extractTag(item, 'guid') || link;
    const pubDate = extractTag(item, 'pubDate');
    const description = extractTag(item, 'description');
    const categories = (item.match(/<category[^>]*>([\s\S]*?)<\/category>/gi) || [])
      .map(c => stripHtml(c.replace(/<\/?category[^>]*>/gi, '')).trim())
      .filter(Boolean);

    if (title && (link || guid)) {
      items.push({
        id: guid || link,
        title: stripHtml(title).slice(0, 500),
        url: link || '',
        published: pubDate ? new Date(pubDate) : null,
        summary: description ? stripHtml(description).slice(0, 1000) : null,
        tags: categories.slice(0, 10),
      });
    }
  }

  return items;
}

function extractTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  if (!match) return null;
  return match[1].replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim();
}

function extractAttr(xml, tag, attr) {
  const match = xml.match(new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`, 'i'));
  return match ? match[1] : null;
}

function stripHtml(str) {
  return str.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

module.exports = { startIngestionFetcherWorker };
