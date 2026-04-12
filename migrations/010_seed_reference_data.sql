-- ============================================================
-- 010_seed_reference_data.sql
-- Subscription plan reference data.
-- Brand registry seed data lives in: 010_seed_brand_registry.sql
-- Run this file first, then run 010_seed_brand_registry.sql.
-- ============================================================

-- ============================================================
-- SUBSCRIPTION PLANS
-- Amounts in pence (GBP). USD plans added when US billing live.
-- stripe_price_id values are placeholders — replace with live
-- Stripe price IDs before deploying to production.
-- ============================================================
INSERT INTO subscription_plans (
  name, stripe_price_id_monthly, stripe_price_id_annual,
  amount_monthly, amount_annual, currency,
  analysis_runs_per_week, features)
VALUES

('intelligence',
  'price_intelligence_monthly_gbp_placeholder',
  'price_intelligence_annual_gbp_placeholder',
  999,   -- £9.99/mo
  9900,  -- £99/yr
  'GBP',
  3,
  '{
    "six_dimensional_scoring": true,
    "milestone_ladder": true,
    "priority_task_recommendations": true,
    "brand_registry_buying_windows": true,
    "rate_intelligence_read_only": true,
    "experimentation_engine": true,
    "pitch_package": false,
    "outreach_email_sending": false,
    "negotiation_toolkit": false,
    "contract_review": false,
    "relationship_management": false
  }'::jsonb
),

('action',
  'price_action_monthly_gbp_placeholder',
  'price_action_annual_gbp_placeholder',
  2499,  -- £24.99/mo
  24900, -- £249/yr
  'GBP',
  5,
  '{
    "six_dimensional_scoring": true,
    "milestone_ladder": true,
    "priority_task_recommendations": true,
    "brand_registry_buying_windows": true,
    "rate_intelligence_read_only": true,
    "experimentation_engine": true,
    "pitch_package": true,
    "outreach_email_sending": true,
    "negotiation_toolkit": false,
    "contract_review": false,
    "relationship_management": false
  }'::jsonb
),

('represent',
  'price_represent_monthly_gbp_placeholder',
  'price_represent_annual_gbp_placeholder',
  4999,  -- £49.99/mo
  49900, -- £499/yr
  'GBP',
  10,
  '{
    "six_dimensional_scoring": true,
    "milestone_ladder": true,
    "priority_task_recommendations": true,
    "brand_registry_buying_windows": true,
    "rate_intelligence_read_only": true,
    "experimentation_engine": true,
    "pitch_package": true,
    "outreach_email_sending": true,
    "negotiation_toolkit": true,
    "contract_review": true,
    "relationship_management": true
  }'::jsonb
);

INSERT INTO schema_migrations (version) VALUES ('010');
