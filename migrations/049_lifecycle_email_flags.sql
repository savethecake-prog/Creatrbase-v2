-- Migration 049: tracking flags for lifecycle email systems
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS payment_failed_email_sent BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS onboarding_emails_sent    JSONB   NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS upgrade_nudge_sent_at     TIMESTAMPTZ;
