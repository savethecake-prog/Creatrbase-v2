'use strict';

const { getPool } = require('../../db/pool');

// ── getBrands ─────────────────────────────────────────────────────────────────
// Returns brands, optionally filtered by niche / category.
// If creatorId supplied, includes the latest outreach interaction for that creator.

async function getBrands({ niche = null, category = null, creatorId = null } = {}) {
  const pool = getPool();

  const { rows } = await pool.query(
    `
    SELECT
      b.id,
      b.brand_name,
      b.brand_slug,
      b.category,
      b.sub_category,
      b.website,
      b.partnership_email,
      b.partnership_url,
      b.geo_presence,
      b.creator_programme_type,
      b.registry_confidence,
      b.notes,
      b.known_promo_patterns,

      -- Aggregate matching tier profiles (niche-filtered if provided)
      COALESCE(
        json_agg(
          json_build_object(
            'niche',                btp.niche,
            'geo',                  btp.geo,
            'creator_tier',         btp.creator_tier,
            'buying_window_status', btp.buying_window_status,
            'status_confidence',    btp.status_confidence,
            'typical_deliverable',  btp.typical_deliverable,
            'rate_range_low',       btp.rate_range_low,
            'rate_range_high',      btp.rate_range_high,
            'rate_currency',        btp.rate_currency,
            'rate_confidence',      btp.rate_confidence
          ) ORDER BY
            CASE btp.buying_window_status
              WHEN 'active'       THEN 1
              WHEN 'warming'      THEN 2
              WHEN 'prospecting'  THEN 3
              WHEN 'cycling'      THEN 4
              ELSE 5
            END
        ) FILTER (WHERE btp.id IS NOT NULL),
        '[]'
      ) AS tier_profiles,

      -- Latest outreach interaction for this creator (null if no creator or no interaction)
      (
        SELECT json_build_object(
          'interaction_type', bci.interaction_type,
          'interaction_date', bci.interaction_date,
          'deal_notes',       bci.deal_notes
        )
        FROM brand_creator_interactions bci
        WHERE bci.brand_id = b.id
          AND ($3::uuid IS NULL OR bci.creator_id = $3)
        ORDER BY bci.created_at DESC
        LIMIT 1
      ) AS latest_interaction

    FROM brands b

    LEFT JOIN brand_tier_profiles btp
      ON btp.brand_id = b.id
      AND ($1::text IS NULL OR btp.niche = $1)

    WHERE ($2::text IS NULL OR b.category = $2)

    GROUP BY b.id

    ORDER BY
      CASE b.registry_confidence
        WHEN 'established' THEN 1
        WHEN 'partial'     THEN 2
        ELSE 3
      END,
      b.brand_name
    `,
    [niche, category, creatorId]
  );

  return rows;
}

// ── logOutreach ───────────────────────────────────────────────────────────────
// Records that the creator sent outreach to a brand.

async function logOutreach({ brandId, creatorId, tenantId, niche, notes, userId }) {
  const pool = getPool();
  await pool.query(
    `
    INSERT INTO brand_creator_interactions
      (brand_id, creator_id, tenant_id, niche, geo, interaction_type,
       interaction_date, evidence_type, confidence, deal_notes, is_public, created_by)
    VALUES
      ($1, $2, $3, $4, 'global', 'outreach_sent',
       CURRENT_DATE, 'user_reported', 'high', $5, FALSE, $6)
    `,
    [brandId, creatorId, tenantId, niche || 'general', notes || null, userId]
  );
}

// ── updateOutreachStatus ──────────────────────────────────────────────────────
// Logs a follow-on interaction (responded, declined, deal started).

async function updateOutreachStatus({ brandId, creatorId, tenantId, interactionType, niche, notes, userId }) {
  const pool = getPool();
  await pool.query(
    `
    INSERT INTO brand_creator_interactions
      (brand_id, creator_id, tenant_id, niche, geo, interaction_type,
       interaction_date, evidence_type, confidence, deal_notes, is_public, created_by)
    VALUES
      ($1, $2, $3, $4, 'global', $5,
       CURRENT_DATE, 'user_reported', 'high', $6, FALSE, $7)
    `,
    [brandId, creatorId, tenantId, niche || 'general', interactionType, notes || null, userId]
  );
}

// ── getOutreachHistory ────────────────────────────────────────────────────────
// Full interaction history between this creator and a specific brand.

async function getOutreachHistory({ brandId, creatorId }) {
  const pool = getPool();
  const { rows } = await pool.query(
    `
    SELECT
      id,
      interaction_type,
      interaction_date,
      deal_notes,
      created_at
    FROM brand_creator_interactions
    WHERE brand_id = $1 AND creator_id = $2
    ORDER BY created_at DESC
    `,
    [brandId, creatorId]
  );
  return rows;
}

module.exports = { getBrands, logOutreach, updateOutreachStatus, getOutreachHistory };
