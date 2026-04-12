-- ============================================================
-- 007_create_billing.sql
-- Subscription plans, subscriptions, Stripe webhook log,
-- credit ledger, invoices.
-- All monetary values in pence/cents (INTEGER). Never FLOAT.
-- ============================================================

-- ============================================================
-- SUBSCRIPTION PLANS
-- Seeded reference table. Do not modify at runtime.
-- ============================================================
CREATE TABLE subscription_plans (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    TEXT NOT NULL CHECK (name IN (
                            'intelligence','action','represent'
                          )),
  stripe_price_id_monthly TEXT NOT NULL,
  stripe_price_id_annual  TEXT,
  amount_monthly          INTEGER NOT NULL, -- pence/cents
  amount_annual           INTEGER,          -- pence/cents
  currency                TEXT NOT NULL CHECK (currency IN ('GBP','USD')),
  analysis_runs_per_week  INTEGER NOT NULL,
  features                JSONB NOT NULL,
  is_active               BOOLEAN NOT NULL DEFAULT TRUE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(name, currency)
);

-- ============================================================
-- SUBSCRIPTIONS
-- One active subscription per tenant.
-- ============================================================
CREATE TABLE subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id                 UUID NOT NULL REFERENCES subscription_plans(id),
  stripe_subscription_id  TEXT,
  stripe_customer_id      TEXT NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'trialling'
                            CHECK (status IN (
                              'trialling',
                              'active',
                              'past_due',
                              'cancelled',
                              'paused',
                              'incomplete'
                            )),
  billing_interval        TEXT NOT NULL DEFAULT 'month'
                            CHECK (billing_interval IN ('month','year')),
  -- Trial
  trial_start             TIMESTAMPTZ,
  trial_end               TIMESTAMPTZ,
  trial_warning_sent      BOOLEAN NOT NULL DEFAULT FALSE,
  -- Current billing period
  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  cancel_at_period_end    BOOLEAN NOT NULL DEFAULT FALSE,
  cancelled_at            TIMESTAMPTZ,
  cancellation_reason     TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id)
);

CREATE INDEX idx_subscriptions_tenant  ON subscriptions(tenant_id);
CREATE INDEX idx_subscriptions_stripe  ON subscriptions(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX idx_subscriptions_trial   ON subscriptions(trial_end)
  WHERE status = 'trialling' AND trial_end IS NOT NULL;

CREATE TRIGGER set_updated_at_subscriptions
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- BILLING EVENTS
-- Immutable Stripe webhook log. Never update a row.
-- ============================================================
CREATE TABLE billing_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT NOT NULL,
  event_type      TEXT NOT NULL,
  payload         JSONB NOT NULL,
  processed       BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at    TIMESTAMPTZ,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(stripe_event_id)
);

CREATE INDEX idx_billing_events_unprocessed ON billing_events(created_at)
  WHERE processed = FALSE;

-- ============================================================
-- CREDIT LEDGER
-- Append only. Every credit transaction is a row.
-- Current balance = SUM(amount) per tenant.
-- ============================================================
CREATE TABLE credit_ledger (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  amount                   INTEGER NOT NULL, -- positive = added, negative = consumed
  balance_after            INTEGER NOT NULL, -- running balance after this transaction
  event_type               TEXT NOT NULL CHECK (event_type IN (
                             'purchase',
                             'consumed_analysis_run',
                             'admin_grant',
                             'refund'
                           )),
  reference_id             UUID, -- content_analysis_runs.id for consumed events
  stripe_payment_intent_id TEXT,
  notes                    TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_credit_ledger_tenant ON credit_ledger(tenant_id, created_at DESC);

-- Current balance view
CREATE VIEW tenant_credit_balance AS
  SELECT tenant_id, COALESCE(SUM(amount), 0) AS balance
  FROM credit_ledger
  GROUP BY tenant_id;

-- ============================================================
-- INVOICES
-- Billing history display. Populated from Stripe webhooks.
-- ============================================================
CREATE TABLE invoices (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subscription_id     UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  stripe_invoice_id   TEXT NOT NULL,
  amount_paid         INTEGER NOT NULL, -- pence/cents
  currency            TEXT NOT NULL,
  status              TEXT NOT NULL,
  period_start        TIMESTAMPTZ,
  period_end          TIMESTAMPTZ,
  invoice_url         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(stripe_invoice_id)
);

CREATE INDEX idx_invoices_tenant ON invoices(tenant_id, created_at DESC);

-- ============================================================
-- USAGE EVENTS
-- Populated by worker jobs. Powers admin usage surface.
-- ============================================================
CREATE TABLE usage_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id) ON DELETE SET NULL,
  event_type  TEXT NOT NULL CHECK (event_type IN (
                'youtube_api_call',
                'claude_api_call',
                'email_sent',
                'analysis_run',
                'platform_sync'
              )),
  units       INTEGER NOT NULL DEFAULT 1,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_usage_tenant_type_time ON usage_events(tenant_id, event_type, created_at DESC);
CREATE INDEX idx_usage_type_time        ON usage_events(event_type, created_at DESC);

-- Daily aggregates (materialised by nightly job — cheaper for reporting)
CREATE TABLE usage_daily_aggregates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date        DATE NOT NULL,
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  total_units INTEGER NOT NULL DEFAULT 0,
  UNIQUE(date, tenant_id, event_type)
);

CREATE INDEX idx_usage_daily_tenant ON usage_daily_aggregates(tenant_id, date DESC);
CREATE INDEX idx_usage_daily_date   ON usage_daily_aggregates(date DESC);

INSERT INTO schema_migrations (version) VALUES ('007');
