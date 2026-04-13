'use strict';

// ─── Platform sync worker ─────────────────────────────────────────────────────
// Two job types processed here:
//
//   platform-sync       { platformProfileId }
//     Syncs a single platform profile — fetches metrics, persists to DB.
//     Queued immediately on connect and by the daily dispatcher.
//
//   sync-all-platforms  {}
//     Daily dispatcher — queries all active profiles and enqueues a
//     platform-sync job for each. Registered as a Bull repeatable job
//     (runs at 04:00 UTC every day) so metrics stay fresh automatically.
//
// Token refresh:
//   When a new access token is issued we re-encrypt it and update the DB.
//   token_expires_at is stored as a timestamptz — we compare against JS Date.
// ─────────────────────────────────────────────────────────────────────────────

const { getPool }                                          = require('../../db/pool');
const { encrypt, decrypt }                                 = require('../../lib/crypto');
const { refreshAccessToken, getChannelStats,
        getWatchHours12Months }                            = require('../../services/youtube');
const { getDataCollectionQueue }                           = require('../queue');

// ─── Worker registration ──────────────────────────────────────────────────────

function startPlatformSyncWorker() {
  const queue = getDataCollectionQueue();

  queue.process('platform-sync', async (job) => {
    const { platformProfileId } = job.data;

    if (!platformProfileId) {
      throw new Error('platform-sync job missing platformProfileId');
    }

    const pool   = getPool();
    const client = await pool.connect();

    try {
      // 1. Fetch profile row
      const { rows } = await client.query(
        `SELECT id, platform, access_token, refresh_token, token_expires_at
           FROM creator_platform_profiles
          WHERE id = $1`,
        [platformProfileId]
      );

      const profile = rows[0];
      if (!profile) {
        throw new Error(`Platform profile ${platformProfileId} not found`);
      }

      // 2. Decrypt access token; check expiry
      let accessToken = decrypt(profile.access_token);
      const expiresAt = profile.token_expires_at ? new Date(profile.token_expires_at) : null;
      const bufferMs  = 5 * 60 * 1000; // 5-minute buffer
      const needsRefresh = expiresAt && (expiresAt.getTime() - Date.now() < bufferMs);

      if (needsRefresh) {
        if (!profile.refresh_token) {
          throw new Error(`Token expired for profile ${platformProfileId} and no refresh token available`);
        }

        const refreshToken = decrypt(profile.refresh_token);
        const refreshed    = await refreshAccessToken(refreshToken);

        // Re-encrypt and persist new access token
        const encryptedAccess = encrypt(refreshed.accessToken);
        await client.query(
          `UPDATE creator_platform_profiles
              SET access_token      = $1,
                  token_expires_at  = $2
            WHERE id = $3`,
          [encryptedAccess, refreshed.expiresAt, platformProfileId]
        );

        accessToken = refreshed.accessToken;
        job.log(`Token refreshed for profile ${platformProfileId}; new expiry ${refreshed.expiresAt.toISOString()}`);
      }

      // 3. Fetch metrics (platform-specific)
      if (profile.platform === 'youtube') {
        const [stats, watchHours] = await Promise.all([
          getChannelStats(accessToken),
          getWatchHours12Months(accessToken),
        ]);

        // 4. Persist metrics
        await client.query(
          `UPDATE creator_platform_profiles
              SET subscriber_count  = $1,
                  total_view_count  = $2,
                  video_count       = $3,
                  watch_hours_12mo  = $4,
                  sync_status       = 'active',
                  last_synced_at    = NOW()
            WHERE id = $5`,
          [
            stats.subscriberCount,
            stats.totalViewCount,
            stats.videoCount,
            watchHours,
            platformProfileId,
          ]
        );

        // Append a snapshot for velocity calculations in Gap Tracker
        await client.query(
          `INSERT INTO platform_metrics_snapshots
             (tenant_id, platform_profile_id, platform,
              subscriber_count, watch_hours_12mo, total_view_count, video_count)
           SELECT tenant_id, $1, 'youtube', $2, $3, $4, $5
             FROM creator_platform_profiles WHERE id = $1`,
          [platformProfileId, stats.subscriberCount, watchHours,
           stats.totalViewCount, stats.videoCount]
        );

        job.log(`YouTube sync complete: ${stats.subscriberCount} subscribers, ${watchHours} watch hours`);

      } else {
        // Twitch and future platforms — not yet implemented
        job.log(`Skipping metrics fetch for unsupported platform: ${profile.platform}`);
      }

    } catch (err) {
      // Mark as errored so the dashboard can surface a "sync failed" state
      try {
        await client.query(
          `UPDATE creator_platform_profiles
              SET sync_status = 'error'
            WHERE id = $1`,
          [platformProfileId]
        );
      } catch (updateErr) {
        // Don't mask the original error
        console.error('Failed to mark sync_status=error:', updateErr.message);
      }

      throw err; // re-throw so Bull retries / records as failed
    } finally {
      client.release();
    }
  });

  // ── Daily dispatcher ──────────────────────────────────────────────────────
  // Runs at 04:00 UTC every day. Fetches all active profiles and fans out
  // individual platform-sync jobs. Bull deduplicates the repeatable job
  // across restarts — safe to re-register on every startup.

  queue.process('sync-all-platforms', async (job) => {
    const { rows } = await getPool().query(
      `SELECT id FROM creator_platform_profiles WHERE sync_status != 'disconnected'`
    );

    if (rows.length === 0) {
      job.log('No active platform profiles — nothing to sync');
      return;
    }

    for (const row of rows) {
      await queue.add('platform-sync', { platformProfileId: row.id });
    }

    job.log(`Dispatched ${rows.length} platform-sync job(s)`);
    console.log(`[platformSync] daily dispatch: queued ${rows.length} sync job(s)`);
  });

  // Register the repeatable dispatcher job (Bull deduplicates by name + cron)
  queue.add('sync-all-platforms', {}, {
    repeat:           { cron: '0 4 * * *' },  // 04:00 UTC daily
    removeOnComplete: 10,
    removeOnFail:     10,
  });

  console.log('[platformSync] worker registered on data-collection queue');
  console.log('[platformSync] daily sync scheduled at 04:00 UTC');
}

module.exports = { startPlatformSyncWorker };
