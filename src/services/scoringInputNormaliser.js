// src/services/scoringInputNormaliser.js
// Thin wrapper that maps platform-specific profile fields into the shape
// expected by scoringEngine.js, which uses YouTube-style field names.
//
// scoringEngine.js must NOT be modified (CLAUDE.md). This normaliser sits
// between platform data and the engine call, translating field names and
// handling nulls for metrics that are unavailable on non-YouTube platforms.

'use strict';

/**
 * Map a TikTok creator_platform_profiles row into the scoring engine's input shape.
 *
 * Fields unavailable from TikTok's public API (watch hours, audience geography)
 * are passed as null. The scoring engine handles nulls by falling back to niche
 * benchmarks — the score will have lower confidence on those dimensions, which
 * is the correct and honest behaviour.
 *
 * NOTE: tiktok_following_count (migration 019) incorrectly stores follower count.
 * Migration 047 added the correct tiktok_follower_count column. Both are checked
 * here for backwards compatibility during the transition period.
 *
 * @param {Object} profile — row from creator_platform_profiles (camelCase via Prisma)
 * @returns {Object} — scoring engine input shape
 */
function normaliseTikTokInputs(profile) {
  const followerCount =
    profile.tiktokFollowerCount     // migration 047 correct field
    ?? profile.tiktokFollowingCount  // migration 019 legacy field (stores follower count)
    ?? 0;

  return {
    platform:            'tiktok',
    subscriberCount:     followerCount,
    avgViewsPerVideo30d: profile.tiktokAvgViewsPerVideo30d ?? null,
    engagementRate30d:   profile.tiktokEngagementRate30d
      ? Number(profile.tiktokEngagementRate30d)
      : null,
    // Extrapolate 90d upload count from 30d window (linear assumption)
    publicUploads90d:    profile.tiktokVideoPosts30d != null
      ? Math.round(profile.tiktokVideoPosts30d * 3)
      : null,
    // Not available from TikTok's public API
    watchHours12mo:      null,
    primaryAudienceGeo:  null,
    secondaryAudienceGeo: null,
  };
}

/**
 * Map a YouTube creator_platform_profiles row into the scoring engine's input shape.
 * Included here for symmetry — the engine already accepts YouTube fields natively,
 * but normalising through this function keeps call-sites consistent.
 *
 * @param {Object} profile
 * @returns {Object}
 */
function normaliseYouTubeInputs(profile) {
  return {
    platform:             'youtube',
    subscriberCount:      profile.subscriberCount      ?? 0,
    avgViewsPerVideo30d:  profile.avgViewsPerVideo30d
      ? Number(profile.avgViewsPerVideo30d)
      : null,
    engagementRate30d:    profile.engagementRate30d
      ? Number(profile.engagementRate30d)
      : null,
    publicUploads90d:     profile.publicUploads90d     ?? null,
    watchHours12mo:       profile.watchHours12mo
      ? Number(profile.watchHours12mo)
      : null,
    primaryAudienceGeo:   profile.primaryAudienceGeo   ?? null,
    secondaryAudienceGeo: profile.secondaryAudienceGeo ?? null,
  };
}

/**
 * Normalise any supported platform profile into the scoring engine input shape.
 *
 * @param {string} platform — 'youtube' | 'tiktok'
 * @param {Object} profile
 * @returns {Object}
 */
function normaliseForScoring(platform, profile) {
  switch (platform) {
    case 'tiktok':
      return normaliseTikTokInputs(profile);
    case 'youtube':
      return normaliseYouTubeInputs(profile);
    default:
      throw new Error(`scoringInputNormaliser: unsupported platform '${platform}'`);
  }
}

module.exports = { normaliseForScoring, normaliseTikTokInputs, normaliseYouTubeInputs };
