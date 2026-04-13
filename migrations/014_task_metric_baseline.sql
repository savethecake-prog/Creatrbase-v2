-- ============================================================
-- 014_task_metric_baseline.sql
-- Stores the dimension metric value at the moment a task is
-- created so the card can show before → now progress.
-- ============================================================

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS metric_baseline JSONB;

-- Schema:
-- {
--   "metric_key":   "subscriber_count" | "engagement_rate_30d" | "uploads_per_week",
--   "metric_label": "Subscribers",
--   "value":        4200,
--   "unit":         null | "%" | "/wk",
--   "captured_at":  "2026-04-13T10:00:00Z"
-- }

INSERT INTO schema_migrations (version) VALUES ('014');
