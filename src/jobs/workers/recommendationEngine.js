'use strict';

// ─── Recommendation engine worker ─────────────────────────────────────────────
// Job type: analysis:generate-recommendation  { creatorId }
//
// Flow:
//   1. Load scoring data, niche profile, platform profile, milestones
//   2. Identify primary constraint + build dimension data context
//   3. Create engine_run audit row
//   4. Supersede stale pending recommendations
//   5. Substitute template vars + call Claude (one retry on bad JSON)
//   6. Write recommendation row + complete engine_run
//
// Hard rules:
//   - Every Claude call must log prompt_version + raw output (Rule #3)
//   - Uses model claude-sonnet-4-6
//   - 1-hour cooldown: skip if a recommendation was generated < 1h ago
// ─────────────────────────────────────────────────────────────────────────────

const fs              = require('fs');
const path            = require('path');
const Anthropic       = require('@anthropic-ai/sdk');
const { getPrisma }   = require('../../lib/prisma');
const { getDataCollectionQueue } = require('../queue');

const PROMPT_VERSION  = 'task-generation-gap-closure-v1';
const PROMPT_TEMPLATE = fs.readFileSync(
  path.join(__dirname, '../../prompts/task-generation-gap-closure-v1.txt'),
  'utf8'
);
const MODEL      = 'claude-sonnet-4-6';
const MAX_TOKENS = 600;
const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toSeverity(state) {
  if (state === 'critical')     return 'critical';
  if (state === 'constraining') return 'significant';
  return 'moderate';
}

// Returns the label for the first non-crossed milestone
function nearestMilestone(milestones) {
  const order = [
    'giftable', 'outreach_ready', 'paid_integration_viable',
    'rate_negotiation_power', 'portfolio_creator',
  ];
  for (const type of order) {
    const m = milestones.find(m => m.milestoneType === type);
    if (!m || m.status !== 'crossed') return type.replace(/_/g, ' ');
  }
  return 'portfolio creator';
}

// Build dimension-specific raw data for the prompt context
function buildDimensionData(dimension, profile, nicheProfile) {
  switch (dimension) {
    case 'subscriber_momentum':
      return {
        subscriber_count:        profile?.subscriberCount,
        video_count:             profile?.videoCount,
        avg_views_per_video_30d: profile?.avgViewsPerVideo30d != null
          ? Number(profile.avgViewsPerVideo30d) : null,
      };
    case 'engagement_quality':
      return {
        engagement_rate_30d: profile?.engagementRate30d != null
          ? Number(profile.engagementRate30d) : null,
        subscriber_count:    profile?.subscriberCount,
        total_view_count:    profile?.totalViewCount != null
          ? Number(profile.totalViewCount) : null,
        video_count:         profile?.videoCount,
      };
    case 'niche_commercial_value':
      return {
        primary_niche_category:    nicheProfile?.primaryNicheCategory,
        primary_niche_specific:    nicheProfile?.primaryNicheSpecific,
        classification_confidence: nicheProfile?.classificationConfidence,
        existing_partnerships:     nicheProfile?.existingPartnerships,
        brand_mentions:            nicheProfile?.brandMentions,
        affiliate_domains:         nicheProfile?.affiliateDomainsDetected,
        promo_codes:               nicheProfile?.promoCodesDetected,
      };
    case 'audience_geo_alignment':
      return {
        primary_audience_geo: profile?.primaryAudienceGeo,
        note: 'Geo is a long-term strategic signal. Tasks targeting this dimension should set honest time expectations.',
      };
    case 'content_consistency':
      return {
        public_uploads_90d:  profile?.publicUploads90d,
        video_count:         profile?.videoCount,
        uploads_per_week_90d: profile?.publicUploads90d != null
          ? Math.round((profile.publicUploads90d / 13) * 10) / 10 : null,
      };
    case 'content_brand_alignment':
      return {
        existing_partnerships:  nicheProfile?.existingPartnerships,
        brand_mentions:         nicheProfile?.brandMentions,
        affiliate_domains:      nicheProfile?.affiliateDomainsDetected,
        promo_codes:            nicheProfile?.promoCodesDetected,
        niche:                  nicheProfile?.primaryNicheSpecific,
      };
    default:
      return {};
  }
}

function buildNicheBenchmark(dimension, nicheCategory) {
  const NICHE_BASE_SCORES = {
    gaming: 75, tech: 70, fitness: 65, beauty: 65,
    finance: 60, lifestyle: 50, other: 40,
  };
  const nicheScore = NICHE_BASE_SCORES[nicheCategory] ?? 40;

  const benchmarks = {
    subscriber_momentum:
      'Growing channels in this niche typically gain 5–50 subs/day at the emerging stage.',
    engagement_quality:
      `${nicheCategory} channels at the emerging tier typically see 2–4% engagement rate (likes + comments / views).`,
    niche_commercial_value:
      `${nicheCategory} niche commercial value benchmark: ${nicheScore}/100. Higher scores indicate denser brand spend.`,
    audience_geo_alignment:
      'UK and US audiences command the highest brand CPMs. EU is moderate. Global or non-EN audiences reduce rate potential.',
    content_consistency:
      'Brands in most niches prefer creators who post at least once per week, consistently.',
    content_brand_alignment:
      'Creators with at least one confirmed integration typically score 30+ points higher in this dimension.',
  };
  return benchmarks[dimension] ?? 'No benchmark data available.';
}

function buildPrompt({ dimension, dimensionScore, dimensionState, subscriberCount, nicheSpecific, nicheCategory, commercialTier, milestones, profile, nicheProfile }) {
  const severity      = toSeverity(dimensionState);
  const nearest       = nearestMilestone(milestones);
  const dimensionData = buildDimensionData(dimension, profile, nicheProfile);
  const benchmark     = buildNicheBenchmark(dimension, nicheCategory ?? 'other');

  const gapDescription = dimensionScore != null
    ? `Current score ${dimensionScore}/100 (${dimensionState}). Improving this dimension is the fastest route to the ${nearest} milestone.`
    : `No data available for this dimension yet. Task should focus on collecting the missing signal.`;

  return PROMPT_TEMPLATE
    .replace('{{platform}}',              'youtube')
    .replace('{{subscriber_count}}',      String(subscriberCount ?? 'unknown'))
    .replace('{{primary_niche_specific}}', nicheSpecific ?? 'unknown')
    .replace('{{primary_niche_category}}', nicheCategory ?? 'unknown')
    .replace('{{commercial_tier}}',       commercialTier ?? 'pre_commercial')
    .replace('{{nearest_milestone}}',     nearest)
    .replace('{{dimension}}',             dimension)
    .replace('{{dimension_score}}',       String(dimensionScore ?? 'unknown'))
    .replace('{{dimension_state}}',       dimensionState ?? 'unknown')
    .replace('{{constraint_severity}}',   severity)
    .replace('{{gap_description}}',       gapDescription)
    .replace('{{dimension_data_json}}',   JSON.stringify(dimensionData, null, 2))
    .replace('{{niche_benchmark}}',       benchmark)
    .replace('{{active_brands_summary}}', 'Brand registry not yet populated — focus on niche-relevant categories based on the creator\'s content.')
    .replace('{{creator_knowledge_context}}', nicheProfile?.nicheCommercialNotes ?? 'No additional context available.');
}

async function callClaude(prompt) {
  const client = new Anthropic();

  const [systemSection, userSection] = prompt.split(/^USER\n-+$/m);

  const response = await client.messages.create({
    model:      MODEL,
    max_tokens: MAX_TOKENS,
    system:     systemSection.replace(/^SYSTEM\n-+\n/m, '').trim(),
    messages:   [{ role: 'user', content: userSection.trim() }],
  });

  const rawOutput  = response.content[0]?.text ?? '';
  const tokensUsed = (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0);

  return { rawOutput, tokensUsed };
}

// ─── Worker registration ──────────────────────────────────────────────────────

function startRecommendationEngineWorker() {
  const queue  = getDataCollectionQueue();
  const prisma = getPrisma();

  queue.process('analysis:generate-recommendation', async (job) => {
    const { creatorId } = job.data;
    if (!creatorId) throw new Error('analysis:generate-recommendation missing creatorId');

    job.log(`Generating recommendation for creator ${creatorId}`);

    // ── 1. Cooldown check ─────────────────────────────────────────────────────
    const lastRec = await prisma.recommendation.findFirst({
      where:   { creatorId },
      orderBy: { generatedAt: 'desc' },
      select:  { generatedAt: true },
    });

    if (lastRec && (Date.now() - lastRec.generatedAt.getTime()) < COOLDOWN_MS) {
      job.log(`Cooldown active — last recommendation generated at ${lastRec.generatedAt.toISOString()}, skipping`);
      return;
    }

    // ── 2. Load data ──────────────────────────────────────────────────────────

    const creator = await prisma.creator.findUnique({
      where:  { id: creatorId },
      select: { id: true, tenantId: true },
    });
    if (!creator) throw new Error(`Creator ${creatorId} not found`);

    const commercialProfile = await prisma.creatorCommercialProfile.findUnique({
      where:  { creatorId },
      select: {
        commercialViabilityScore: true,
        commercialTier:           true,
        gapPrimaryConstraint:     true,
        viabilityBreakdown:       true,
      },
    });

    if (!commercialProfile?.gapPrimaryConstraint) {
      job.log('No scoring data available — skipping recommendation generation');
      return;
    }

    const [profile, nicheProfile, milestones] = await Promise.all([
      prisma.creatorPlatformProfile.findFirst({
        where:  { creatorId, platform: 'youtube' },
        select: {
          subscriberCount:     true,
          totalViewCount:      true,
          videoCount:          true,
          engagementRate30d:   true,
          publicUploads90d:    true,
          primaryAudienceGeo:  true,
          avgViewsPerVideo30d: true,
        },
      }),
      prisma.creatorNicheProfile.findFirst({
        where:  { creatorId, platform: 'youtube' },
        select: {
          primaryNicheCategory:    true,
          primaryNicheSpecific:    true,
          classificationConfidence: true,
          existingPartnerships:    true,
          affiliateDomainsDetected: true,
          brandMentions:           true,
          promoCodesDetected:      true,
          nicheCommercialNotes:    true,
        },
      }),
      prisma.creatorMilestone.findMany({
        where:  { creatorId },
        select: { milestoneType: true, status: true },
      }),
    ]);

    // ── 3. Create engine run ──────────────────────────────────────────────────

    const engineRun = await prisma.engineRun.create({
      data: {
        tenantId:  creator.tenantId,
        creatorId,
        runType:   'recommendation',
        status:    'running',
        startedAt: new Date(),
      },
    });

    const dimension      = commercialProfile.gapPrimaryConstraint;
    const breakdown      = commercialProfile.viabilityBreakdown ?? {};
    const dimData        = breakdown[dimension] ?? {};
    const dimensionScore = dimData.score ?? null;
    const dimensionState = dimData.state ?? null;

    // ── 4. Supersede stale pending recommendations ────────────────────────────
    await prisma.recommendation.updateMany({
      where: { creatorId, status: 'pending' },
      data:  { status: 'superseded' },
    });

    // ── 5. Build + call Claude ─────────────────────────────────────────────────
    const prompt = buildPrompt({
      dimension,
      dimensionScore,
      dimensionState,
      subscriberCount: profile?.subscriberCount,
      nicheSpecific:   nicheProfile?.primaryNicheSpecific,
      nicheCategory:   nicheProfile?.primaryNicheCategory,
      commercialTier:  commercialProfile.commercialTier,
      milestones,
      profile,
      nicheProfile,
    });

    let rawOutput, parsed;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        ({ rawOutput } = await callClaude(prompt));
        job.log(`Claude response (attempt ${attempt}): ${rawOutput.slice(0, 200)}`);
        console.log(`[recommendationEngine] prompt_version=${PROMPT_VERSION} raw_output=${rawOutput}`);

        parsed = JSON.parse(rawOutput.trim());

        // Handle prompt's ceiling-response sentinel
        if (parsed.error === 'dimension_at_ceiling') {
          job.log(`Dimension at ceiling (${parsed.dimension}) — no task generated`);
          await prisma.engineRun.update({
            where: { id: engineRun.id },
            data:  {
              status:               'complete',
              completedAt:          new Date(),
              constraintsIdentified: { ceiling: parsed.dimension },
            },
          });
          return;
        }

        if (!parsed.title || !parsed.description || !parsed.reasoning_summary) {
          throw new Error('Missing required fields in Claude output');
        }
        break;
      } catch (parseErr) {
        if (attempt === 2) {
          await prisma.engineRun.update({
            where: { id: engineRun.id },
            data:  { status: 'failed', errorDetails: parseErr.message, completedAt: new Date() },
          });
          throw parseErr;
        }
        job.log(`Attempt ${attempt} failed (${parseErr.message}) — retrying`);
      }
    }

    // ── 6. Write recommendation ───────────────────────────────────────────────

    await prisma.$transaction(async (tx) => {
      await tx.recommendation.create({
        data: {
          tenantId:                  creator.tenantId,
          creatorId,
          engineRunId:               engineRun.id,
          constraintDimension:       dimension,
          constraintSeverity:        toSeverity(dimensionState),
          title:                     parsed.title,
          specificAction:            parsed.description,
          reasoning:                 parsed.reasoning_summary,
          expectedImpactDescription: parsed.expected_impact,
          expectedImpactConfidence:  parsed.confidence,
          timeHorizon:               parsed.time_horizon,
          priorityRank:              1,
          promptVersion:             PROMPT_VERSION,
          rawInferenceOutput:        { text: rawOutput, parsed },
          status:                    'pending',
        },
      });

      await tx.engineRun.update({
        where: { id: engineRun.id },
        data:  {
          status:               'complete',
          completedAt:          new Date(),
          constraintsIdentified: {
            primary:  dimension,
            severity: toSeverity(dimensionState),
            score:    dimensionScore,
          },
        },
      });
    });

    job.log(`Recommendation generated: "${parsed.title}" targeting ${dimension}`);
    console.log(`[recommendationEngine] creator=${creatorId} dimension=${dimension} title="${parsed.title}"`);
  });

  console.log('[recommendationEngine] worker registered on data-collection queue');
}

module.exports = { startRecommendationEngineWorker };
