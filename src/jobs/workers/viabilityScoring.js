'use strict';

// ─── Viability scoring worker ─────────────────────────────────────────────────
// Job type: analysis:score-creator  { creatorId, triggerType }
//
// Flow:
//   1. Load platform profile + velocity snapshots + niche profile
//   2. Run scoringEngine.runScoringEngine() — pure calculation
//   3. Upsert creator_commercial_profiles
//   4. Append to dimension_score_history
//   5. Upsert creator_milestones for all five milestone types
// ─────────────────────────────────────────────────────────────────────────────

const { getPrisma }              = require('../../lib/prisma');
const { getPool }                = require('../../db/pool');
const { runScoringEngine }       = require('../../services/scoringEngine');
const { getDataCollectionQueue } = require('../queue');

function startViabilityScoringWorker() {
  const queue  = getDataCollectionQueue();
  const prisma = getPrisma();

  queue.process('analysis:score-creator', async (job) => {
    const { creatorId, triggerType = 'content_analysis_complete' } = job.data;
    if (!creatorId) throw new Error('analysis:score-creator missing creatorId');

    job.log(`Scoring creator ${creatorId} (trigger: ${triggerType})`);

    // ── 1. Load data ───────────────────────────────────────────────────────────

    const creator = await prisma.creator.findUnique({
      where:  { id: creatorId },
      select: { id: true, tenantId: true },
    });
    if (!creator) throw new Error(`Creator ${creatorId} not found`);

    const ytProfile = await prisma.creatorPlatformProfile.findFirst({
      where:  { creatorId, platform: 'youtube' },
      select: {
        id: true,
        subscriberCount: true,
        totalViewCount: true,
        videoCount: true,
        engagementRate30d: true,
        avgViewsPerVideo30d: true,
        publicUploads90d: true,
        primaryAudienceGeo: true,
      },
    });

    // Two most recent snapshots for velocity
    const snapshots = ytProfile ? await prisma.platformMetricsSnapshot.findMany({
      where:   { platformProfileId: ytProfile.id },
      orderBy: { recordedAt: 'desc' },
      take:    2,
      select:  { subscriberCount: true, recordedAt: true },
    }) : [];

    let subVelocityPerDay = null;
    if (snapshots.length >= 2) {
      const [newer, older] = snapshots;
      const days = (newer.recordedAt - older.recordedAt) / 86_400_000;
      if (days > 0) {
        subVelocityPerDay = ((newer.subscriberCount ?? 0) - (older.subscriberCount ?? 0)) / days;
      }
    }

    const nicheProfile = await prisma.creatorNicheProfile.findFirst({
      where:  { creatorId, platform: 'youtube' },
      select: {
        primaryNicheCategory:    true,
        classificationConfidence: true,
        existingPartnerships:    true,
        affiliateDomainsDetected: true,
        brandMentions:           true,
        promoCodesDetected:      true,
      },
    });

    const commercialProfile = await prisma.creatorCommercialProfile.findUnique({
      where:  { creatorId },
      select: { confirmedDealsCount: true },
    });

    // ── 2. Derive niche benchmark from signal data (if enough data points) ────
    // Prefer real-world deal rates from cpm_benchmarks over hardcoded defaults
    // once the platform has >=5 signal-confirmed deals for this niche.

    let nicheBaseScore = null;
    const nicheSlug = nicheProfile?.primaryNicheCategory?.toLowerCase().replace(/\s+/g, '-');
    if (nicheSlug) {
      const pool = getPool();
      const { rows: benchRows } = await pool.query(
        `SELECT typical_rate_high, COUNT(*) OVER () AS data_point_count
         FROM cpm_benchmarks
         WHERE niche_slug = $1
           AND source = 'signal_feedback'
           AND typical_rate_high IS NOT NULL
         LIMIT 1`,
        [nicheSlug]
      );
      if (benchRows.length > 0) {
        const { rows: countRows } = await pool.query(
          `SELECT COUNT(*) AS cnt
           FROM brand_creator_interactions bci
           JOIN signal_events se ON se.source_interaction_id = bci.id
           WHERE bci.niche = $1
             AND bci.interaction_type = 'deal_completed'
             AND se.signal_type = 'deal_closed'
             AND se.status = 'applied'`,
          [nicheProfile.primaryNicheCategory]
        );
        const dataPoints = parseInt(countRows[0]?.cnt ?? '0', 10);
        if (dataPoints >= 5) {
          const rateHighPence = benchRows[0].typical_rate_high;
          const pounds = rateHighPence / 100;
          nicheBaseScore = pounds >= 5000 ? 85
                         : pounds >= 3500 ? 75
                         : pounds >= 2000 ? 65
                         : pounds >= 1000 ? 55
                         : pounds >= 500  ? 45
                         : 35;
          job.log(`Using signal-derived niche benchmark: niche=${nicheSlug} rate=£${Math.round(pounds)} → nicheBaseScore=${nicheBaseScore} (${dataPoints} data points)`);
        }
      }
    }

    // ── 3. Run scoring engine ──────────────────────────────────────────────────

    const result = runScoringEngine({
      // Platform metrics
      subscriberCount:       ytProfile?.subscriberCount ?? null,
      totalViewCount:        ytProfile?.totalViewCount != null ? Number(ytProfile.totalViewCount) : null,
      videoCount:            ytProfile?.videoCount ?? null,
      engagementRate30d:     ytProfile?.engagementRate30d != null ? Number(ytProfile.engagementRate30d) : null,
      avgViewsPerVideo30d:   ytProfile?.avgViewsPerVideo30d != null ? Number(ytProfile.avgViewsPerVideo30d) : null,
      publicUploads90d:      ytProfile?.publicUploads90d ?? null,
      primaryAudienceGeo:    ytProfile?.primaryAudienceGeo ?? null,
      // Velocity
      subVelocityPerDay,
      snapshotCount:       snapshots.length,
      // Niche
      primaryNicheCategory:    nicheProfile?.primaryNicheCategory ?? null,
      classificationConfidence: nicheProfile?.classificationConfidence ?? null,
      existingPartnerships:    nicheProfile?.existingPartnerships ?? false,
      affiliateDomainsDetected: nicheProfile?.affiliateDomainsDetected ?? [],
      brandMentions:           nicheProfile?.brandMentions ?? [],
      promoCodesDetected:      nicheProfile?.promoCodesDetected ?? [],
      // Commercial history
      confirmedDealsCount: commercialProfile?.confirmedDealsCount ?? 0,
      // Signal-derived niche benchmark (null = use hardcoded defaults)
      nicheBaseScore,
    });

    const { dimensions, overallScore, overallConfidence, tier, primaryConstraint, gapToNextTier, milestones } = result;

    job.log(`Score: ${overallScore} (${tier}) | constraint: ${primaryConstraint} | confidence: ${overallConfidence}`);

    // ── 4. Persist ─────────────────────────────────────────────────────────────

    await prisma.$transaction(async (tx) => {

      // Upsert creator_commercial_profiles
      const breakdownForStorage = Object.fromEntries(
        Object.entries(dimensions).map(([k, v]) => [k, v])
      );

      await tx.creatorCommercialProfile.upsert({
        where:  { creatorId },
        update: {
          commercialViabilityScore: overallScore,
          viabilityScoreConfidence: overallConfidence,
          viabilityLastCalculated:  new Date(),
          viabilityBreakdown:       breakdownForStorage,
          commercialTier:           tier,
          gapToNextTier,
          gapPrimaryConstraint:     primaryConstraint,
          updatedAt:                new Date(),
        },
        create: {
          tenantId:                 creator.tenantId,
          creatorId,
          commercialViabilityScore: overallScore,
          viabilityScoreConfidence: overallConfidence,
          viabilityLastCalculated:  new Date(),
          viabilityBreakdown:       breakdownForStorage,
          commercialTier:           tier,
          gapToNextTier,
          gapPrimaryConstraint:     primaryConstraint,
        },
      });

      // Append history row
      const d = dimensions;
      await tx.dimensionScoreHistory.create({
        data: {
          tenantId:                   creator.tenantId,
          creatorId,
          triggerType,
          subscriberMomentumScore:    d.subscriber_momentum?.score ?? null,
          subscriberMomentumConf:     d.subscriber_momentum?.confidence ?? null,
          engagementQualityScore:     d.engagement_quality?.score ?? null,
          engagementQualityConf:      d.engagement_quality?.confidence ?? null,
          nicheCommercialValueScore:  d.niche_commercial_value?.score ?? null,
          nicheCommercialValueConf:   d.niche_commercial_value?.confidence ?? null,
          audienceGeoAlignmentScore:  d.audience_geo_alignment?.score ?? null,
          audienceGeoAlignmentConf:   d.audience_geo_alignment?.confidence ?? null,
          contentConsistencyScore:    d.content_consistency?.score ?? null,
          contentConsistencyConf:     d.content_consistency?.confidence ?? null,
          contentBrandAlignmentScore: d.content_brand_alignment?.score ?? null,
          contentBrandAlignmentConf:  d.content_brand_alignment?.confidence ?? null,
          overallScore,
          commercialTier:             tier,
        },
      });

      // Upsert all five milestones
      for (const ms of milestones) {
        const now = new Date();
        const existing = await tx.creatorMilestone.findUnique({
          where: { creatorId_milestoneType: { creatorId, milestoneType: ms.type } },
          select: { status: true, crossedAt: true, firstShownAt: true },
        });

        const justCrossed = ms.status === 'crossed' && existing?.status !== 'crossed';

        await tx.creatorMilestone.upsert({
          where:  { creatorId_milestoneType: { creatorId, milestoneType: ms.type } },
          update: {
            status:              ms.status,
            crossedAt:           justCrossed ? now : (existing?.crossedAt ?? null),
            crossingMetric:      ms.crossingMetric,
            capabilitiesUnlocked: ms.capabilities,
            firstShownAt:        existing?.firstShownAt ?? now,
            updatedAt:           now,
          },
          create: {
            tenantId:            creator.tenantId,
            creatorId,
            milestoneType:       ms.type,
            status:              ms.status,
            crossedAt:           ms.status === 'crossed' ? now : null,
            crossingMetric:      ms.crossingMetric,
            capabilitiesUnlocked: ms.capabilities,
            firstShownAt:        now,
          },
        });
      }
    });

    console.log(`[viabilityScoring] creator=${creatorId} score=${overallScore} tier=${tier} constraint=${primaryConstraint}`);

    // Trigger recommendation engine — picks up the new scoring data immediately
    if (primaryConstraint) {
      await queue.add('analysis:generate-recommendation', { creatorId });
    }

    // Retention notifications — fire after every scoring run
    await queue.add('notifications:milestone-alert', { creatorId });
    await queue.add('notifications:score-change',    { creatorId });
    // Pass the score before this run so brand-match can check threshold crossings
    const previousScoreRow = await prisma.dimensionScoreHistory.findFirst({
      where:   { creatorId },
      orderBy: { scoredAt: 'desc' },
      skip:    1,
      select:  { overallScore: true },
    });
    await queue.add('notifications:brand-match', {
      creatorId,
      previousScore: previousScoreRow?.overallScore ?? null,
    });
  });

  console.log('[viabilityScoring] worker registered on data-collection queue');
}

module.exports = { startViabilityScoringWorker };
