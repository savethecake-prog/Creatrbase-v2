'use strict';

// ─── Platform sync worker ─────────────────────────────────────────────────────
// Processes `platform-sync` jobs from the data-collection queue.
//
// Job payload: { platformProfileId }
//
// Steps:
//   1. Fetch the platform profile row (includes encrypted tokens)
//   2. Decrypt the access token; refresh if expired (or within 5-minute buffer)
//   3. Call the appropriate platform API(s) to fetch latest metrics
//   4. Persist metrics + last_synced_at back to creator_platform_profiles
//   5. On error: mark sync_status='error' so the dashboard can surface it
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

  console.log('[platformSync] worker registered on data-collection queue');
}

module.exports = { startPlatformSyncWorker };
