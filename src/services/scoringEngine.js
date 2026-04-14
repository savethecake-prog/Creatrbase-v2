'use strict';

// ─── Commercial viability scoring engine ─────────────────────────────────────
// Pure calculation functions — no DB calls. The worker loads data and passes
// it in; this module only transforms inputs into scores.
//
// Six dimensions, each scored 0–100 with a confidence level:
//   subscriber_momentum      (25%) — growth velocity
//   engagement_quality       (20%) — content resonance
//   niche_commercial_value   (20%) — brand spend density in this niche
//   audience_geo_alignment   (15%) — audience geography vs. brand markets
//   content_consistency      (10%) — posting cadence
//   content_brand_alignment  (10%) — commercial signals in content
//
// IMPORTANT: The base benchmarks below (NICHE_BASE_SCORES, GEO_SCORES) are
// initial values calibrated from public market knowledge at launch. As
// brand_tier_profiles data accumulates, these should be pulled from the DB
// rather than hardcoded here. They are intentionally documented and centralised
// for that reason — NOT scattered across prompt templates.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Weights ──────────────────────────────────────────────────────────────────

const WEIGHTS = {
  subscriber_momentum:    0.25,
  engagement_quality:     0.20,
  niche_commercial_value: 0.20,
  audience_geo_alignment: 0.15,
  content_consistency:    0.10,
  content_brand_alignment:0.10,
};

// ─── Tier boundaries (product design — not data-derived) ─────────────────────

const TIER_THRESHOLDS = {
  established:    75,
  viable:         50,
  emerging:       25,
  pre_commercial:  0,
};

// ─── Initial benchmark tables (to be superseded by DB data at scale) ─────────

// Base commercial density by niche category.
// Source: public industry knowledge of brand spend patterns at launch.
const NICHE_BASE_SCORES = {
  gaming:    75,
  tech:      70,
  fitness:   65,
  beauty:    65,
  finance:   60,
  lifestyle: 50,
  other:     40,
};

// Primary audience geography relative to high-value brand markets (UK/US).
const GEO_SCORES = {
  UK:     90,
  US:     85,
  EU:     70,
  global: 55,
};

// ─── Dimension: subscriber_momentum ──────────────────────────────────────────
// Measures: subscriber growth velocity.
// Best input: velocity from recent snapshot pair.
// Fallback: absolute count proxy (low confidence).

function scoreSubscriberMomentum({ subscriberCount, subVelocityPerDay, snapshotCount }) {
  if (snapshotCount < 2 || subVelocityPerDay == null) {
    // Fall back to absolute count as a rough proxy with low confidence
    if (subscriberCount == null) {
      return { score: null, confidence: 'insufficient_data', state: 'insufficient_data' };
    }
    // Rough absolute-count proxy: not a growth signal, just a presence signal
    const proxyScore = clamp(Math.round(
      subscriberCount < 500    ? 10 :
      subscriberCount < 1_000  ? 18 :
      subscriberCount < 5_000  ? 28 :
      subscriberCount < 10_000 ? 40 :
      subscriberCount < 50_000 ? 55 :
      subscriberCount < 100_000? 70 : 82
    ), 0, 100);
    return { score: proxyScore, confidence: 'low', state: classify(proxyScore) };
  }

  // Velocity-based scoring (preferred path)
  const v = subVelocityPerDay;
  const score = clamp(Math.round(
    v <= 0    ? 5 :
    v < 1     ? 15 :
    v < 5     ? 28 :
    v < 20    ? 45 :
    v < 50    ? 62 :
    v < 100   ? 75 :
    v < 200   ? 85 : 93
  ), 0, 100);

  return { score, confidence: 'high', state: classify(score) };
}

// ─── Dimension: engagement_quality ───────────────────────────────────────────
// Measures: how well content resonates relative to audience size.
//
// Signal hierarchy:
//   1. engagementRate30d + avgViewsPerVideo30d — both available → blend, high confidence
//   2. engagementRate30d only                  → primary signal, medium confidence
//   3. avgViewsPerVideo30d + subscriberCount   → view-to-sub ratio, medium confidence
//   4. all-time views / videoCount / subs      → low confidence proxy
//
// avgViewsPerVideo30d is scored as a fraction of subscriberCount (view-to-sub ratio):
//   < 5% = poor resonance (10), 5–15% = below avg (28), 15–30% = average (45),
//   30–60% = good (62), 60–100% = very good (78), > 100% = exceptional (92)

function scoreEngagementQuality({ engagementRate30d, avgViewsPerVideo30d, totalViewCount, videoCount, subscriberCount }) {
  const hasEngRate = engagementRate30d != null;
  const hasAvgViews = avgViewsPerVideo30d != null && subscriberCount != null && subscriberCount > 0;

  // Score from explicit engagement rate (likes + comments / views)
  function engRateScore(rate30d) {
    const rate = Number(rate30d) * 100;
    return clamp(Math.round(
      rate < 0.5 ? 10 :
      rate < 1   ? 20 :
      rate < 2   ? 38 :
      rate < 3   ? 52 :
      rate < 5   ? 65 :
      rate < 8   ? 78 : 90
    ), 0, 100);
  }

  // Score from 30d avg views relative to subscriber count
  function avgViewsScore(avgViews30d, subs) {
    const ratio = Number(avgViews30d) / subs;
    return clamp(Math.round(
      ratio < 0.05  ? 10 :
      ratio < 0.15  ? 28 :
      ratio < 0.30  ? 45 :
      ratio < 0.60  ? 62 :
      ratio < 1.00  ? 78 : 92
    ), 0, 100);
  }

  // Both signals available — blend for highest accuracy
  if (hasEngRate && hasAvgViews) {
    const scoreA = engRateScore(engagementRate30d);
    const scoreB = avgViewsScore(avgViewsPerVideo30d, subscriberCount);
    const blended = clamp(Math.round(scoreA * 0.6 + scoreB * 0.4), 0, 100);
    return { score: blended, confidence: 'high', state: classify(blended) };
  }

  // Engagement rate only
  if (hasEngRate) {
    const score = engRateScore(engagementRate30d);
    return { score, confidence: 'medium', state: classify(score) };
  }

  // Avg views only (no engagement rate yet)
  if (hasAvgViews) {
    const score = avgViewsScore(avgViewsPerVideo30d, subscriberCount);
    return { score, confidence: 'medium', state: classify(score) };
  }

  // Fallback: all-time views per video as fraction of subscriber count (low confidence)
  if (totalViewCount != null && videoCount != null && videoCount > 0 && subscriberCount != null && subscriberCount > 0) {
    const avgViews  = Number(totalViewCount) / videoCount;
    const viewRatio = avgViews / subscriberCount;
    const score = clamp(Math.round(
      viewRatio < 0.01 ? 10 :
      viewRatio < 0.05 ? 22 :
      viewRatio < 0.15 ? 38 :
      viewRatio < 0.30 ? 52 :
      viewRatio < 0.60 ? 65 : 78
    ), 0, 100);
    return { score, confidence: 'low', state: classify(score) };
  }

  return { score: null, confidence: 'insufficient_data', state: 'insufficient_data' };
}

// ─── Dimension: niche_commercial_value ───────────────────────────────────────
// Measures: how commercially valuable this niche is for brand spend.
// Input: niche classification output.

function scoreNicheCommercialValue({ primaryNicheCategory, classificationConfidence, existingPartnerships, affiliateDomainsDetected, brandMentions }) {
  if (!primaryNicheCategory) {
    return { score: null, confidence: 'insufficient_data', state: 'insufficient_data' };
  }

  let base = NICHE_BASE_SCORES[primaryNicheCategory] ?? 40;

  // Confidence discount — low-confidence classification less trustworthy
  const confMultiplier = classificationConfidence === 'high' ? 1.0
                       : classificationConfidence === 'medium' ? 0.85 : 0.70;
  base = Math.round(base * confMultiplier);

  // Commercial signal bonuses
  if (existingPartnerships) base = Math.min(100, base + 10);
  if ((affiliateDomainsDetected?.length ?? 0) > 0) base = Math.min(100, base + 5);
  if ((brandMentions?.length ?? 0) > 2) base = Math.min(100, base + 5);

  const confidence = classificationConfidence === 'high' ? 'medium'
                   : classificationConfidence === 'medium' ? 'low' : 'low';

  return { score: clamp(base, 0, 100), confidence, state: classify(base) };
}

// ─── Dimension: audience_geo_alignment ───────────────────────────────────────
// Measures: whether audience geography matches high-value brand markets.
// Best input: primary_audience_geo (not synced at launch — marked insufficient).

function scoreAudienceGeoAlignment({ primaryAudienceGeo }) {
  if (!primaryAudienceGeo) {
    // We don't sync audience geo yet — return insufficient rather than guess
    return { score: null, confidence: 'insufficient_data', state: 'insufficient_data' };
  }

  const score = GEO_SCORES[primaryAudienceGeo] ?? 45;
  return { score: clamp(score, 0, 100), confidence: 'medium', state: classify(score) };
}

// ─── Dimension: content_consistency ──────────────────────────────────────────
// Measures: posting cadence reliability.
// Best input: public_uploads_90d (not synced at launch — use video count proxy).

function scoreContentConsistency({ publicUploads90d, videoCount }) {
  if (publicUploads90d != null) {
    const perWeek = publicUploads90d / 13;
    const score = clamp(Math.round(
      perWeek === 0        ? 0  :
      perWeek < 0.25       ? 12 :
      perWeek < 0.5        ? 22 :
      perWeek < 1          ? 38 :
      perWeek < 2          ? 55 :
      perWeek < 3          ? 70 :
      perWeek < 4          ? 82 : 92
    ), 0, 100);
    return { score, confidence: 'medium', state: classify(score) };
  }

  // No 90d upload data — we can't score this reliably
  return { score: null, confidence: 'insufficient_data', state: 'insufficient_data' };
}

// ─── Dimension: content_brand_alignment ──────────────────────────────────────
// Measures: how commercially aligned the content is based on observed signals.

function scoreContentBrandAlignment({ existingPartnerships, brandMentions, affiliateDomainsDetected, promoCodesDetected, primaryNicheCategory, classificationConfidence }) {
  if (!classificationConfidence || classificationConfidence === 'low') {
    return { score: null, confidence: 'insufficient_data', state: 'insufficient_data' };
  }

  let score = 15; // baseline: niche classified but no brand signals

  if (existingPartnerships)                                 score += 30;
  if ((brandMentions?.length ?? 0) > 0)                    score += 15;
  if ((affiliateDomainsDetected?.length ?? 0) > 0)         score += 15;
  if ((promoCodesDetected?.length ?? 0) > 0)               score += 10;
  if (['gaming', 'tech'].includes(primaryNicheCategory))   score += 8;
  if (classificationConfidence === 'high')                 score += 7;

  return {
    score:      clamp(score, 0, 100),
    confidence: existingPartnerships ? 'medium' : 'low',
    state:      classify(score),
  };
}

// ─── Overall score + tier ─────────────────────────────────────────────────────
// Dimensions with insufficient_data are excluded from the weighted average
// and their weight is redistributed proportionally to the scored dimensions.

function calculateOverallScore(dimensions) {
  const scored = Object.entries(dimensions).filter(([, d]) => d.score != null);
  if (scored.length === 0) return { overallScore: null, confidence: 'insufficient_data' };

  const totalWeight = scored.reduce((sum, [key]) => sum + WEIGHTS[key], 0);
  const weighted    = scored.reduce((sum, [key, d]) => sum + d.score * WEIGHTS[key], 0);

  const overallScore = clamp(Math.round(weighted / totalWeight), 0, 100);

  // Overall confidence = worst of the scored dimensions, capped at medium if any are low
  const confidences  = scored.map(([, d]) => d.confidence);
  const overallConf  = confidences.includes('low') ? 'low'
                     : confidences.every(c => c === 'high') ? 'high' : 'medium';

  return { overallScore, confidence: overallConf };
}

function getTier(score) {
  if (score == null)       return null;
  if (score >= TIER_THRESHOLDS.established) return 'established';
  if (score >= TIER_THRESHOLDS.viable)      return 'viable';
  if (score >= TIER_THRESHOLDS.emerging)    return 'emerging';
  return 'pre_commercial';
}

// ─── Primary constraint ───────────────────────────────────────────────────────
// The dimension most blocking progress. Picks the scored dimension with the
// lowest weighted score — ie. the one contributing the least to overall viability.

function getPrimaryConstraint(dimensions) {
  let worst = null;
  let worstWeighted = Infinity;

  for (const [key, dim] of Object.entries(dimensions)) {
    if (dim.score == null) continue;
    const weighted = dim.score * WEIGHTS[key];
    if (weighted < worstWeighted) {
      worstWeighted = weighted;
      worst = key;
    }
  }
  return worst;
}

// ─── Gap to next tier ─────────────────────────────────────────────────────────

function getGapToNextTier(overallScore, dimensions) {
  const currentTier = getTier(overallScore);
  const tierOrder = ['pre_commercial', 'emerging', 'viable', 'established'];
  const currentIdx = tierOrder.indexOf(currentTier);
  if (currentIdx === tierOrder.length - 1) return null; // already at top

  const nextTier  = tierOrder[currentIdx + 1];
  const threshold = TIER_THRESHOLDS[nextTier];
  const gap       = Math.max(0, threshold - overallScore);

  // Which dimensions, if improved, would close the gap most efficiently
  const scored = Object.entries(dimensions)
    .filter(([, d]) => d.score != null && d.score < 90)
    .map(([key, d]) => ({
      dimension:        key,
      currentScore:     d.score,
      potentialGain:    Math.round((90 - d.score) * WEIGHTS[key]),
      weight:           WEIGHTS[key],
    }))
    .sort((a, b) => b.potentialGain - a.potentialGain);

  return {
    nextTier,
    pointsNeeded:   gap,
    topOpportunities: scored.slice(0, 3),
  };
}

// ─── Milestone evaluation ─────────────────────────────────────────────────────
// Returns the status for each milestone based on current scores.
// Status: not_started → in_progress → approaching → crossed

const MILESTONES = [
  {
    type: 'giftable',
    // Brand willing to send product: niche must be identifiable + some brand alignment
    check: ({ dimensions, nicheClassified }) => {
      if (!nicheClassified) return 'not_started';
      const niche    = dimensions.niche_commercial_value?.score ?? 0;
      const brand    = dimensions.content_brand_alignment?.score ?? 0;
      const combined = (niche + brand) / 2;
      if (combined >= 55) return 'crossed';
      if (combined >= 40) return 'approaching';
      if (combined >= 20) return 'in_progress';
      return 'not_started';
    },
    crossingMetric: 'niche_commercial_value_score',
    capabilities: ['receive_gifted_products', 'gifting_outreach'],
  },
  {
    type: 'outreach_ready',
    // Ready to initiate brand contact: momentum + overall score threshold
    check: ({ dimensions, overallScore }) => {
      const momentum = dimensions.subscriber_momentum?.score ?? 0;
      if (overallScore >= 45 && momentum >= 40) return 'crossed';
      if (overallScore >= 35 && momentum >= 30) return 'approaching';
      if (overallScore >= 25) return 'in_progress';
      return 'not_started';
    },
    crossingMetric: 'overall_score',
    capabilities: ['brand_outreach', 'cold_email_templates'],
  },
  {
    type: 'paid_integration_viable',
    // Brands will consider paid deals: overall viability + niche value
    check: ({ dimensions, overallScore }) => {
      const niche = dimensions.niche_commercial_value?.score ?? 0;
      if (overallScore >= 55 && niche >= 55) return 'crossed';
      if (overallScore >= 45 && niche >= 45) return 'approaching';
      if (overallScore >= 35) return 'in_progress';
      return 'not_started';
    },
    crossingMetric: 'commercial_viability_score',
    capabilities: ['rate_card', 'negotiation_support', 'deal_tracking'],
  },
  {
    type: 'rate_negotiation_power',
    // Has enough leverage to negotiate: established signals + brand history
    check: ({ dimensions, overallScore, confirmedDealsCount }) => {
      const brand = dimensions.content_brand_alignment?.score ?? 0;
      if (overallScore >= 70 && (confirmedDealsCount > 0 || brand >= 60)) return 'crossed';
      if (overallScore >= 60 && brand >= 50) return 'approaching';
      if (overallScore >= 50) return 'in_progress';
      return 'not_started';
    },
    crossingMetric: 'commercial_viability_score',
    capabilities: ['counter_offer_support', 'rate_benchmarking', 'deal_terms_guidance'],
  },
  {
    type: 'portfolio_creator',
    // Portfolio-level commercial creator
    check: ({ overallScore, confirmedDealsCount }) => {
      if (overallScore >= 80 && confirmedDealsCount >= 3) return 'crossed';
      if (overallScore >= 75) return 'approaching';
      if (overallScore >= 65) return 'in_progress';
      return 'not_started';
    },
    crossingMetric: 'commercial_viability_score',
    capabilities: ['portfolio_analytics', 'brand_relationship_management', 'rate_optimisation'],
  },
];

function evaluateMilestones({ dimensions, overallScore, confirmedDealsCount, nicheClassified }) {
  return MILESTONES.map(m => ({
    type:       m.type,
    status:     m.check({ dimensions, overallScore, confirmedDealsCount, nicheClassified }),
    crossingMetric: m.crossingMetric,
    capabilities:   m.capabilities,
  }));
}

// ─── Main entry point ─────────────────────────────────────────────────────────

function runScoringEngine({
  // Platform profile
  subscriberCount,
  totalViewCount,
  videoCount,
  engagementRate30d,
  avgViewsPerVideo30d,
  publicUploads90d,
  primaryAudienceGeo,
  // Snapshot velocity
  subVelocityPerDay,
  snapshotCount,
  // Niche profile
  primaryNicheCategory,
  classificationConfidence,
  existingPartnerships,
  affiliateDomainsDetected,
  brandMentions,
  promoCodesDetected,
  // Commercial history
  confirmedDealsCount = 0,
}) {
  const nicheClassified = !!primaryNicheCategory && classificationConfidence !== null;

  const dimensions = {
    subscriber_momentum:     scoreSubscriberMomentum({ subscriberCount, subVelocityPerDay, snapshotCount }),
    engagement_quality:      scoreEngagementQuality({ engagementRate30d, avgViewsPerVideo30d, totalViewCount, videoCount, subscriberCount }),
    niche_commercial_value:  scoreNicheCommercialValue({ primaryNicheCategory, classificationConfidence, existingPartnerships, affiliateDomainsDetected, brandMentions }),
    audience_geo_alignment:  scoreAudienceGeoAlignment({ primaryAudienceGeo }),
    content_consistency:     scoreContentConsistency({ publicUploads90d, videoCount }),
    content_brand_alignment: scoreContentBrandAlignment({ existingPartnerships, brandMentions, affiliateDomainsDetected, promoCodesDetected, primaryNicheCategory, classificationConfidence }),
  };

  const { overallScore, confidence: overallConfidence } = calculateOverallScore(dimensions);
  const tier               = getTier(overallScore);
  const primaryConstraint  = getPrimaryConstraint(dimensions);
  const gapToNextTier      = overallScore != null ? getGapToNextTier(overallScore, dimensions) : null;
  const milestones         = evaluateMilestones({ dimensions, overallScore: overallScore ?? 0, confirmedDealsCount, nicheClassified });

  return {
    dimensions,
    overallScore,
    overallConfidence,
    tier,
    primaryConstraint,
    gapToNextTier,
    milestones,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// Classify a score into a dimension state label
function classify(score) {
  if (score >= 80) return 'ceiling';
  if (score >= 50) return 'healthy';
  if (score >= 25) return 'constraining';
  return 'critical';
}

module.exports = {
  runScoringEngine,
  WEIGHTS,
  TIER_THRESHOLDS,
  MILESTONES,
};
