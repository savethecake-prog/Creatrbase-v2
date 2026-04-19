-- ============================================================
-- 036_gdpr_compliance.sql
-- GDPR compliance additions:
--   1. Marketing consent columns on newsletter_subscriber_attribution
--   2. deletion_pending status support on tenants (already has status col)
--   3. gdpr_requests table to log data subject requests
-- ============================================================

-- Add consent tracking to newsletter attribution
ALTER TABLE newsletter_subscriber_attribution
  ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS consent_at        TIMESTAMPTZ;

-- Backfill existing rows: treat pre-GDPR subscribers as having given consent
-- (they subscribed voluntarily; this migration does not add new obligations)
UPDATE newsletter_subscriber_attribution
SET marketing_consent = TRUE, consent_at = subscribed_at
WHERE marketing_consent = FALSE;

-- GDPR data subject request log
-- Records export and deletion requests for audit purposes.
CREATE TABLE IF NOT EXISTS gdpr_requests (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES tenants(id),
  user_id       UUID        NOT NULL REFERENCES users(id),
  request_type  TEXT        NOT NULL CHECK (request_type IN ('export', 'delete')),
  status        TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'complete', 'failed')),
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ,
  metadata      JSONB       NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_gdpr_requests_tenant   ON gdpr_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_requests_user     ON gdpr_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_requests_type     ON gdpr_requests(request_type, requested_at DESC);
