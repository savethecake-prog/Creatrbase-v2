'use strict';

const { resolveTier, tierMeetsMinimum } = require('../services/tierResolver');

/**
 * Fastify preHandler hook factory.
 * Usage: { preHandler: [authenticate, requireTier('core')] }
 *
 * Returns 402 if the user's effective tier is below the minimum.
 * Attaches req.tier for downstream use.
 */
function requireTier(minimumTier) {
  return async function checkTier(req, reply) {
    if (!req.user?.tenantId) {
      return reply.code(401).send({ error: 'not_authenticated' });
    }

    const tierInfo = await resolveTier(req.user.tenantId);
    req.tier = tierInfo.tier;

    if (!tierMeetsMinimum(tierInfo.tier, minimumTier)) {
      return reply.code(402).send({
        error: 'tier_required',
        requiredTier: minimumTier,
        currentTier: tierInfo.tier,
        message: `This feature requires the ${minimumTier} plan. Upgrade to unlock it.`,
      });
    }
  };
}

module.exports = { requireTier };
