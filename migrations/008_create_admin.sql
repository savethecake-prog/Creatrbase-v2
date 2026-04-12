-- ============================================================
-- 008_create_admin.sql
-- Admin application tables. Separate from creator tables.
-- Admin users have no connection to tenant/user/creator tables.
-- ============================================================

CREATE TABLE admin_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'admin'
                  CHECK (role IN ('admin','super_admin')),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(email)
);

CREATE TRIGGER set_updated_at_admin_users
  BEFORE UPDATE ON admin_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE admin_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL,
  last_active   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address    TEXT NOT NULL,
  user_agent    TEXT
);

CREATE INDEX idx_admin_sessions_user    ON admin_sessions(admin_user_id);
CREATE INDEX idx_admin_sessions_expires ON admin_sessions(expires_at);

-- ============================================================
-- IMPERSONATION LOG
-- Every admin impersonation session. Permanent.
-- ============================================================
CREATE TABLE admin_impersonations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id   UUID NOT NULL REFERENCES admin_users(id),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  creator_id      UUID NOT NULL REFERENCES creators(id),
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at        TIMESTAMPTZ,
  ip_address      TEXT NOT NULL,
  reason          TEXT
);

CREATE INDEX idx_impersonations_admin  ON admin_impersonations(admin_user_id, started_at DESC);
CREATE INDEX idx_impersonations_tenant ON admin_impersonations(tenant_id, started_at DESC);

INSERT INTO schema_migrations (version) VALUES ('008');
