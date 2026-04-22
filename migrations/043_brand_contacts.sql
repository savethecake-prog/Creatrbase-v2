-- 043_brand_contacts.sql
-- Per-tenant brand contact discovery: jobs table + contacts store.
-- Contacts are isolated by tenant_id — no cross-tenant sharing.
-- TTL: 60 days from creation, renewable on re-discovery.

CREATE TABLE brand_contact_jobs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brand_id      UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  status        TEXT        NOT NULL DEFAULT 'queued'
                            CHECK (status IN ('queued','running','complete','failed')),
  result_count  INTEGER,
  error_detail  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);

CREATE INDEX idx_bcj_tenant_brand  ON brand_contact_jobs(tenant_id, brand_id, created_at DESC);
CREATE INDEX idx_bcj_active_status ON brand_contact_jobs(status) WHERE status IN ('queued','running');

CREATE TABLE brand_contacts (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brand_id       UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  full_name      TEXT,
  job_title      TEXT,
  email          TEXT        NOT NULL,
  email_verified TEXT        NOT NULL DEFAULT 'unknown'
                             CHECK (email_verified IN ('verified','unverified','unknown')),
  source         TEXT        NOT NULL DEFAULT 'website_crawl'
                             CHECK (source IN ('website_crawl','user_added')),
  source_url     TEXT,
  confidence     TEXT        NOT NULL DEFAULT 'medium'
                             CHECK (confidence IN ('high','medium','low')),
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '60 days'),
  UNIQUE(tenant_id, brand_id, email)
);

CREATE INDEX idx_bc_tenant_brand ON brand_contacts(tenant_id, brand_id, expires_at DESC);
CREATE INDEX idx_bc_expires      ON brand_contacts(expires_at);
