-- ============================================================
-- 017_gmail_connections.sql
-- Gmail OAuth connection for direct outreach sending.
-- Also adds thread/message tracking to brand interactions.
-- ============================================================

CREATE TABLE IF NOT EXISTS gmail_connections (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  creator_id       UUID        NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  gmail_address    TEXT        NOT NULL,
  access_token     TEXT        NOT NULL,
  refresh_token    TEXT,
  token_expires_at TIMESTAMPTZ,
  label_id         TEXT,
  connected_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(creator_id)
);

CREATE INDEX IF NOT EXISTS gmail_connections_tenant
  ON gmail_connections (tenant_id);

ALTER TABLE brand_creator_interactions
  ADD COLUMN IF NOT EXISTS gmail_thread_id  TEXT,
  ADD COLUMN IF NOT EXISTS gmail_message_id TEXT;
