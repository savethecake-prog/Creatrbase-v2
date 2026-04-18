-- ============================================================
-- 024_add_free_plan.sql
-- Add free plan to subscription_plans, make stripe_customer_id
-- nullable on subscriptions (free users have no Stripe customer).
-- ============================================================

-- 1. Relax CHECK constraint to include 'free'
ALTER TABLE subscription_plans
  DROP CONSTRAINT IF EXISTS subscription_plans_name_check;

ALTER TABLE subscription_plans
  ADD CONSTRAINT subscription_plans_name_check
  CHECK (name IN ('free', 'core', 'pro'));

-- 2. Seed free plan
INSERT INTO subscription_plans (
  name,
  stripe_price_id_monthly,
  amount_monthly,
  currency,
  analysis_runs_per_week,
  features
) VALUES (
  'free',
  'none',
  0,
  'GBP',
  0,
  '{
    "gap_tracker": false,
    "weekly_tasks": false,
    "brand_outreach": false,
    "negotiations": false,
    "contract_review": false,
    "peer_benchmarking": false,
    "audience_deep_dive": false,
    "milestone_alerts": false,
    "historical_tracking_ui": false,
    "projection_view": false,
    "pitch_emails": false,
    "rate_intelligence": false,
    "followup_sequences": false,
    "media_kit": false
  }'::jsonb
)
ON CONFLICT DO NOTHING;

-- 3. Allow null stripe_customer_id for free-tier subscriptions
ALTER TABLE subscriptions
  ALTER COLUMN stripe_customer_id DROP NOT NULL;
