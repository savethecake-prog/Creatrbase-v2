'use strict';

const { getPrisma } = require('../lib/prisma');

const TIER_ORDER = { free: 0, core: 1, pro: 2 };

/**
 * Resolve the effective tier for a tenant.
 * Returns { tier, status, features } where tier is 'free', 'core', or 'pro'.
 *
 * Logic:
 *  - active subscription on core/pro -> that tier
 *  - trialling on core/pro and trial not expired -> that tier
 *  - cancelled, expired trial, past_due, or no subscription -> free
 */
async function resolveTier(tenantId) {
  const prisma = getPrisma();

  const sub = await prisma.subscription.findUnique({
    where: { tenantId },
    include: { plan: { select: { name: true, features: true } } },
  });

  if (!sub) {
    return { tier: 'free', status: 'none', features: {} };
  }

  const planName = sub.plan.name;
  const features = sub.plan.features || {};

  // Active paid subscription
  if (sub.status === 'active' && planName !== 'free') {
    return { tier: planName, status: 'active', features };
  }

  // Active trial that hasn't expired
  if (sub.status === 'trialling' && sub.trialEnd && sub.trialEnd > new Date()) {
    return { tier: planName, status: 'trialling', features };
  }

  // Everything else falls to free
  return { tier: 'free', status: sub.status, features: {} };
}

/**
 * Check if a tier meets the minimum required tier.
 */
function tierMeetsMinimum(currentTier, requiredTier) {
  return (TIER_ORDER[currentTier] || 0) >= (TIER_ORDER[requiredTier] || 0);
}

module.exports = { resolveTier, tierMeetsMinimum, TIER_ORDER };
