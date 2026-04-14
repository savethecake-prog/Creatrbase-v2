'use strict';

const { getPool } = require('../../db/pool');

// ── getBrands ─────────────────────────────────────────────────────────────────
// Returns all brands from the registry, optionally filtered by niche.
// Left-joins brand_tier_profiles to surface buying window + rate data.
// Results ordered: established → partial → minimal, then alphabetical.

async function getBrands({ niche = null, category = null } = {}) {
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
      ) AS tier_profiles

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
    [niche, category]
  );

  return rows;
}

module.exports = { getBrands };
