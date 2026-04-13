-- ============================================================
-- 012_platform_metrics_snapshots.sql
-- Append-only time-series of synced metrics per platform profile.
-- Written by the sync worker after every successful sync.
-- Powers velocity calculations and projections in Gap Tracker.
-- ============================================================

CREATE TABLE platform_metrics_snapshots (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID        NOT NULL REFERENCES tenants(id)                       ON DELETE CASCADE,
  platform_profile_id  UUID        NOT NULL REFERENCES creator_platform_profiles(id)     ON DELETE CASCADE,
  platform             TEXT        NOT NULL CHECK (platform IN ('youtube','twitch')),
  -- YouTube
  subscriber_count     INTEGER,
  watch_hours_12mo     NUMERIC(10,2),
  total_view_count     BIGINT,
  video_count          INTEGER,
  -- Twitch
  avg_concurrent_viewers_30d  NUMERIC(6,2),
  recorded_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pms_profile_time ON platform_metrics_snapshots(platform_profile_id, recorded_at DESC);
CREATE INDEX idx_pms_tenant       ON platform_metrics_snapshots(tenant_id);

INSERT INTO schema_migrations (version) VALUES ('012');
