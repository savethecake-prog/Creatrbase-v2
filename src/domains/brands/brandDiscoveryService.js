'use strict';

// ─── Brand Discovery Service ──────────────────────────────────────────────────
//
// Two responsibilities:
//   1. discoverBrands()   — Calls Haiku to generate a list of real brands in a
//                           given category (+optional keyword). Returns candidates
//                           with confidence scores for the user to select from.
//
//   2. addToWatchlist()   — For selected brands: upserts each into the global
//                           `brands` table (minimal confidence if new), adds a
//                           row to `tenant_brand_watchlist`, and queues contact
//                           discovery so emails appear automatically.
//
// No new npm packages. Uses existing Anthropic SDK + pool + queue.
// ─────────────────────────────────────────────────────────────────────────────

const Anthropic           = require('@anthropic-ai/sdk');
const { getPool }         = require('../../db/pool');
const { getDataCollectionQueue } = require('../../jobs/queue');

const VALID_CATEGORIES = [
  'gaming_hardware', 'gaming_software', 'gaming_nutrition', 'gaming_apparel',
  'd2c_grooming', 'd2c_wellness', 'd2c_tech_accessories', 'publisher', 'other',
];

// ── Slug generation ───────────────────────────────────────────────────────────

function toSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
}

// ── AI brand discovery ────────────────────────────────────────────────────────

/**
 * Calls Haiku to generate brand candidates for a given category + query.
 *
 * @param {object} opts
 * @param {string} opts.category     — One of VALID_CATEGORIES
 * @param {string} [opts.query]      — Optional free-text search term
 * @param {string[]} [opts.existingNames] — Names already in DB (to avoid dupes)
 * @returns {Promise<Array<{name, website, category, programme_notes, confidence}>>}
 */
async function discoverBrands({ category, query, existingNames = [] }) {
  const cat          = VALID_CATEGORIES.includes(category) ? category : 'other';
  const categoryLabel = cat.replace(/_/g, ' ');

  const exclusionHint = existingNames.length > 0
    ? `\nDo NOT include these brands (already tracked): ${existingNames.slice(0, 40).join(', ')}.`
    : '';

  const prompt = `You are a creator marketing intelligence assistant.

Find real brands in the "${categoryLabel}" category that actively run influencer or creator programmes.${
    query ? `\nThe user is searching for: "${query}".` : ''
  }${exclusionHint}

Return ONLY a JSON array of 10-15 brands. Each item must be:
{
  "name": "Official brand name",
  "website": "https://exact-domain.com",
  "category": "one of: gaming_hardware|gaming_software|gaming_nutrition|gaming_apparel|d2c_grooming|d2c_wellness|d2c_tech_accessories|publisher|other",
  "programme_notes": "One sentence about their creator/influencer programme",
  "confidence": "high|medium|low"
}

Rules:
- Only include real, established brands with verifiable creator programmes
- website must be the correct homepage URL (https, no trailing slash, no locale paths)
- confidence: high = large well-known programme; medium = smaller or less certain; low = inferred from public activity
- Do not invent brands
- Return ONLY the raw JSON array — no markdown, no explanation, no preamble`;

  const anthropic = new Anthropic();
  const msg = await anthropic.messages.create({
    model:      'claude-haiku-4-5',
    max_tokens: 1400,
    messages:   [{ role: 'user', content: prompt }],
  });

  const raw   = (msg.content[0]?.text || '').trim();
  const start = raw.indexOf('[');
  const end   = raw.lastIndexOf(']');
  if (start === -1 || end === -1) return [];

  try {
    const parsed = JSON.parse(raw.slice(start, end + 1));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(b => b.name && typeof b.name === 'string' && b.name.trim().length > 1)
      .map(b => ({
        name:             b.name.trim(),
        website:          (b.website || '').trim() || null,
        category:         VALID_CATEGORIES.includes(b.category) ? b.category : cat,
        programme_notes:  (b.programme_notes || '').trim() || null,
        confidence:       ['high', 'medium', 'low'].includes(b.confidence) ? b.confidence : 'medium',
      }));
  } catch {
    return [];
  }
}

// ── Add brands to tenant watchlist ────────────────────────────────────────────

/**
 * For each selected brand candidate:
 *   - Upserts into global `brands` table (creates if not found)
 *   - Adds a row to `tenant_brand_watchlist`
 *   - Queues `contacts:discover` job so emails appear within minutes
 *
 * @param {object} opts
 * @param {string} opts.tenantId
 * @param {Array<{name, website, category, programme_notes, confidence}>} opts.brands
 * @returns {Promise<{added: string[], alreadyTracked: string[]}>}
 */
async function addToWatchlist({ tenantId, brands }) {
  const pool  = getPool();
  const queue = getDataCollectionQueue();
  const added          = [];
  const alreadyTracked = [];

  for (const brand of brands) {
    // 1. Find existing brand by name or website
    const { rows: existing } = await pool.query(
      `SELECT id FROM brands
       WHERE LOWER(brand_name) = LOWER($1)
          OR (website IS NOT NULL AND TRIM(LOWER(website)) = TRIM(LOWER($2)))
       LIMIT 1`,
      [brand.name, brand.website || ''],
    );

    let brandId;

    if (existing.length > 0) {
      brandId = existing[0].id;
    } else {
      // 2. Create new brand record with minimal confidence
      let slug = toSlug(brand.name);

      // Handle slug collision
      const { rows: slugCheck } = await pool.query(
        'SELECT id FROM brands WHERE brand_slug = $1',
        [slug],
      );
      if (slugCheck.length > 0) {
        slug = `${slug}-${Date.now().toString(36)}`;
      }

      const cat = VALID_CATEGORIES.includes(brand.category) ? brand.category : 'other';

      const { rows: inserted } = await pool.query(
        `INSERT INTO brands
           (brand_name, brand_slug, category, website, geo_presence,
            creator_programme_type, registry_confidence, notes, created_by)
         VALUES ($1, $2, $3, $4, '{}', 'unknown', 'minimal', $5, 'user_discovery')
         RETURNING id`,
        [
          brand.name,
          slug,
          cat,
          brand.website || null,
          brand.programme_notes || null,
        ],
      );
      brandId = inserted[0].id;
    }

    // 3. Add to tenant watchlist (skip if already tracked)
    const { rowCount } = await pool.query(
      `INSERT INTO tenant_brand_watchlist (tenant_id, brand_id, source)
       VALUES ($1, $2, 'user_discovery')
       ON CONFLICT (tenant_id, brand_id) DO NOTHING`,
      [tenantId, brandId],
    );

    if (rowCount > 0) {
      // 4. Queue contact discovery for newly added brands
      await queue.add(
        'contacts:discover',
        { tenantId, brandId },
        { attempts: 2, backoff: { type: 'fixed', delay: 5000 } },
      );
      added.push(brandId);
    } else {
      alreadyTracked.push(brandId);
    }
  }

  return { added, alreadyTracked };
}

module.exports = { discoverBrands, addToWatchlist };
