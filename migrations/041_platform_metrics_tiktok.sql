-- ============================================================
-- 041_platform_metrics_tiktok.sql
-- Add 'tiktok' and 'instagram' to the platform CHECK constraint
-- on platform_metrics_snapshots. The original constraint (012)
-- only allowed 'youtube' and 'twitch'.
-- ============================================================

ALTER TABLE platform_metrics_snapshots
  DROP CONSTRAINT IF EXISTS platform_metrics_snapshots_platform_check;

ALTER TABLE platform_metrics_snapshots
  ADD CONSTRAINT platform_metrics_snapshots_platform_check
  CHECK (platform IN ('youtube', 'twitch', 'tiktok', 'instagram'));

INSERT INTO schema_migrations (version) VALUES ('041');
