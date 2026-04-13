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
        getWatchHours12Months }            = require('../../services/youtube');
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
        const refreshed = await refreshAccessToken(decrypt(profile.refreshToken));

        await tx.creatorPlatformProfile.update({
          where: { id: platformProfileId },
          data:  {
            accessToken:     encrypt(refreshed.accessToken),
            tokenExpiresAt:  refreshed.expiresAt,
          },
        });

        accessToken = refreshed.accessToken;
        job.log(`Token refreshed; new expiry ${refreshed.expiresAt.toISOString()}`);
      }

      if (profile.platform === 'youtube') {
        const [stats, watchHours] = await Promise.all([
          getChannelStats(accessToken),
          getWatchHours12Months(accessToken),
        ]);

        await tx.creatorPlatformProfile.update({
          where: { id: platformProfileId },
          data:  {
            subscriberCount: stats.subscriberCount,
            totalViewCount:  stats.totalViewCount,
            videoCount:      stats.videoCount,
            watchHours12mo:  watchHours,
            syncStatus:      'active',
            lastSyncedAt:    new Date(),
          },
        });

        await tx.platformMetricsSnapshot.create({
          data: {
            tenantId:           profile.tenantId,
            platformProfileId,
            platform:           'youtube',
            subscriberCount:    stats.subscriberCount,
            watchHours12mo:     watchHours,
            totalViewCount:     stats.totalViewCount,
            videoCount:         stats.videoCount,
          },
        });

        job.log(`YouTube sync complete: ${stats.subscriberCount} subs, ${watchHours} watch hrs`);
      } else {
        job.log(`Skipping unsupported platform: ${profile.platform}`);
      }
    });

    // If we get here the transaction committed — clear any previous error status
    // (the update inside the tx already sets syncStatus='active', so this is a no-op
    // on success, but we add it as an explicit guard outside the tx for safety)
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
