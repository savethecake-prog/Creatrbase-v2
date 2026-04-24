// src/services/tiktokContent.js
// Parallel to the YouTube content service — turns raw TikTok API data into
// structured signals for the niche classifier and derived analytics fields.

'use strict';

/**
 * Transform raw TikTok video list into the signal shape expected by the niche classifier.
 * Input: array of video objects from getTikTokVideoList (tiktok.js)
 * Output: array of signal objects for the classifier prompt
 *
 * @param {Array} videos
 * @returns {Array}
 */
function extractVideoSignals(videos) {
  return videos.map(v => ({
    title:        v.title || '',
    description:  v.voice_to_text ?? '',
    viewCount:    v.viewCount   ?? v.view_count   ?? 0,
    likeCount:    v.likeCount   ?? v.like_count   ?? 0,
    commentCount: v.commentCount ?? v.comment_count ?? 0,
    shareCount:   v.shareCount  ?? v.share_count  ?? 0,
    duration:     v.duration ?? 0,   // seconds
    createdAt:    v.createdAt instanceof Date
      ? v.createdAt.toISOString()
      : (v.create_time ? new Date(v.create_time * 1000).toISOString() : null),
  }));
}

/**
 * Derive platform analytics from the video list + user stats returned by TikTok API.
 * TikTok does not expose a dedicated analytics endpoint, so everything is derived.
 *
 * Engagement rate formula:
 *   (total_likes_across_all_videos / video_count) / follower_count
 * This is a reasonable proxy — higher than per-video watch-time engagement on YouTube
 * but normalised consistently across creators.
 *
 * @param {Array}  videos    — array from getTikTokVideoList
 * @param {Object} userStats — from getTikTokUserInfo: { followerCount, likesCount, videoCount }
 * @returns {{ avgViews30d: number|null, videoPosts30d: number, engagementRate30d: number|null }}
 */
function calculateTikTokAnalytics(videos, userStats) {
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  const recentVideos = videos.filter(v => {
    const ts = v.createdAt instanceof Date
      ? v.createdAt.getTime()
      : (v.create_time ? v.create_time * 1000 : null);
    return ts !== null && (now - ts) < thirtyDaysMs;
  });

  // Average views from the 30-day window; null if no recent videos
  const avgViews30d = recentVideos.length > 0
    ? Math.round(
        recentVideos.reduce((sum, v) => sum + (v.viewCount ?? v.view_count ?? 0), 0)
        / recentVideos.length
      )
    : null;

  // Engagement rate: (total likes / video count) / followers
  // Uses full video history for likes (more stable than 30d window)
  const followerCount = userStats.followerCount ?? userStats.follower_count ?? 0;
  const likesCount    = userStats.likesCount    ?? userStats.likes_count    ?? 0;
  const videoCount    = userStats.videoCount    ?? userStats.video_count    ?? videos.length;

  const engagementRate30d =
    followerCount > 0 && videoCount > 0
      ? (likesCount / videoCount) / followerCount
      : null;

  return {
    avgViews30d,
    videoPosts30d:    recentVideos.length,
    // Store as 4-decimal precision (0.0000–9.9999); multiply AFTER null check
    engagementRate30d: engagementRate30d !== null
      ? Math.round(engagementRate30d * 10000) / 10000
      : null,
  };
}

module.exports = { extractVideoSignals, calculateTikTokAnalytics };
