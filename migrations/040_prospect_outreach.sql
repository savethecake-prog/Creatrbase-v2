-- 040_prospect_outreach.sql
-- Email outreach fields for creator acquisition prospects
-- Admin Gmail connection (singleton) for sending from team@creatrbase.com

ALTER TABLE creator_prospects
  ADD COLUMN email            TEXT,
  ADD COLUMN gmail_thread_id  TEXT,
  ADD COLUMN gmail_message_id TEXT,
  ADD COLUMN outreach_subject TEXT;

CREATE INDEX creator_prospects_thread_idx ON creator_prospects(gmail_thread_id) WHERE gmail_thread_id IS NOT NULL;

-- Singleton table for the admin outreach Gmail account (team@creatrbase.com)
CREATE TABLE admin_gmail_connections (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_address    TEXT        NOT NULL UNIQUE,
  access_token     TEXT        NOT NULL,
  refresh_token    TEXT,
  token_expires_at TIMESTAMPTZ,
  history_id       TEXT,
  watch_expiry     TIMESTAMPTZ,
  label_id         TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
