-- ============================================================
-- 016_support_tickets.sql
-- Support ticket log for in-app Claude support chat.
-- ============================================================

CREATE TABLE IF NOT EXISTS support_tickets (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  messages   JSONB       NOT NULL DEFAULT '[]',
  status     TEXT        NOT NULL DEFAULT 'open'
               CHECK (status IN ('open', 'resolved', 'escalated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_tickets_tenant_created
  ON support_tickets (tenant_id, created_at DESC);
