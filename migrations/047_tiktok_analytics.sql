-- Migration 047: TikTok analytics columns
-- Adds derived analytics fields for TikTok to creator_platform_profiles.
-- Also fixes the naming bug from migration 019: tiktok_following_count stored
-- the follower count (audience size), but the column name implies "who they follow".
-- We add tiktok_follower_count as the canonical field and deprecate the old one.

ALTER TABLE creator_platform_profiles
  ADD COLUMN IF NOT EXISTS tiktok_follower_count           INTEGER,
  ADD COLUMN IF NOT EXISTS tiktok_avg_views_per_video_30d  INTEGER,
  ADD COLUMN IF NOT EXISTS tiktok_video_posts_30d          INTEGER,
  ADD COLUMN IF NOT EXISTS tiktok_engagement_rate_30d      NUMERIC(6,4);

-- Backfill tiktok_follower_count from tiktok_following_count where it exists
-- (migration 019 incorrectly used following_count to store the follower/audience count)
UPDATE creator_platform_profiles
  SET tiktok_follower_count = tiktok_following_count
  WHERE tiktok_following_count IS NOT NULL
    AND tiktok_follower_count IS NULL;

-- Add TikTok analytics columns to platform_metrics_snapshots
ALTER TABLE platform_metrics_snapshots
  ADD COLUMN IF NOT EXISTS tiktok_follower_count      INTEGER,
  ADD COLUMN IF NOT EXISTS tiktok_avg_views_per_video INTEGER,
  ADD COLUMN IF NOT EXISTS tiktok_engagement_rate     NUMERIC(6,4);
