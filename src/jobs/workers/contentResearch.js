'use strict';

const { getDataCollectionQueue } = require('../queue');
const { getPool } = require('../../db/pool');
const nblm = require('../../services/notebooklm');

// Search queries per notebook key — delta only, filtered to recent content
const RESEARCH_QUERIES = {
  'seo-distribution': [
    'creator monetisation brand deals influencer marketing site:digiday.com OR site:tubefilter.com OR site:businessofapps.com',
    'YouTube creator brand partnerships CPM rates 2025 2026',
  ],
  'creator-economy': [
    'creator economy brand deals YouTube Twitch independent creators',
    'influencer marketing platform deals creator revenue',
  ],
  'ai-for-creators': [
    'AI tools video creators content creation YouTube',
    'AI video editing AI thumbnail AI script generation creators 2025 2026',
  ],
};

// Brief prompts per notebook key
const BRIEF_PROMPTS = {
  'seo-distribution': `What are the 5 most important and recent developments in creator monetisation, brand deals, and influencer marketing? For each: title, date (if known), why it matters for independent creators, source URL. Exclude anything older than 2 weeks. Be concrete.`,
  'creator-economy': `What are the 5 most important and recent developments in the creator economy, brand partnerships, and creator revenue? For each: title, date (if known), key insight for independent creators, source URL. Exclude anything older than 2 weeks.`,
  'ai-for-creators': `What are the 5 most important and recent AI tools or developments relevant to content creators? For each: tool or development name, date (if known), practical impact for creators, source URL. Exclude anything older than 1 week. AI moves fast — only include genuinely new developments.`,
};

async function refreshCorpus(notebookKey) {
  const pool = getPool();
  const log = (msg) => console.log(`[contentResearch:${notebookKey}] ${msg}`);

  log('Starting corpus refresh');

  // 1. Run research and add sources to NBLM
  const queries = RESEARCH_QUERIES[notebookKey] || [];
  let sourcesAdded = 0;

  for (const query of queries) {
    try {
      log(`Research query: "${query.slice(0, 60)}..."`);
      const result = await nblm.addResearch(notebookKey, query);

      // addResearch may return an array of sources or a single result
      const sources = Array.isArray(result) ? result : (result.sources || []);

      for (const src of sources) {
        if (!src.source_id && !src.id) continue;
        const sourceId = src.source_id || src.id;
        const url = src.url || src.title;

        // Dedup check
        const { rows: existing } = await pool.query(
          'SELECT id FROM content_sources WHERE notebook_key = $1 AND source_id = $2',
          [notebookKey, sourceId]
        );
        if (existing.length > 0) continue;

        const ttlHours = nblm.getSourceTtlHours(notebookKey);
        await pool.query(
          `INSERT INTO content_sources (notebook_key, notebook_id, source_id, url, title, expires_at)
           VALUES ($1, $2, $3, $4, $5, NOW() + $6::interval)
           ON CONFLICT DO NOTHING`,
          [
            notebookKey,
            nblm.NOTEBOOKS[notebookKey],
            sourceId,
            url || null,
            src.title || null,
            `${ttlHours} hours`,
          ]
        );
        sourcesAdded++;
      }
    } catch (err) {
      log(`Research query failed: ${err.message}`);
    }
  }

  log(`Added ${sourcesAdded} new sources`);

  // 2. Prune expired sources
  const { rows: expired } = await pool.query(
    `SELECT source_id FROM content_sources
     WHERE notebook_key = $1 AND removed_at IS NULL AND expires_at < NOW() AND source_id IS NOT NULL`,
    [notebookKey]
  );

  for (const row of expired) {
    try {
      await nblm.deleteSource(notebookKey, row.source_id);
    } catch (err) {
      log(`Failed to delete source ${row.source_id}: ${err.message}`);
    }
    await pool.query(
      'UPDATE content_sources SET removed_at = NOW() WHERE notebook_key = $1 AND source_id = $2',
      [notebookKey, row.source_id]
    );
  }

  if (expired.length > 0) log(`Pruned ${expired.length} expired sources`);

  // 3. Generate and cache brief
  await generateBrief(notebookKey, pool, log);
}

async function generateBrief(notebookKey, pool, log) {
  if (!pool) pool = getPool();
  if (!log) log = (msg) => console.log(`[contentResearch:${notebookKey}] ${msg}`);

  const prompt = BRIEF_PROMPTS[notebookKey];
  if (!prompt) return null;

  try {
    log('Generating brief note');
    const today = new Date().toISOString().slice(0, 10);
    const noteTitle = `brief:${notebookKey}:${today}`;

    const result = await nblm.ask(notebookKey, prompt, {
      saveAsNote: true,
      noteTitle,
      timeoutMs: 120000,
    });

    const noteId = result.note_id || result.id || result.source_id;
    const briefText = result.answer || result.text || '';

    if (noteId) {
      // Store brief_note_id on an active source row for this notebook
      await pool.query(
        `UPDATE content_sources
         SET brief_note_id = $1, brief_generated_at = NOW()
         WHERE id = (
           SELECT id FROM content_sources
           WHERE notebook_key = $2 AND removed_at IS NULL
           ORDER BY added_at DESC LIMIT 1
         )`,
        [noteId, notebookKey]
      );
      log(`Brief cached: note ${noteId}`);
    } else {
      // No note_id returned — store brief text directly in a sentinel row
      await pool.query(
        `INSERT INTO content_sources (notebook_key, notebook_id, title, expires_at, brief_generated_at, brief_note_id)
         VALUES ($1, $2, 'brief-sentinel', NOW() + INTERVAL '7 days', NOW(), $3)
         ON CONFLICT DO NOTHING`,
        [notebookKey, nblm.NOTEBOOKS[notebookKey], briefText.slice(0, 500)]
      );
    }

    return { noteId, briefText };
  } catch (err) {
    log(`Brief generation failed: ${err.message}`);
    return null;
  }
}

async function getBrief(notebookKey) {
  const pool = getPool();

  const { rows: [row] } = await pool.query(
    `SELECT brief_note_id, brief_generated_at
     FROM content_sources
     WHERE notebook_key = $1 AND removed_at IS NULL AND brief_generated_at IS NOT NULL
     ORDER BY brief_generated_at DESC LIMIT 1`,
    [notebookKey]
  );

  if (!row) return null;

  const ttlHours = nblm.getBriefTtlHours(notebookKey);
  const ageHours = (Date.now() - new Date(row.brief_generated_at).getTime()) / 3600000;
  if (ageHours > ttlHours) return null;

  // brief_note_id may be actual NBLM note_id or stored text (sentinel)
  if (row.brief_note_id && row.brief_note_id.length > 40) {
    // Looks like stored text rather than a UUID
    return { text: row.brief_note_id, freshAt: row.brief_generated_at };
  }

  try {
    const fulltext = await nblm.getSourceFulltext(notebookKey, row.brief_note_id);
    return { text: fulltext.content || fulltext.text || '', freshAt: row.brief_generated_at };
  } catch {
    return null;
  }
}

// Map content type to notebook key
const CONTENT_TYPE_NOTEBOOK = {
  blog:       'seo-distribution',
  comparison: 'seo-distribution',
  niche:      'creator-economy',
  threshold:  'seo-distribution',
  research:   'creator-economy',
};

function getNotebookKeyForContentType(contentType) {
  return CONTENT_TYPE_NOTEBOOK[contentType] || 'seo-distribution';
}

async function getOrRefreshBrief(contentType) {
  const notebookKey = getNotebookKeyForContentType(contentType);
  const cached = await getBrief(notebookKey);
  if (cached) return { text: cached.text, freshAt: cached.freshAt, fromCache: true };

  console.log(`[contentResearch] Hot research for ${notebookKey}`);
  await refreshCorpus(notebookKey);

  const fresh = await getBrief(notebookKey);
  return fresh
    ? { text: fresh.text, freshAt: fresh.freshAt, fromCache: false }
    : { text: 'Research not available — proceed with platform data only.', freshAt: new Date(), fromCache: false };
}

function startContentResearchWorkers() {
  const queue = getDataCollectionQueue();

  // Daily corpus refresh: 6am UTC for each notebook
  ['seo-distribution', 'creator-economy', 'ai-for-creators'].forEach((key, i) => {
    const jobName = `content:refresh-corpus:${key}`;
    queue.add(jobName, { notebookKey: key }, {
      repeat: { cron: `0 ${6 + i} * * *` },
      jobId: `${jobName}-recurring`,
    });
    queue.process(jobName, async (job) => {
      await refreshCorpus(job.data.notebookKey);
    });
  });

  // On-demand hot research (queued by session start when brief is stale)
  queue.process('content:hot-research', async (job) => {
    const { notebookKey } = job.data;
    return getOrRefreshBrief(notebookKey);
  });

  // Weekly brief pruning: Sunday 2am
  queue.add('content:prune-briefs', {}, {
    repeat: { cron: '0 2 * * 0' },
    jobId: 'content:prune-briefs-recurring',
  });
  queue.process('content:prune-briefs', async () => {
    const pool = getPool();
    // Delete expired sources across all notebooks
    for (const key of Object.keys(nblm.NOTEBOOKS)) {
      const { rows } = await pool.query(
        `SELECT source_id FROM content_sources
         WHERE notebook_key = $1 AND removed_at IS NULL AND expires_at < NOW() AND source_id IS NOT NULL`,
        [key]
      );
      for (const row of rows) {
        try { await nblm.deleteSource(key, row.source_id); } catch { /* continue */ }
        await pool.query(
          'UPDATE content_sources SET removed_at = NOW() WHERE notebook_key = $1 AND source_id = $2',
          [key, row.source_id]
        );
      }
    }
  });

  console.log('[contentResearch] workers registered (daily 6-8am, on-demand, weekly prune)');
}

module.exports = { startContentResearchWorkers, getOrRefreshBrief, getNotebookKeyForContentType };
