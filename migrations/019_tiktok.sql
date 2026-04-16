-- ============================================================
-- 019_tiktok.sql
-- TikTok platform metric columns on creator_platform_profiles.
-- ============================================================

ALTER TABLE creator_platform_profiles
  ADD COLUMN IF NOT EXISTS tiktok_following_count  INTEGER,
  ADD COLUMN IF NOT EXISTS tiktok_like_count        BIGINT,
  ADD COLUMN IF NOT EXISTS tiktok_video_count       INTEGER,
  ADD COLUMN IF NOT EXISTS tiktok_verified          BOOLEAN NOT NULL DEFAULT FALSE;

INSERT INTO schema_migrations (version) VALUES ('019_tiktok');
