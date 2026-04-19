'use strict';

const { getPool } = require('../db/pool');

const TIER_ORDER = { free: 0, core: 1, pro: 2 };

/**
 * Resolve the effective tier for a tenant.
 * Returns { tier, status, features } where tier is 'free', 'core', or 'pro'.
 *
 * Admin override takes precedence over all Stripe state.
 */
async function resolveTier(tenantId) {
  const pool = getPool();

  const { rows } = await pool.query(
    `SELECT s.status, s.trial_end, s.admin_override_plan,
            sp.name AS plan_name, sp.features
     FROM subscriptions s
     JOIN subscription_plans sp ON sp.id = s.plan_id
     WHERE s.tenant_id = $1
     LIMIT 1`,
    [tenantId]
  );

  if (rows.length === 0) {
    return { tier: 'free', status: 'none', features: {} };
  }

  const sub      = rows[0];
  const planName = sub.plan_name;
  const features = sub.features || {};

  // Admin override takes precedence over all Stripe state
  if (sub.admin_override_plan) {
    return { tier: sub.admin_override_plan, status: 'admin_override', features };
  }

  // Active paid subscription
  if (sub.status === 'active' && planName !== 'free') {
    return { tier: planName, status: 'active', features };
  }

  // Active trial that hasn't expired
  if (sub.status === 'trialling' && sub.trial_end && new Date(sub.trial_end) > new Date()) {
    return { tier: planName, status: 'trialling', features };
  }

  return { tier: 'free', status: sub.status, features: {} };
}

/**
 * Check if a tier meets the minimum required tier.
 */
function tierMeetsMinimum(currentTier, requiredTier) {
  return (TIER_ORDER[currentTier] || 0) >= (TIER_ORDER[requiredTier] || 0);
}

module.exports = { resolveTier, tierMeetsMinimum, TIER_ORDER };
