'use strict';

// ─── Public scoring adapter ──────────────────────────────────────────────────
// Wraps runScoringEngine() for public-data-only mode.
// All analytics-gated fields are null → scoring engine returns low confidence.
// ─────────────────────────────────────────────────────────────────────────────

const { runScoringEngine } = require('./scoringEngine');

const TIER_LABELS = {
  pre_commercial: 'Pre-Commercial',
  emerging:       'Emerging',
  viable:         'Viable',
  established:    'Established',
};

const DIMENSION_LABELS = {
  subscriber_momentum:     'Subscriber momentum',
  engagement_quality:      'Engagement quality',
  niche_commercial_value:  'Niche commercial value',
  audience_geo_alignment:  'Audience geo alignment',
  content_consistency:     'Content consistency',
  content_brand_alignment: 'Content brand alignment',
};

const TIER_SENTENCES = {
  pre_commercial: 'At this stage, gifting and product seeding are the most likely brand engagement routes. Improving your top constraint is the fastest path to unlocking paid opportunities.',
  emerging:       'Some brands in high-density niches will consider engagement-based arrangements at this level. Closing the gap on your weakest dimension moves you toward viable outreach.',
  viable:         'Your metrics are sufficient for most brand categories to consider a paid partnership. Direct outreach with a data-backed pitch is now a productive strategy.',
  established:    'You are operating at a level where inbound brand interest is realistic and your negotiating position is meaningful.',
};

function calculatePublicScore(platform, channelData) {
  const isYoutube = platform === 'youtube';
  const isTikTok  = platform === 'tiktok';

  const input = {
    subscriberCount:         isYoutube ? channelData.subscriberCount
                           : isTikTok  ? (channelData.followerCount ?? channelData.subscriberCount ?? 0)
                           :              (channelData.followerCount ?? 0),
    totalViewCount:          isYoutube ? channelData.totalViewCount : null,
    videoCount:              isYoutube ? channelData.videoCount
                           : isTikTok  ? (channelData.videoCount ?? null)
                           :              null,
    engagementRate30d:       isTikTok  ? (channelData.engagementRate30d ?? null)
                           : isYoutube ? (channelData.engagementRate    ?? null)
                           :              null,
    avgViewsPerVideo30d:     isYoutube ? channelData.avgViewsLast15
                           : isTikTok  ? (channelData.avgViewsPerVideo30d ?? null)
                           :              null,
    publicUploads90d:        isYoutube ? (channelData.publicUploads90d ?? null) : null,
    primaryAudienceGeo:      null,       // not available from TikTok public API
    subVelocityPerDay:       null,       // requires snapshot history
    snapshotCount:           0,          // no snapshots for public score
    primaryNicheCategory:    null,       // requires content analysis
    classificationConfidence: null,
    existingPartnerships:    false,
    affiliateDomainsDetected: [],
    brandMentions:           [],
    promoCodesDetected:      [],
    confirmedDealsCount:     0,
  };

  const result = runScoringEngine(input);

  const tierLabel   = TIER_LABELS[result.tier] ?? result.tier ?? 'Unknown';
  const constraint  = result.primaryConstraint;
  const dimLabel    = DIMENSION_LABELS[constraint] ?? constraint ?? 'Unknown dimension';
  const tierSentence = TIER_SENTENCES[result.tier] ?? '';

  const whatThisMeans = `Your channel scores ${result.overallScore ?? '?'}/100, placing you in the ${tierLabel} tier. ` +
    `Your top constraint is ${dimLabel.toLowerCase()}. ${tierSentence}`;

  const confidenceSummary = {};
  for (const [key, dim] of Object.entries(result.dimensions)) {
    confidenceSummary[key] = dim.confidence;
  }

  return {
    overallScore:     result.overallScore,
    tier:             result.tier,
    tierLabel,
    primaryConstraint: constraint,
    constraintLabel:  dimLabel,
    dimensions:       result.dimensions,
    confidenceSummary,
    whatThisMeans,
    milestones:       result.milestones,
  };
}

module.exports = { calculatePublicScore };
