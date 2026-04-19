'use strict';

const { getPool }                = require('../../db/pool');
const { getDataCollectionQueue } = require('../../jobs/queue');

// ── getPipeline ───────────────────────────────────────────────────────────────
// Returns one row per brand the creator has interacted with.
// Uses DISTINCT ON to get the latest interaction per brand.

async function getPipeline({ creatorId }) {
  const pool = getPool();
  const { rows } = await pool.query(
    `
    SELECT
      latest.interaction_id,
      latest.brand_id,
      latest.interaction_type,
      latest.interaction_date,
      latest.agreed_rate,
      latest.offered_rate,
      latest.negotiation_delta,
      latest.rate_currency,
      latest.deliverable_type,
      latest.deal_notes,
      latest.created_at       AS last_updated_at,
      b.brand_name,
      b.brand_slug,
      b.category,
      b.sub_category,
      b.website,
      b.partnership_email,
      b.registry_confidence
    FROM (
      SELECT DISTINCT ON (bci.brand_id)
        bci.id              AS interaction_id,
        bci.brand_id,
        bci.interaction_type,
        bci.interaction_date,
        bci.agreed_rate,
        bci.offered_rate,
        bci.negotiation_delta,
        bci.rate_currency,
        bci.deliverable_type,
        bci.deal_notes,
        bci.created_at
      FROM brand_creator_interactions bci
      WHERE bci.creator_id = $1
      ORDER BY bci.brand_id, bci.created_at DESC
    ) latest
    JOIN brands b ON b.id = latest.brand_id
    ORDER BY latest.created_at DESC
    `,
    [creatorId]
  );
  return rows;
}

// ── getDealHistory ────────────────────────────────────────────────────────────
// Full interaction history between this creator and one brand.

async function getDealHistory({ brandId, creatorId }) {
  const pool = getPool();
  const { rows } = await pool.query(
    `
    SELECT
      id,
      interaction_type,
      interaction_date,
      agreed_rate,
      offered_rate,
      negotiation_delta,
      rate_currency,
      deliverable_type,
      deal_notes,
      created_at
    FROM brand_creator_interactions
    WHERE brand_id = $1 AND creator_id = $2
    ORDER BY created_at ASC
    `,
    [brandId, creatorId]
  );
  return rows;
}

// ── logDealUpdate ─────────────────────────────────────────────────────────────
// Appends a new interaction to the deal history.

async function logDealUpdate({
  brandId, creatorId, tenantId, niche, userId,
  interactionType, agreedRate, offeredRate, rateCurrency,
  deliverableType, notes,
}) {
  const pool = getPool();
  const { rows } = await pool.query(
    `
    INSERT INTO brand_creator_interactions
      (brand_id, creator_id, tenant_id, niche, geo, interaction_type,
       interaction_date, agreed_rate, offered_rate, rate_currency,
       deliverable_type, deal_notes, evidence_type, confidence, is_public, created_by)
    VALUES
      ($1, $2, $3, $4, 'global', $5,
       CURRENT_DATE, $6, $7, $8,
       $9, $10, 'user_reported', 'high', FALSE, $11)
    RETURNING id
    `,
    [
      brandId, creatorId, tenantId, niche || 'general', interactionType,
      agreedRate   ?? null,
      offeredRate  ?? null,
      rateCurrency ?? null,
      deliverableType ?? null,
      notes ?? null,
      userId,
    ]
  );

  if (interactionType === 'deal_completed') {
    await getDataCollectionQueue().add('signals:ingest', {
      signalType:           'deal_closed',
      sourceInteractionId:  rows[0].id,
      creatorId,
      tenantId,
    });
  }
}

module.exports = { getPipeline, getDealHistory, logDealUpdate };
