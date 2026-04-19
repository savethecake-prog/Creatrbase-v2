'use strict';

const { getPool } = require('../db/pool');

// Weighted factors that determine how much to trust a captured signal.
// Same algebraic approach as the scoring engine: measure what we can, infer the rest.
const WEIGHTS = {
  corroboration: 0.35,
  recency: 0.25,
  completeness: 0.25,
  sourceType: 0.15,
};

function recencyScore(date) {
  if (!date) return 0.2;
  const ageDays = (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays < 7) return 1.0;
  if (ageDays < 30) return 0.8;
  if (ageDays < 90) return 0.6;
  if (ageDays < 180) return 0.4;
  return 0.2;
}

function completenessScore(row, requiredFields) {
  const present = requiredFields.filter((f) => row[f] != null).length;
  return present / requiredFields.length;
}

// deal_closed: strongest signal — a completed negotiation with a rate agreed.
// Required fields reflect the variables the scoring model depends on.
async function dealClosedQuality(row, pool) {
  const requiredFields = [
    'agreed_rate',
    'offered_rate',
    'deliverable_type',
    'rate_currency',
    'niche',
    'brand_id',
  ];

  // Corroboration: does a prior outreach_sent_with_state exist for this brand+creator?
  // If yes, this deal was preceded by a tracked outreach — stronger evidence.
  let corroboration = 0.3;
  try {
    const { rows } = await pool.query(
      `SELECT id FROM brand_creator_interactions
       WHERE creator_id = $1
         AND brand_id = $2
         AND interaction_type = 'outreach_sent'
         AND created_at > NOW() - INTERVAL '180 days'
         AND creator_state_snapshot IS NOT NULL
       LIMIT 1`,
      [row.creator_id, row.brand_id]
    );
    if (rows.length > 0) corroboration += 0.4;
  } catch (_) {
    // Non-fatal: proceed with base corroboration score
  }
  // Both agreed AND offered rate present means we can see the negotiation movement
  if (row.agreed_rate != null && row.offered_rate != null) corroboration = Math.min(1.0, corroboration + 0.3);

  const factors = {
    corroboration,
    recency: recencyScore(row.created_at),
    completeness: completenessScore(row, requiredFields),
    sourceType: row.evidence_type === 'user_reported' ? 0.9 : 0.6,
    notes: [],
  };

  const score =
    factors.corroboration * WEIGHTS.corroboration +
    factors.recency * WEIGHTS.recency +
    factors.completeness * WEIGHTS.completeness +
    factors.sourceType * WEIGHTS.sourceType;

  return { score: Math.min(1.0, parseFloat(score.toFixed(3))), factors };
}

// brand_replied: binary event — an email got a reply. Intentionally weaker than deal_closed.
async function brandRepliedQuality(row, pool) {
  let corroboration = 0.3;
  try {
    const { rows } = await pool.query(
      `SELECT id FROM brand_creator_interactions
       WHERE creator_id = $1
         AND brand_id = $2
         AND interaction_type = 'outreach_sent'
         AND creator_state_snapshot IS NOT NULL
       LIMIT 1`,
      [row.creator_id, row.brand_id]
    );
    if (rows.length > 0) corroboration += 0.4;
  } catch (_) {}

  const requiredFields = ['gmail_thread_id', 'creator_id', 'brand_id'];
  const factors = {
    corroboration,
    recency: recencyScore(row.created_at),
    completeness: completenessScore(row, requiredFields),
    sourceType: 0.6, // always auto_detected
    notes: ['brand_replied is a directional signal only — does not update rate estimates'],
  };

  const score =
    factors.corroboration * WEIGHTS.corroboration +
    factors.recency * WEIGHTS.recency +
    factors.completeness * WEIGHTS.completeness +
    factors.sourceType * WEIGHTS.sourceType;

  return { score: Math.min(1.0, parseFloat(score.toFixed(3))), factors };
}

// outreach_sent_with_state: captures creator context at time of send.
// Its value is unlocked later when deal_closed queries it for corroboration.
// Cannot be corroborated by itself — it IS the upstream of corroboration.
async function outreachSentWithStateQuality(row) {
  const requiredFields = ['brand_id', 'niche', 'creator_id'];

  const factors = {
    corroboration: 0.3, // fixed — this signal enables future corroboration, not the other way
    recency: recencyScore(row.created_at),
    completeness: completenessScore(row, requiredFields),
    sourceType: 0.6,
    notes: ['snapshot signal — quality unlocked when a deal_closed references it'],
  };

  const score =
    factors.corroboration * WEIGHTS.corroboration +
    factors.recency * WEIGHTS.recency +
    factors.completeness * WEIGHTS.completeness +
    factors.sourceType * WEIGHTS.sourceType;

  return { score: Math.min(1.0, parseFloat(score.toFixed(3))), factors };
}

async function calculateQuality(signalType, sourceRow) {
  const pool = getPool();
  switch (signalType) {
    case 'deal_closed':
      return dealClosedQuality(sourceRow, pool);
    case 'brand_replied':
      return brandRepliedQuality(sourceRow, pool);
    case 'outreach_sent_with_state':
      return outreachSentWithStateQuality(sourceRow);
    default:
      return { score: 0.5, factors: { notes: [`unknown signal type: ${signalType}`] } };
  }
}

module.exports = { calculateQuality };
