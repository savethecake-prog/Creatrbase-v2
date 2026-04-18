-- ============================================================
-- 026_newsletter_subscribers.sql
-- Newsletter subscriber attribution tracking.
-- Listmonk is the source of truth for subscriber data;
-- this table tracks WHERE they came from.
-- ============================================================

CREATE TABLE IF NOT EXISTS newsletter_subscriber_attribution (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email            TEXT NOT NULL,
  listmonk_sub_id  INTEGER,
  source           TEXT NOT NULL,
  source_detail    TEXT,
  initial_segments TEXT[] DEFAULT '{}',
  subscribed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_sub_email
  ON newsletter_subscriber_attribution(LOWER(email));

CREATE INDEX IF NOT EXISTS idx_newsletter_sub_source
  ON newsletter_subscriber_attribution(source);
