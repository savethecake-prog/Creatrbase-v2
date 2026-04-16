-- ============================================================
-- 020_instagram.sql
-- Instagram metric columns on creator_platform_profiles.
-- ============================================================

ALTER TABLE creator_platform_profiles
  ADD COLUMN IF NOT EXISTS instagram_media_count        INTEGER,
  ADD COLUMN IF NOT EXISTS instagram_reach_30d          INTEGER,
  ADD COLUMN IF NOT EXISTS instagram_profile_views_30d  INTEGER,
  ADD COLUMN IF NOT EXISTS instagram_impressions_30d    INTEGER;

-- Add instagram to the platform check constraint
ALTER TABLE creator_platform_profiles
  DROP CONSTRAINT IF EXISTS creator_platform_profiles_platform_check;

ALTER TABLE creator_platform_profiles
  ADD CONSTRAINT creator_platform_profiles_platform_check
  CHECK (platform IN ('youtube', 'twitch', 'tiktok', 'instagram'));
