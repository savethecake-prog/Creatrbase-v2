'use strict';

const { authenticate }  = require('../../middleware/authenticate');
const { requireTier }   = require('../../middleware/requireTier');
const { getPrisma }     = require('../../lib/prisma');

const MILESTONE_ORDER = [
  'giftable',
  'outreach_ready',
  'paid_integration_viable',
  'rate_negotiation_power',
  'portfolio_creator',
];

async function auditRoutes(app) {

  // GET /api/audit
  // Returns the full commercial audit data for the authenticated creator.
  // No Claude call — reads from existing scoring + recommendation tables.
  app.get('/api/audit', { preHandler: [authenticate, requireTier('core')] }, async (req) => {
    const prisma = getPrisma();

    const creator = await prisma.creator.findFirst({
      where:  { userId: req.user.userId, tenantId: req.user.tenantId },
      select: { id: true },
    });
    if (!creator) return { status: 'no_creator' };

    const [commercial, niche, history, milestones, recommendation] = await Promise.all([
      prisma.creatorCommercialProfile.findFirst({
        where:  { creatorId: creator.id },
        select: {
          commercialViabilityScore: true,
          viabilityScoreConfidence: true,
          viabilityLastCalculated:  true,
          viabilityBreakdown:       true,
          commercialTier:           true,
          gapToNextTier:            true,
          gapPrimaryConstraint:     true,
          estimatedRateLow:         true,
          estimatedRateHigh:        true,
          rateCurrency:             true,
          rateConfidence:           true,
          confirmedDealsCount:      true,
        },
      }),
      prisma.creatorNicheProfile.findFirst({
        where:  { creatorId: creator.id, platform: 'youtube' },
        select: {
          primaryNicheCategory:     true,
          primaryNicheSpecific:     true,
          nicheCommercialNotes:     true,
          brandMentions:            true,
          affiliateDomainsDetected: true,
          existingPartnerships:     true,
          classificationConfidence: true,
        },
      }),
      prisma.dimensionScoreHistory.findMany({
        where:   { creatorId: creator.id },
        orderBy: { scoredAt: 'desc' },
        take:    6,
        select:  {
          scoredAt:     true,
          overallScore: true,
          commercialTier: true,
          subscriberMomentumScore:    true,
          engagementQualityScore:     true,
          nicheCommercialValueScore:  true,
          audienceGeoAlignmentScore:  true,
          contentConsistencyScore:    true,
          contentBrandAlignmentScore: true,
        },
      }),
      prisma.creatorMilestone.findMany({
        where:  { creatorId: creator.id },
        select: {
          milestoneType:        true,
          status:               true,
          crossedAt:            true,
          crossingMetric:       true,
          capabilitiesUnlocked: true,
        },
      }),
      prisma.recommendation.findFirst({
        where:   { creatorId: creator.id, status: { in: ['pending', 'accepted'] } },
        orderBy: { generatedAt: 'desc' },
        select:  {
          title:                    true,
          specificAction:           true,
          reasoning:                true,
          expectedImpactDescription: true,
          expectedImpactConfidence:  true,
          timeHorizon:              true,
          constraintDimension:      true,
          constraintSeverity:       true,
        },
      }),
    ]);

    if (!commercial) return { status: 'no_score' };

    const breakdown = commercial.viabilityBreakdown || {};

    // Sort milestones into canonical order, fill missing with not_started placeholders
    const milestoneMap = {};
    for (const m of milestones) milestoneMap[m.milestoneType] = m;
    const sortedMilestones = MILESTONE_ORDER.map(type => ({
      type,
      status:       milestoneMap[type]?.status ?? 'not_started',
      crossedAt:    milestoneMap[type]?.crossedAt ?? null,
      crossingMetric: milestoneMap[type]?.crossingMetric ?? null,
      capabilities: milestoneMap[type]?.capabilitiesUnlocked ?? [],
    }));

    return {
      status: 'ok',
      audit: {
        score:          commercial.commercialViabilityScore,
        tier:           commercial.commercialTier,
        confidence:     commercial.viabilityScoreConfidence,
        lastCalculated: commercial.viabilityLastCalculated,

        dimensions: {
          subscriber_momentum:     breakdown.subscriber_momentum     ?? null,
          engagement_quality:      breakdown.engagement_quality      ?? null,
          niche_commercial_value:  breakdown.niche_commercial_value  ?? null,
          audience_geo_alignment:  breakdown.audience_geo_alignment  ?? null,
          content_consistency:     breakdown.content_consistency     ?? null,
          content_brand_alignment: breakdown.content_brand_alignment ?? null,
        },

        primaryConstraint: commercial.gapPrimaryConstraint,
        gapToNextTier:     commercial.gapToNextTier,

        rateEstimate: (commercial.estimatedRateLow && commercial.estimatedRateHigh) ? {
          low:        commercial.estimatedRateLow,
          high:       commercial.estimatedRateHigh,
          currency:   commercial.rateCurrency ?? 'GBP',
          confidence: commercial.rateConfidence,
        } : null,

        confirmedDeals: commercial.confirmedDealsCount,

        niche: niche ? {
          category:            niche.primaryNicheCategory,
          specific:            niche.primaryNicheSpecific,
          commercialNotes:     niche.nicheCommercialNotes,
          brandMentions:       niche.brandMentions,
          affiliateDomains:    niche.affiliateDomainsDetected,
          existingPartnerships: niche.existingPartnerships,
          confidence:          niche.classificationConfidence,
        } : null,

        history: history.slice(0, 5).reverse().map(h => ({
          scoredAt:     h.scoredAt,
          overallScore: h.overallScore,
          tier:         h.commercialTier,
          dimensions: {
            subscriber_momentum:     h.subscriberMomentumScore,
            engagement_quality:      h.engagementQualityScore,
            niche_commercial_value:  h.nicheCommercialValueScore,
            audience_geo_alignment:  h.audienceGeoAlignmentScore,
            content_consistency:     h.contentConsistencyScore,
            content_brand_alignment: h.contentBrandAlignmentScore,
          },
        })),

        milestones: sortedMilestones,

        priorityAction: recommendation ? {
          title:           recommendation.title,
          specificAction:  recommendation.specificAction,
          reasoning:       recommendation.reasoning,
          expectedImpact:  recommendation.expectedImpactDescription,
          impactConfidence: recommendation.expectedImpactConfidence,
          timeHorizon:     recommendation.timeHorizon,
          dimension:       recommendation.constraintDimension,
          severity:        recommendation.constraintSeverity,
        } : null,
      },
    };
  });
}

module.exports = auditRoutes;
