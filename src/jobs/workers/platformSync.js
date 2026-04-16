'use strict';

// ─── Platform sync worker ─────────────────────────────────────────────────────
// Two job types:
//
//   platform-sync       { platformProfileId }
//     Syncs one profile: decrypts tokens, refreshes if needed, fetches metrics,
//     persists to creator_platform_profiles, writes a snapshot row.
//
//   sync-all-platforms  {}
//     Daily dispatcher: queries all active profiles, enqueues platform-sync
//     for each. Registered as a Bull repeatable job (04:00 UTC daily).
// ─────────────────────────────────────────────────────────────────────────────

const { getPrisma }                        = require('../../lib/prisma');
const { encrypt, decrypt }                 = require('../../lib/crypto');
const { refreshAccessToken, getChannelStats,
        getWatchHours12Months,
        getExtendedAnalytics }             = require('../../services/youtube');
const { refreshTwitchToken,
        getTwitchChannelMetrics }          = require('../../services/twitch');
const { getDataCollectionQueue }           = require('../queue');

function startPlatformSyncWorker() {
  const queue  = getDataCollectionQueue();
  const prisma = getPrisma();

  // ── platform-sync ──────────────────────────────────────────────────────────

  queue.process('platform-sync', async (job) => {
    const { platformProfileId } = job.data;
    if (!platformProfileId) throw new Error('platform-sync job missing platformProfileId');

    await prisma.$transaction(async (tx) => {
      const profile = await tx.creatorPlatformProfile.findUnique({
        where:  { id: platformProfileId },
        select: { id: true, tenantId: true, platform: true,
                  accessToken: true, refreshToken: true, tokenExpiresAt: true },
      });

      if (!profile) throw new Error(`Platform profile ${platformProfileId} not found`);

      // Decrypt + refresh if near-expired
      let accessToken   = decrypt(profile.accessToken);
      const bufferMs    = 5 * 60 * 1000;
      const needsRefresh = profile.tokenExpiresAt &&
                           (profile.tokenExpiresAt.getTime() - Date.now() < bufferMs);

      if (needsRefresh) {
        if (!profile.refreshToken) {
          throw new Error(`Token expired for profile ${platformProfileId} and no refresh token`);
        }

        const refreshed = profile.platform === 'twitch'
          ? await refreshTwitchToken(decrypt(profile.refreshToken))
          : await refreshAccessToken(decrypt(profile.refreshToken));

        await tx.creatorPlatformProfile.update({
          where: { id: platformProfileId },
          data:  {
            accessToken:     encrypt(refreshed.accessToken),
            refreshToken:    refreshed.refreshToken ? encrypt(refreshed.refreshToken) : undefined,
            tokenExpiresAt:  refreshed.expiresAt,
          },
        });

        accessToken = refreshed.accessToken;
        job.log(`Token refreshed; new expiry ${refreshed.expiresAt?.toISOString() ?? 'unknown'}`);
      }

      if (profile.platform === 'youtube') {
        const [stats, watchHours] = await Promise.all([
          getChannelStats(accessToken),
          getWatchHours12Months(accessToken),
        ]);

        // Extended analytics: engagement rate, avg views, uploads cadence, audience geo.
        // Non-fatal — if Analytics returns nothing, nulls are stored and scored as
        // insufficient_data rather than blocking the sync.
        const extended = await getExtendedAnalytics(accessToken, {
          uploadsPlaylistId: stats.uploadsPlaylistId,
          videoCount:        stats.videoCount,
        });

        await tx.creatorPlatformProfile.update({
          where: { id: platformProfileId },
          data:  {
            subscriberCount:       stats.subscriberCount,
            totalViewCount:        stats.totalViewCount,
            videoCount:            stats.videoCount,
            watchHours12mo:        watchHours,
            engagementRate30d:     extended.engagementRate30d,
            avgViewsPerVideo30d:   extended.avgViewsPerVideo30d,
            avgViewsPerVideo60d:   extended.avgViewsPerVideo60d,
            avgViewsPerVideo90d:   extended.avgViewsPerVideo90d,
            publicUploads90d:      extended.publicUploads90d,
            primaryAudienceGeo:    extended.primaryAudienceGeo,
            analyticsLastSyncedAt: extended.engagementRate30d != null ? new Date() : undefined,
            syncStatus:            'active',
            lastSyncedAt:          new Date(),
          },
        });

        await tx.platformMetricsSnapshot.create({
          data: {
            tenantId:         profile.tenantId,
            platformProfileId,
            platform:         'youtube',
            subscriberCount:  stats.subscriberCount,
            watchHours12mo:   watchHours,
            totalViewCount:   stats.totalViewCount,
            videoCount:       stats.videoCount,
          },
        });

        job.log(
          `YouTube sync complete: ${stats.subscriberCount} subs, ${watchHours} watch hrs` +
          `, eng=${extended.engagementRate30d ?? 'n/a'}` +
          `, avg_views_30d=${extended.avgViewsPerVideo30d ?? 'n/a'}` +
          `, avg_views_60d=${extended.avgViewsPerVideo60d ?? 'n/a'}` +
          `, avg_views_90d=${extended.avgViewsPerVideo90d ?? 'n/a'}` +
          `, uploads_90d=${extended.publicUploads90d ?? 'n/a'}` +
          `, geo=${extended.primaryAudienceGeo ?? 'n/a'}`
        );
      } else if (profile.platform === 'twitch') {
        const platformUserId = await (async () => {
          const p = await tx.creatorPlatformProfile.findUnique({
            where:  { id: platformProfileId },
            select: { platformUserId: true },
          });
          return p?.platformUserId;
        })();

        if (!platformUserId) throw new Error(`No platformUserId for Twitch profile ${platformProfileId}`);

        const metrics = await getTwitchChannelMetrics(accessToken, platformUserId);

        await tx.creatorPlatformProfile.update({
          where: { id: platformProfileId },
          data:  {
            subscriberCount:        metrics.followerCount,
            twitchAffiliate:        metrics.twitchAffiliate,
            twitchPartner:          metrics.twitchPartner,
            streamHours30d:         metrics.streamHours30d,
            uniqueBroadcastDays30d: metrics.uniqueBroadcastDays30d,
            avgConcurrentViewers30d: metrics.avgConcurrentViewers30d,
            analyticsLastSyncedAt:  new Date(),
            syncStatus:             'active',
            lastSyncedAt:           new Date(),
          },
        });

        await tx.platformMetricsSnapshot.create({
          data: {
            tenantId:               profile.tenantId,
            platformProfileId,
            platform:               'twitch',
            subscriberCount:        metrics.followerCount,
            avgConcurrentViewers30d: metrics.avgConcurrentViewers30d,
          },
        });

        job.log(
          `Twitch sync complete: ${metrics.followerCount} followers` +
          `, affiliate=${metrics.twitchAffiliate}` +
          `, partner=${metrics.twitchPartner}` +
          `, stream_hours_30d=${metrics.streamHours30d ?? 'n/a'}` +
          `, broadcast_days_30d=${metrics.uniqueBroadcastDays30d ?? 'n/a'}` +
          `, avg_concurrent=${metrics.avgConcurrentViewers30d ?? 'n/a (not live)'}`
        );
      } else {
        job.log(`Skipping unsupported platform: ${profile.platform}`);
      }
    });

    // Re-score after every successful sync so new engagement/geo/cadence data
    // immediately flows through to dimension scores and milestone statuses.
    const synced = await prisma.creatorPlatformProfile.findUnique({
      where:  { id: platformProfileId },
      select: { creatorId: true },
    });
    if (synced?.creatorId) {
      await queue.add('analysis:score-creator', {
        creatorId:   synced.creatorId,
        triggerType: 'platform_sync',
      });
      // Seed default maintenance templates on first sync (no-op if already seeded)
      await queue.add('task:seed-templates', { creatorId: synced.creatorId });
    }
  });

  // Error handler — mark sync_status='error' so the dashboard can surface it
  queue.on('failed', async (job, err) => {
    if (job.name !== 'platform-sync') return;
    const { platformProfileId } = job.data ?? {};
    if (!platformProfileId) return;

    try {
      await prisma.creatorPlatformProfile.update({
        where: { id: platformProfileId },
        data:  { syncStatus: 'error' },
      });
    } catch {
      // Best-effort — don't mask the original error
    }
  });

  // ── sync-all-platforms (daily dispatcher) ──────────────────────────────────

  queue.process('sync-all-platforms', async (job) => {
    const profiles = await prisma.creatorPlatformProfile.findMany({
      where:  { syncStatus: { not: 'disconnected' } },
      select: { id: true },
    });

    if (profiles.length === 0) {
      job.log('No active platform profiles — nothing to sync');
      return;
    }

    for (const { id } of profiles) {
      await queue.add('platform-sync', { platformProfileId: id });
    }

    job.log(`Dispatched ${profiles.length} platform-sync job(s)`);
    console.log(`[platformSync] daily dispatch: queued ${profiles.length} sync job(s)`);
  });

  // Register repeatable dispatcher (Bull deduplicates by name + cron across restarts)
  queue.add('sync-all-platforms', {}, {
    repeat:           { cron: '0 4 * * *' },
    removeOnComplete: 10,
    removeOnFail:     10,
  });

  console.log('[platformSync] worker registered on data-collection queue');
  console.log('[platformSync] daily sync scheduled at 04:00 UTC');
}

module.exports = { startPlatformSyncWorker };
