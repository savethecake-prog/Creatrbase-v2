'use strict';

const { authenticate } = require('../../middleware/authenticate');
const { getPrisma }    = require('../../lib/prisma');

async function scoreRoutes(app) {
  // GET /api/creator/score/history
  // Returns last 30 scored_at snapshots, oldest → newest, for the trend chart.
  app.get('/api/creator/score/history', { preHandler: authenticate }, async (req) => {
    const prisma = getPrisma();

    const creator = await prisma.creator.findFirst({
      where:  { userId: req.user.userId, tenantId: req.user.tenantId },
      select: { id: true },
    });
    if (!creator) return { history: [], status: 'no_creator' };

    const rows = await prisma.dimensionScoreHistory.findMany({
      where:   { creatorId: creator.id },
      orderBy: { scoredAt: 'asc' },
      take:    30,
      select:  { scoredAt: true, overallScore: true, commercialTier: true },
    });

    if (rows.length === 0) return { history: [], status: 'no_data' };

    return {
      history: rows.map(r => ({
        scored_at:     r.scoredAt,
        overall_score: r.overallScore,
        tier:          r.commercialTier,
      })),
      status: 'ok',
    };
  });

  // GET /api/creator/score/weekly-progress
  // Returns current score vs score 7 days ago + per-dimension deltas for the
  // in-app weekly progress snapshot banner.
  app.get('/api/creator/score/weekly-progress', { preHandler: authenticate }, async (req) => {
    const prisma = getPrisma();

    const creator = await prisma.creator.findFirst({
      where:  { userId: req.user.userId, tenantId: req.user.tenantId },
      select: { id: true },
    });
    if (!creator) return { status: 'no_creator' };

    // Newest score entry
    const [latest, weekAgoRow] = await Promise.all([
      prisma.dimensionScoreHistory.findFirst({
        where:   { creatorId: creator.id },
        orderBy: { scoredAt: 'desc' },
        select: {
          overallScore:               true,
          scoredAt:                   true,
          subscriberMomentumScore:    true,
          engagementQualityScore:     true,
          nicheCommercialValueScore:  true,
          audienceGeoAlignmentScore:  true,
          contentConsistencyScore:    true,
          contentBrandAlignmentScore: true,
        },
      }),
      // Nearest entry older than 6 days (looks back up to 30 days)
      prisma.dimensionScoreHistory.findFirst({
        where:   {
          creatorId: creator.id,
          scoredAt:  { lte: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) },
        },
        orderBy: { scoredAt: 'desc' },
        select: {
          overallScore:               true,
          scoredAt:                   true,
          subscriberMomentumScore:    true,
          engagementQualityScore:     true,
          nicheCommercialValueScore:  true,
          audienceGeoAlignmentScore:  true,
          contentConsistencyScore:    true,
          contentBrandAlignmentScore: true,
        },
      }),
    ]);

    if (!latest) return { status: 'no_data' };
    if (!weekAgoRow) return { status: 'not_enough_history', current_score: latest.overallScore };

    const delta = latest.overallScore - weekAgoRow.overallScore;

    const DIMS = [
      ['subscriber_momentum',    'subscriberMomentumScore'],
      ['engagement_quality',     'engagementQualityScore'],
      ['niche_commercial_value', 'nicheCommercialValueScore'],
      ['audience_geo_alignment', 'audienceGeoAlignmentScore'],
      ['content_consistency',    'contentConsistencyScore'],
      ['content_brand_alignment','contentBrandAlignmentScore'],
    ];

    const dimension_deltas = DIMS
      .map(([key, field]) => {
        const current  = latest[field];
        const previous = weekAgoRow[field];
        if (current == null || previous == null) return null;
        const d = current - previous;
        return d !== 0 ? { dimension: key, delta: d, current, previous } : null;
      })
      .filter(Boolean)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    return {
      status:          'ok',
      current_score:   latest.overallScore,
      previous_score:  weekAgoRow.overallScore,
      delta,
      scored_at:       latest.scoredAt,
      compared_to:     weekAgoRow.scoredAt,
      dimension_deltas,
    };
  });

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
