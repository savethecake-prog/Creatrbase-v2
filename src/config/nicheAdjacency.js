'use strict';

// ─── Niche Adjacency Config ───────────────────────────────────────────────────
//
// Maps a creator's primaryNicheCategory (from CreatorNicheProfile) to brand
// categories (from brands.category), expressed as three concentric rings:
//
//   core     — exact fit, brand actively works with this creator type (score 1.0)
//   adjacent — plausible audience overlap, likely creator programme exists (score 0.65)
//   broad    — stretch, different audience but consumer-facing DTC brand (score 0.35)
//
// Brands outside all three rings get score 0.15 (visible only on "show all").
//
// Add new entries here as creator niches and brand categories expand.
// Keys are lowercase, normalised versions of primaryNicheCategory values.
// ─────────────────────────────────────────────────────────────────────────────

const RING_SCORES = {
  core:     1.00,
  adjacent: 0.65,
  broad:    0.35,
  outside:  0.15,
};

// Band labels shown to creators
const BAND_LABELS = {
  core:     'Your niche',
  adjacent: 'Adjacent categories',
  broad:    'Wider reach',
  outside:  'Long shot',
};

// Maps creator niche → brand category rings
const NICHE_MAPS = {
  gaming: {
    core:     ['gaming_hardware', 'gaming_software', 'gaming_nutrition', 'gaming_apparel', 'publisher'],
    adjacent: ['d2c_tech_accessories'],
    broad:    ['d2c_wellness', 'd2c_grooming', 'other'],
  },
  tech: {
    core:     ['d2c_tech_accessories', 'gaming_hardware', 'gaming_software'],
    adjacent: ['publisher', 'gaming_nutrition'],
    broad:    ['gaming_apparel', 'd2c_wellness', 'd2c_grooming', 'other'],
  },
  fitness: {
    core:     ['d2c_wellness', 'gaming_nutrition'],
    adjacent: ['d2c_grooming', 'd2c_tech_accessories'],
    broad:    ['gaming_apparel', 'gaming_hardware', 'publisher', 'other'],
  },
  beauty: {
    core:     ['d2c_grooming', 'd2c_wellness'],
    adjacent: ['d2c_tech_accessories', 'gaming_apparel'],
    broad:    ['gaming_nutrition', 'publisher', 'other'],
  },
  lifestyle: {
    core:     ['d2c_grooming', 'd2c_wellness', 'd2c_tech_accessories'],
    adjacent: ['gaming_nutrition', 'gaming_apparel', 'publisher'],
    broad:    ['gaming_hardware', 'gaming_software', 'other'],
  },
  food: {
    core:     ['gaming_nutrition', 'd2c_wellness'],
    adjacent: ['d2c_grooming', 'd2c_tech_accessories'],
    broad:    ['gaming_hardware', 'gaming_software', 'gaming_apparel', 'publisher', 'other'],
  },
  entertainment: {
    core:     ['publisher', 'gaming_software'],
    adjacent: ['gaming_hardware', 'gaming_nutrition', 'gaming_apparel'],
    broad:    ['d2c_grooming', 'd2c_wellness', 'd2c_tech_accessories', 'other'],
  },
  education: {
    core:     ['publisher', 'd2c_tech_accessories'],
    adjacent: ['gaming_software', 'gaming_hardware'],
    broad:    ['d2c_wellness', 'd2c_grooming', 'gaming_nutrition', 'gaming_apparel', 'other'],
  },
};

// Fallback for unknown niches — treat everything as broad
const FALLBACK_MAP = {
  core:     [],
  adjacent: ['publisher', 'd2c_tech_accessories', 'd2c_wellness'],
  broad:    ['gaming_hardware', 'gaming_software', 'gaming_nutrition', 'gaming_apparel', 'd2c_grooming', 'other'],
};

/**
 * Returns the fit band and score for a brand given a creator's niche.
 *
 * @param {string|null} creatorNicheCategory  e.g. 'gaming', 'fitness'
 * @param {string}      brandCategory         e.g. 'gaming_hardware'
 * @returns {{ band: string, score: number, label: string }}
 */
function getBrandFit(creatorNicheCategory, brandCategory) {
  const key = (creatorNicheCategory || '').toLowerCase().trim();
  const map = NICHE_MAPS[key] || FALLBACK_MAP;

  if (map.core.includes(brandCategory))     return { band: 'core',     score: RING_SCORES.core,     label: BAND_LABELS.core };
  if (map.adjacent.includes(brandCategory)) return { band: 'adjacent', score: RING_SCORES.adjacent, label: BAND_LABELS.adjacent };
  if (map.broad.includes(brandCategory))    return { band: 'broad',    score: RING_SCORES.broad,    label: BAND_LABELS.broad };
  return                                           { band: 'outside',  score: RING_SCORES.outside,  label: BAND_LABELS.outside };
}

/**
 * Returns all band keys in display order.
 */
const BAND_ORDER = ['core', 'adjacent', 'broad', 'outside'];

module.exports = { getBrandFit, BAND_LABELS, BAND_ORDER, RING_SCORES };
