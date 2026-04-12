-- ============================================================
-- 001_create_tenants_users.sql
-- Foundation layer. Every other table references tenants or users.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Migration tracking
CREATE TABLE IF NOT EXISTS schema_migrations (
  version     TEXT PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TENANTS
-- One tenant = one creator account. 1:1 with users at launch.
-- ============================================================
CREATE TABLE tenants (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status       TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active','suspended','deleted')),
  suspended_at TIMESTAMPTZ,
  suspended_by TEXT,
  deleted_at   TIMESTAMPTZ,
  deleted_by   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- USERS
-- Root identity. Auth only. One user per tenant at launch.
-- ============================================================
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  password_hash   TEXT,
  email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  email_verified_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(email)
);

CREATE INDEX idx_users_tenant    ON users(tenant_id);
CREATE INDEX idx_users_email     ON users(email);

-- ============================================================
-- AUTH PROVIDERS
-- OAuth login credentials. Not platform API access tokens.
-- ============================================================
CREATE TABLE auth_providers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider     TEXT NOT NULL CHECK (provider IN ('google','twitch','local')),
  provider_id  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider, provider_id)
);

CREATE INDEX idx_auth_providers_user ON auth_providers(user_id);

-- ============================================================
-- SESSIONS
-- Revocable JWT session store. Redis cache layer sits above this.
-- ============================================================
CREATE TABLE sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ip_address   TEXT,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_sessions_user      ON sessions(user_id);
CREATE INDEX idx_sessions_tenant    ON sessions(tenant_id);
CREATE INDEX idx_sessions_expires   ON sessions(expires_at);

-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION
-- Applied to every table with an updated_at column.
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_users
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- AUDIT LOG
-- Permanent. Never purged. Append only.
-- ============================================================
CREATE TABLE audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE SET NULL,
  actor_type    TEXT NOT NULL CHECK (actor_type IN ('creator','admin','system','worker')),
  actor_id      UUID NOT NULL,
  action        TEXT NOT NULL,
  resource_type TEXT,
  resource_id   UUID,
  payload       JSONB,
  ip_address    TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_tenant_time ON audit_log(tenant_id, created_at DESC);
CREATE INDEX idx_audit_actor       ON audit_log(actor_type, actor_id, created_at DESC);
CREATE INDEX idx_audit_action      ON audit_log(action, created_at DESC);

INSERT INTO schema_migrations (version) VALUES ('001');
