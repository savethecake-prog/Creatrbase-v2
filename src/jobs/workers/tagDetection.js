'use strict';

// ─── Tag detection worker ─────────────────────────────────────────────────────
// Job type: tags:detect  { creatorId }
//
// Triggered after every successful YouTube platform sync.
// 1. Loads the creator's tracked tags
// 2. Fetches recent videos with their tags + stats
// 3. Matches tracked tags against video tags
// 4. Writes tag_detections rows (skips duplicates)
// 5. Recomputes detection_count, effectiveness_score, and confidence per tag
// 6. Auto-completes active content_brand_alignment tasks if a tag was detected
//    on a video published after the task was created
// ─────────────────────────────────────────────────────────────────────────────

const { getPrisma }              = require('../../lib/prisma');
const { getPool }                = require('../../db/pool');
const { decrypt }                = require('../../lib/crypto');
const { getRecentVideoDetails }  = require('../../services/youtube');
const { refreshAccessToken }     = require('../../services/youtube');
const { encrypt }                = require('../../lib/crypto');
const { getDataCollectionQueue } = require('../queue');

// ─── Effectiveness scoring ────────────────────────────────────────────────────

function computeEffectiveness(detections, baselineAvgViews) {
  if (detections.length === 0) return { score: null, confidence: 'low' };

  const withViews = detections.filter(d => d.view_count != null && d.view_count > 0);
  if (withViews.length === 0) return { score: null, confidence: 'low' };

  const avgTaggedViews = withViews.reduce((sum, d) => sum + Number(d.view_count), 0) / withViews.length;

  let score = null;
  if (baselineAvgViews && baselineAvgViews > 0) {
    // Score = (tagged avg / baseline avg) * 50, capped at 100
    // 2x baseline = 100, 1x baseline = 50, 0.5x baseline = 25
    score = Math.min(100, Math.round((avgTaggedViews / baselineAvgViews) * 50));
  } else {
    // No baseline: score based on raw view count tiers
    score = avgTaggedViews >= 10000 ? 75
          : avgTaggedViews >= 5000  ? 60
          : avgTaggedViews >= 1000  ? 45
          : 30;
  }

  const count = detections.length;
  const confidence = count >= 10 ? 'high' : count >= 3 ? 'medium' : 'low';

  return { score, confidence };
}

// ─── Worker ───────────────────────────────────────────────────────────────────

function startTagDetectionWorker() {
  const queue  = getDataCollectionQueue();
  const prisma = getPrisma();
  const pool   = getPool();

  queue.process('tags:detect', async (job) => {
    const { creatorId } = job.data;
    if (!creatorId) throw new Error('tags:detect missing creatorId');

    // Load creator's tracked tags
    const { rows: trackedTags } = await pool.query(
      `SELECT id, tag FROM creator_tags WHERE creator_id = $1`,
      [creatorId]
    );

    if (trackedTags.length === 0) {
      job.log(`No tracked tags for creator ${creatorId} — skipping`);
      return;
    }

    job.log(`Checking ${trackedTags.length} tracked tag(s) for creator ${creatorId}`);

    // Load YouTube platform profile + token
    const profile = await prisma.creatorPlatformProfile.findFirst({
      where:  { creatorId, platform: 'youtube', syncStatus: { not: 'disconnected' } },
      select: {
        id:                true,
        accessToken:       true,
        refreshToken:      true,
        tokenExpiresAt:    true,
        avgViewsPerVideo30d: true,
      },
    });

    if (!profile) {
      job.log(`No active YouTube profile for creator ${creatorId} — skipping`);
      return;
    }

    // Get fresh token
    let accessToken = decrypt(profile.accessToken);
    const bufferMs  = 5 * 60 * 1000;
    if (profile.tokenExpiresAt && profile.tokenExpiresAt.getTime() - Date.now() < bufferMs) {
      if (!profile.refreshToken) {
        job.log('Token expired and no refresh token — skipping');
        return;
      }
      const refreshed = await refreshAccessToken(decrypt(profile.refreshToken));
      await prisma.creatorPlatformProfile.update({
        where: { id: profile.id },
        data:  {
          accessToken:    encrypt(refreshed.accessToken),
          tokenExpiresAt: refreshed.expiresAt,
        },
      });
      accessToken = refreshed.accessToken;
    }

    // Get uploads playlist ID
    const platformProfile = await prisma.creatorPlatformProfile.findFirst({
      where:  { creatorId, platform: 'youtube' },
      select: { uploadsPlaylistId: true },
    });

    const uploadsPlaylistId = platformProfile?.uploadsPlaylistId;
    if (!uploadsPlaylistId) {
      job.log('No uploadsPlaylistId — skipping tag detection');
      return;
    }

    // Fetch recent videos with tags
    const videos = await getRecentVideoDetails(accessToken, { uploadsPlaylistId, maxVideos: 50 });
    if (videos.length === 0) {
      job.log('No videos returned — skipping');
      return;
    }

    job.log(`Scanning ${videos.length} videos for ${trackedTags.length} tag(s)`);

    const baselineAvgViews = profile.avgViewsPerVideo30d
      ? Number(profile.avgViewsPerVideo30d)
      : null;

    // Match tags against videos
    for (const tracked of trackedTags) {
      const tagLower = tracked.tag.toLowerCase().trim();
      const matchedVideos = videos.filter(v => v.tags.includes(tagLower));

      for (const video of matchedVideos) {
        const vsBaseline = baselineAvgViews && baselineAvgViews > 0
          ? Math.round((video.viewCount / baselineAvgViews) * 100) / 100
          : null;

        // Insert detection (ignore duplicate video+tag)
        await pool.query(
          `INSERT INTO tag_detections
             (creator_tag_id, creator_id, video_id, video_title,
              video_published_at, view_count, like_count, views_vs_baseline)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (creator_tag_id, video_id) DO UPDATE SET
             view_count        = EXCLUDED.view_count,
             like_count        = EXCLUDED.like_count,
             views_vs_baseline = EXCLUDED.views_vs_baseline`,
          [
            tracked.id, creatorId, video.videoId, video.title,
            video.publishedAt, video.viewCount, video.likeCount, vsBaseline,
          ]
        );
      }

      // Recompute effectiveness for this tag
      const { rows: detections } = await pool.query(
        `SELECT view_count FROM tag_detections WHERE creator_tag_id = $1`,
        [tracked.id]
      );

      const { score, confidence } = computeEffectiveness(detections, baselineAvgViews);
      const lastDetected = matchedVideos.length > 0 ? new Date() : undefined;

      await pool.query(
        `UPDATE creator_tags
         SET detection_count     = $1,
             effectiveness_score = $2,
             confidence          = $3,
             last_detected_at    = COALESCE($4, last_detected_at),
             updated_at          = now()
         WHERE id = $5`,
        [detections.length, score, confidence, lastDetected ?? null, tracked.id]
      );

      if (matchedVideos.length > 0) {
        job.log(`Tag "${tracked.tag}": ${matchedVideos.length} new/updated detections, score=${score}, confidence=${confidence}`);
        console.log(`[tagDetection] creator=${creatorId} tag="${tracked.tag}" detections=${detections.length} score=${score}`);
      }
    }

    // Auto-complete active content_brand_alignment tasks if a tag was detected
    // on a video published after the task was created
    const activeBrandTask = await prisma.task.findFirst({
      where: {
        creatorId,
        dimension: 'content_brand_alignment',
        status:    'active',
        taskMode:  'maintenance',
      },
      select: { id: true, createdAt: true },
    });

    if (activeBrandTask) {
      const taskCreatedAt = activeBrandTask.createdAt;
      const { rows: recentDetections } = await pool.query(
        `SELECT td.video_id
         FROM tag_detections td
         JOIN creator_tags ct ON ct.id = td.creator_tag_id
         WHERE ct.creator_id = $1
           AND td.video_published_at >= $2
         LIMIT 1`,
        [creatorId, taskCreatedAt]
      );

      if (recentDetections.length > 0) {
        await prisma.task.update({
          where: { id: activeBrandTask.id },
          data:  {
            status:          'completed',
            completedAt:     new Date(),
            creatorFeedback: 'helpful',
            creatorNotes:    'Auto-verified: brand tag detected on a video published after this task was created.',
          },
        });
        job.log(`Auto-completed content_brand_alignment task for creator ${creatorId}`);
        console.log(`[tagDetection] auto-completed brand alignment task for creator=${creatorId}`);
      }
    }
  });

  console.log('[tagDetection] worker registered on data-collection queue');
}

module.exports = { startTagDetectionWorker };
