'use strict';

const { getPool } = require('../../db/pool');
const { getPrisma } = require('../../lib/prisma');

function subscriberTier(count) {
  if (!count || count < 10000) return '1k-10k';
  if (count < 50000)  return '10k-50k';
  if (count < 100000) return '50k-100k';
  return '100k+';
}

const TOOL_DEFINITIONS = [
  {
    name: 'get_creator_profile',
    description: "Fetch the creator's current Commercial Viability Score, all six dimension scores, tier, rate estimates, niche category, and subscriber count. Call this first when answering any question about the creator's commercial position.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_niche_benchmarks',
    description: "Fetch CPM and rate benchmarks for a niche from Creatrbase's benchmark database. REQUIRED before giving any rate estimates. Returns ranges by audience tier (1k-10k, 10k-50k, 50k-100k, 100k+) for UK and US markets.",
    input_schema: {
      type: 'object',
      properties: {
        niche_slug: {
          type: 'string',
          description: "The niche slug to look up, e.g. 'gaming', 'finance', 'beauty', 'tech-reviews', 'lifestyle', 'fitness'. Use the creator's primary niche if not specified.",
        },
      },
      required: ['niche_slug'],
    },
  },
  {
    name: 'get_dimension_history',
    description: "Fetch the creator's dimension score history over the last 90 days. Use this when answering questions about score changes, trends, or 'why did my score drop/rise'.",
    input_schema: {
      type: 'object',
      properties: {
        days: {
          type: 'number',
          description: 'Number of days of history to fetch (default: 90)',
        },
      },
    },
  },
  {
    name: 'get_active_recommendations',
    description: "Fetch the creator's current active recommendations — the specific actions Creatrbase has identified to improve their commercial score. Use when answering 'what should I fix' or 'what's my priority'.",
    input_schema: { type: 'object', properties: {} },
  },
];

const TOOL_HANDLERS = {
  async get_creator_profile(_, { creatorId }) {
    if (!creatorId) return { error: 'No creator context available' };
    const prisma = getPrisma();

    const [commercial, niche, platform] = await Promise.all([
      prisma.creatorCommercialProfile.findFirst({
        where:  { creatorId },
        select: {
          commercialViabilityScore: true,
          viabilityScoreConfidence: true,
          viabilityBreakdown:       true,
          commercialTier:           true,
          gapPrimaryConstraint:     true,
          gapToNextTier:            true,
          estimatedRateLow:         true,
          estimatedRateHigh:        true,
          rateCurrency:             true,
          rateConfidence:           true,
          confirmedDealsCount:      true,
          viabilityLastCalculated:  true,
        },
      }),
      prisma.creatorNicheProfile.findFirst({
        where:  { creatorId, platform: 'youtube' },
        select: { primaryNicheCategory: true, primaryNicheSpecific: true, existingPartnerships: true },
      }),
      prisma.creatorPlatformProfile.findFirst({
        where:  { creatorId, platform: 'youtube' },
        select: {
          subscriberCount:    true,
          engagementRate30d:  true,
          avgViewsPerVideo30d: true,
          primaryAudienceGeo: true,
          publicUploads90d:   true,
        },
      }),
    ]);

    if (!commercial) return { status: 'no_score', message: 'Creator has not been scored yet.' };

    const breakdown = commercial.viabilityBreakdown || {};
    const subs = platform?.subscriberCount;

    return {
      score:            commercial.commercialViabilityScore,
      tier:             commercial.commercialTier,
      confidence:       commercial.viabilityScoreConfidence,
      last_scored:      commercial.viabilityLastCalculated,
      primary_constraint: commercial.gapPrimaryConstraint,
      gap_to_next_tier: commercial.gapToNextTier,
      rate_estimate:    (commercial.estimatedRateLow && commercial.estimatedRateHigh) ? {
        low:        commercial.estimatedRateLow,
        high:       commercial.estimatedRateHigh,
        currency:   commercial.rateCurrency ?? 'GBP',
        confidence: commercial.rateConfidence,
      } : null,
      confirmed_deals:  commercial.confirmedDealsCount,
      dimensions:       breakdown,
      niche:            niche ? { category: niche.primaryNicheCategory, specific: niche.primaryNicheSpecific } : null,
      subscriber_count: subs,
      subscriber_tier:  subscriberTier(subs),
      engagement_rate_30d: platform?.engagementRate30d ? Number(platform.engagementRate30d) : null,
      avg_views_30d:    platform?.avgViewsPerVideo30d ? Number(platform.avgViewsPerVideo30d) : null,
      primary_geo:      platform?.primaryAudienceGeo ?? null,
      uploads_90d:      platform?.publicUploads90d ?? null,
    };
  },

  async get_niche_benchmarks({ niche_slug }) {
    if (!niche_slug) return { error: 'niche_slug is required' };
    const pool = getPool();
    const { rows } = await pool.query(
      'SELECT platform, country, audience_tier, cpm_low, cpm_high, typical_rate_low, typical_rate_high, currency FROM cpm_benchmarks WHERE niche_slug = $1 ORDER BY country, platform, audience_tier',
      [niche_slug.toLowerCase()]
    );
    if (!rows.length) {
      return { niche_slug, available: false, message: `No benchmark data found for niche '${niche_slug}'. Try common slugs: gaming, finance, beauty, tech-reviews, lifestyle, fitness.` };
    }
    return { niche_slug, available: true, benchmarks: rows };
  },

  async get_dimension_history({ days }, { creatorId }) {
    if (!creatorId) return { error: 'No creator context available' };
    const prisma = getPrisma();
    const since = new Date(Date.now() - (days || 90) * 86400000);
    const rows = await prisma.dimensionScoreHistory.findMany({
      where:   { creatorId, scoredAt: { gte: since } },
      orderBy: { scoredAt: 'asc' },
      take:    30,
      select: {
        scoredAt:                   true,
        overallScore:               true,
        commercialTier:             true,
        subscriberMomentumScore:    true,
        engagementQualityScore:     true,
        nicheCommercialValueScore:  true,
        audienceGeoAlignmentScore:  true,
        contentConsistencyScore:    true,
        contentBrandAlignmentScore: true,
      },
    });
    if (!rows.length) return { available: false, message: 'No score history found in this period.' };
    return {
      available: true,
      period_days: days || 90,
      entries: rows.map(r => ({
        scored_at:              r.scoredAt,
        overall:                r.overallScore,
        tier:                   r.commercialTier,
        subscriber_momentum:    r.subscriberMomentumScore,
        engagement_quality:     r.engagementQualityScore,
        niche_commercial_value: r.nicheCommercialValueScore,
        audience_geo_alignment: r.audienceGeoAlignmentScore,
        content_consistency:    r.contentConsistencyScore,
        content_brand_alignment: r.contentBrandAlignmentScore,
      })),
    };
  },

  async get_active_recommendations(_, { creatorId }) {
    if (!creatorId) return { error: 'No creator context available' };
    const prisma = getPrisma();
    const recs = await prisma.recommendation.findMany({
      where:   { creatorId, status: { in: ['pending', 'accepted'] } },
      orderBy: { generatedAt: 'desc' },
      take:    3,
      select: {
        title:                    true,
        specificAction:           true,
        reasoning:                true,
        expectedImpactDescription: true,
        expectedImpactConfidence:  true,
        timeHorizon:              true,
        constraintDimension:      true,
        constraintSeverity:       true,
        status:                   true,
        generatedAt:              true,
      },
    });
    if (!recs.length) return { available: false, message: 'No active recommendations. Creator should re-score their channel.' };
    return { available: true, recommendations: recs };
  },
};

module.exports = { TOOL_DEFINITIONS, TOOL_HANDLERS };
