-- ============================================================
-- 044_brand_watchlist.sql
-- Tenant-scoped brand watchlist.
-- Creators can discover and add brands beyond the curated
-- registry. Watchlisted brands always appear in their
-- Outreach page regardless of category filter.
-- Contact discovery is auto-queued on add.
-- ============================================================

CREATE TABLE tenant_brand_watchlist (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id)  ON DELETE CASCADE,
  brand_id   UUID NOT NULL REFERENCES brands(id)   ON DELETE CASCADE,
  source     TEXT NOT NULL DEFAULT 'user_discovery'
               CHECK (source IN ('user_discovery', 'manual')),
  added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, brand_id)
);

CREATE INDEX idx_tbw_tenant ON tenant_brand_watchlist(tenant_id);
CREATE INDEX idx_tbw_brand  ON tenant_brand_watchlist(brand_id);

INSERT INTO schema_migrations (version) VALUES ('044');
