-- ─── Migration 013: content analysis runs + creator niche profiles ─────────────

CREATE TABLE IF NOT EXISTS content_analysis_runs (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  creator_id          UUID        NOT NULL,
  platform_profile_id UUID        NOT NULL REFERENCES creator_platform_profiles(id) ON DELETE CASCADE,
  prompt_version      TEXT        NOT NULL,
  raw_input           JSONB       NOT NULL,
  raw_output          TEXT,
  parsed_output       JSONB,
  status              TEXT        NOT NULL DEFAULT 'pending',
  failure_reason      TEXT,
  tokens_used         INTEGER,
  recorded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_analysis_runs_creator
  ON content_analysis_runs(creator_id);

CREATE INDEX IF NOT EXISTS idx_content_analysis_runs_profile
  ON content_analysis_runs(platform_profile_id);

CREATE TABLE IF NOT EXISTS creator_niche_profiles (
  id                           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  creator_id                   UUID        NOT NULL UNIQUE,
  analysis_run_id              UUID        NOT NULL UNIQUE REFERENCES content_analysis_runs(id),
  primary_niche_category       TEXT        NOT NULL,
  primary_niche_specific       TEXT        NOT NULL,
  secondary_niche_specific     TEXT,
  content_format_primary       TEXT        NOT NULL,
  content_format_secondary     TEXT,
  affiliate_domains_detected   TEXT[]      NOT NULL DEFAULT '{}',
  promo_codes_detected         TEXT[]      NOT NULL DEFAULT '{}',
  brand_mentions               TEXT[]      NOT NULL DEFAULT '{}',
  existing_partnerships_likely BOOLEAN     NOT NULL,
  classification_confidence    TEXT        NOT NULL,
  confidence_reasoning         TEXT        NOT NULL,
  niche_commercial_notes       TEXT        NOT NULL,
  classification_reasoning     TEXT        NOT NULL,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
