-- ============================================================
-- 046_email_confidence.sql
-- Email verification layer:
--   brands              → partnership_email_status/confidence/last_verified_at/smtp_result
--   brand_contacts      → email_status/confidence/last_verified_at/smtp_result
--   email_probe_log     → domain-level SMTP result cache (30-day TTL)
--   signal_events       → extends signal_type constraint with 'email_bounced'
-- ============================================================

-- ── brands table ──────────────────────────────────────────────────────────────

ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS partnership_email_status           TEXT DEFAULT 'unknown'
    CHECK (partnership_email_status IN ('unknown','verified','catch_all','invalid','bounced','no_mx')),
  ADD COLUMN IF NOT EXISTS partnership_email_confidence       NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS partnership_email_last_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS partnership_email_smtp_result      JSONB;

-- ── brand_contacts table ──────────────────────────────────────────────────────

ALTER TABLE brand_contacts
  ADD COLUMN IF NOT EXISTS email_status            TEXT DEFAULT 'unknown'
    CHECK (email_status IN ('unknown','verified','catch_all','invalid','bounced','no_mx')),
  ADD COLUMN IF NOT EXISTS email_confidence        NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS email_last_verified_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS smtp_result             JSONB;

-- ── email_probe_log ───────────────────────────────────────────────────────────
-- One row per probe. Domain-level results are reused within 30 days to avoid
-- re-probing known catch-all domains (Google Workspace, Microsoft 365, etc.).

CREATE TABLE IF NOT EXISTS email_probe_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT    NOT NULL,
  domain       TEXT    NOT NULL,
  mx_exists    BOOLEAN,
  smtp_status  TEXT,
  catch_all    BOOLEAN,
  smtp_code    INTEGER,
  smtp_message TEXT,
  probe_ms     INTEGER,
  error_detail TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS email_probe_log_email_idx
  ON email_probe_log (email, created_at DESC);

CREATE INDEX IF NOT EXISTS email_probe_log_domain_idx
  ON email_probe_log (domain, created_at DESC);

-- ── signal_type constraint extension ─────────────────────────────────────────
-- Add 'email_bounced' as a valid signal type so bounce detections appear
-- in the SignalFeed and can be reviewed on the Honesty page.

ALTER TABLE signal_events
  DROP CONSTRAINT IF EXISTS signal_events_signal_type_check;

ALTER TABLE signal_events
  ADD CONSTRAINT signal_events_signal_type_check
  CHECK (signal_type IN (
    'deal_closed',
    'brand_replied',
    'outreach_sent_with_state',
    'deal_progressed',
    'deal_stale',
    'deal_declined',
    'email_bounced'
  ));
