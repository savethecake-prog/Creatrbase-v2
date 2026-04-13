'use strict';

const { authenticate } = require('../../middleware/authenticate');
const { getPrisma }    = require('../../lib/prisma');

async function scoreRoutes(app) {
  // GET /api/creator/score
  // Returns commercial viability score, dimension breakdown, milestones.
  app.get('/api/creator/score', { preHandler: authenticate }, async (req) => {
    const prisma = getPrisma();

    const creator = await prisma.creator.findFirst({
      where:  { userId: req.user.userId, tenantId: req.user.tenantId },
      select: { id: true },
    });
    if (!creator) return { score: null, status: 'no_creator' };

    const [commercial, milestones] = await Promise.all([
      prisma.creatorCommercialProfile.findUnique({
        where:  { creatorId: creator.id },
        select: {
          commercialViabilityScore: true,
          viabilityScoreConfidence: true,
          viabilityLastCalculated:  true,
          viabilityBreakdown:       true,
          commercialTier:           true,
          gapToNextTier:            true,
          gapPrimaryConstraint:     true,
          confirmedDealsCount:      true,
        },
      }),
      prisma.creatorMilestone.findMany({
        where:  { creatorId: creator.id },
        select: {
          milestoneType:       true,
          status:              true,
          crossedAt:           true,
          capabilitiesUnlocked: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    if (!commercial) return { score: null, status: 'not_scored' };

    return {
      score: {
        overall:          commercial.commercialViabilityScore,
        confidence:       commercial.viabilityScoreConfidence,
        last_calculated:  commercial.viabilityLastCalculated,
        tier:             commercial.commercialTier,
        gap_to_next_tier: commercial.gapToNextTier,
        primary_constraint: commercial.gapPrimaryConstraint,
        dimensions:       commercial.viabilityBreakdown,
        confirmed_deals:  commercial.confirmedDealsCount,
      },
      milestones: milestones.map(m => ({
        type:         m.milestoneType,
        status:       m.status,
        crossed_at:   m.crossedAt,
        capabilities: m.capabilitiesUnlocked,
      })),
      status: 'ready',
    };
  });
}

module.exports = scoreRoutes;
