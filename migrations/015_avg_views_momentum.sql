-- ============================================================
-- 015_avg_views_momentum.sql
-- Adds 60-day and 90-day avg-views-per-video columns to
-- creator_platform_profiles. 30d already exists from 002.
-- ============================================================

ALTER TABLE creator_platform_profiles
  ADD COLUMN IF NOT EXISTS avg_views_per_video_60d NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS avg_views_per_video_90d NUMERIC(10,2);
