-- ============================================================
-- 011_seed_subscription_plans.sql
-- Update subscription_plans name constraint to match two-tier
-- pricing (core / pro) and seed both plans.
-- ============================================================

-- Drop the old constraint that referenced wrong plan names
ALTER TABLE subscription_plans
  DROP CONSTRAINT subscription_plans_name_check;

ALTER TABLE subscription_plans
  ADD CONSTRAINT subscription_plans_name_check
  CHECK (name IN ('core', 'pro'));

-- Core — £10/month
INSERT INTO subscription_plans (
  name,
  stripe_price_id_monthly,
  amount_monthly,
  currency,
  analysis_runs_per_week,
  features
) VALUES (
  'core',
  'price_1TLUy97Bul3Ao9Rg2oxXvqYA',
  1000,  -- £10.00 in pence
  'GBP',
  7,
  '{
    "gap_tracker": true,
    "weekly_tasks": true,
    "brand_outreach": false,
    "negotiations": false,
    "contract_review": false
  }'::jsonb
);

-- Pro — £20/month
INSERT INTO subscription_plans (
  name,
  stripe_price_id_monthly,
  amount_monthly,
  currency,
  analysis_runs_per_week,
  features
) VALUES (
  'pro',
  'price_1TLUyw7Bul3Ao9RgcvDZnDC2',
  2000,  -- £20.00 in pence
  'GBP',
  7,
  '{
    "gap_tracker": true,
    "weekly_tasks": true,
    "brand_outreach": true,
    "negotiations": true,
    "contract_review": true
  }'::jsonb
);

INSERT INTO schema_migrations (version) VALUES ('011');
