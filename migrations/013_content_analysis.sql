-- ─── Migration 013: extend existing content analysis tables ──────────────────
-- content_analysis_runs and creator_niche_profiles were created in migration 002
-- with the full schema design. This migration adds the operational columns
-- needed by the content analysis worker.

-- content_analysis_runs: add platform_profile_id (links run to the specific profile
-- that triggered it) and tokens_used (billing/audit).
ALTER TABLE content_analysis_runs
  ADD COLUMN IF NOT EXISTS platform_profile_id UUID
    REFERENCES creator_platform_profiles(id) ON DELETE CASCADE;

ALTER TABLE content_analysis_runs
  ADD COLUMN IF NOT EXISTS tokens_used INTEGER;

CREATE INDEX IF NOT EXISTS idx_car_platform_profile
  ON content_analysis_runs(platform_profile_id);

-- creator_niche_profiles: add free-text fields output by Claude that weren't
-- in the original schema (which used structured ENUM-style fields).
ALTER TABLE creator_niche_profiles
  ADD COLUMN IF NOT EXISTS brand_mentions TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE creator_niche_profiles
  ADD COLUMN IF NOT EXISTS confidence_reasoning TEXT;

ALTER TABLE creator_niche_profiles
  ADD COLUMN IF NOT EXISTS niche_commercial_notes TEXT;

ALTER TABLE creator_niche_profiles
  ADD COLUMN IF NOT EXISTS classification_reasoning TEXT;
