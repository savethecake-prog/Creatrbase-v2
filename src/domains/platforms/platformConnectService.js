'use strict';

// ─── platformConnectService ───────────────────────────────────────────────────
// Tenant isolation guarantee:
//   creator_id is derived from userId + tenantId taken from the session.
//   It is never accepted from the request body or URL params.
//   UNIQUE(platform, platform_user_id) in the DB prevents the same external
//   account being connected to more than one tenant.
//
// Tokens are encrypted with AES-256-GCM before storage. See src/lib/crypto.js.
// ─────────────────────────────────────────────────────────────────────────────

const { getPrisma } = require('../../lib/prisma');
const { encrypt }   = require('../../lib/crypto');

async function connectPlatform({
  userId,
  tenantId,
  platform,
  platformUserId,
  platformUsername,
  platformDisplayName,
  platformUrl,
  accessToken,
  refreshToken,
  tokenExpiresAt,      // Unix timestamp (seconds) or null
  scopesGranted,
}) {
  const prisma = getPrisma();

  // Encrypt tokens before write
  const encryptedAccess  = encrypt(accessToken);
  const encryptedRefresh = refreshToken ? encrypt(refreshToken) : null;
  const expiresAt        = tokenExpiresAt ? new Date(tokenExpiresAt * 1000) : null;

  try {
    const { platformProfileId, creatorId } = await prisma.$transaction(async (tx) => {
      // Derive creator from session — never trust caller-supplied IDs
      const creator = await tx.creator.findFirst({
        where:  { userId, tenantId },
        select: { id: true, onboardingStep: true },
      });
      if (!creator) {
        const err = new Error('Creator record not found for this session');
        err.statusCode = 404;
        throw err;
      }

      // Upsert — reconnecting the same platform updates credentials, doesn't duplicate.
      // COALESCE on refresh_token preserves the existing token if the new one is null
      // (Google doesn't always re-issue a refresh token on subsequent consents).
      // Prisma doesn't support COALESCE in upsert, so we use a raw query here.
      const [row] = await tx.$queryRaw`
        INSERT INTO creator_platform_profiles (
          tenant_id, creator_id, platform,
          platform_user_id, platform_username, platform_display_name, platform_url,
          access_token, refresh_token, token_expires_at, scopes_granted,
          sync_status, connected_at
        ) VALUES (
          ${tenantId}::uuid, ${creator.id}::uuid, ${platform},
          ${platformUserId}, ${platformUsername ?? null}, ${platformDisplayName ?? null}, ${platformUrl ?? null},
          ${encryptedAccess}, ${encryptedRefresh ?? null}, ${expiresAt ?? null}::timestamptz,
          ${scopesGranted ?? []}::text[],
          'active', NOW()
        )
        ON CONFLICT (creator_id, platform) DO UPDATE SET
          platform_user_id      = EXCLUDED.platform_user_id,
          platform_username     = EXCLUDED.platform_username,
          platform_display_name = EXCLUDED.platform_display_name,
          platform_url          = EXCLUDED.platform_url,
          access_token          = EXCLUDED.access_token,
          refresh_token         = COALESCE(EXCLUDED.refresh_token, creator_platform_profiles.refresh_token),
          token_expires_at      = EXCLUDED.token_expires_at,
          scopes_granted        = EXCLUDED.scopes_granted,
          sync_status           = 'active',
          connected_at          = NOW()
        RETURNING id
      `;

      // Advance onboarding step on first connection
      await tx.creator.updateMany({
        where: { id: creator.id, onboardingStep: 'account_created' },
        data:  { onboardingStep: 'platform_connected' },
      });

      return { platformProfileId: row.id, creatorId: creator.id };
    });

    return { creatorId, platform, platformProfileId };

  } catch (err) {
    // Unique constraint: this platform account is already connected to another tenant
    if (err.code === '23505' &&
        err.message?.includes('creator_platform_profiles_platform_platform_user_id_key')) {
      const e = new Error('This platform account is already connected to another Creatrbase account.');
      e.statusCode = 409;
      throw e;
    }
    throw err;
  }
}

// ─── getConnectedPlatforms ────────────────────────────────────────────────────
// Returns safe, token-free platform data for the authenticated creator.

async function getConnectedPlatforms(userId, tenantId) {
  const creator = await getPrisma().creator.findFirst({
    where: { userId, tenantId },
  });
  if (!creator) return [];

  const profiles = await getPrisma().creatorPlatformProfile.findMany({
    where:   { creatorId: creator.id },
    orderBy: { connectedAt: 'asc' },
    select:  {
      platform:            true,
      platformUsername:    true,
      platformDisplayName: true,
      platformUrl:         true,
      connectedAt:         true,
      syncStatus:          true,
      lastSyncedAt:        true,
      subscriberCount:     true,
      totalViewCount:      true,
      watchHours12mo:      true,
      avgConcurrentViewers30d: true,
    },
  });

  // Serialise BigInt and Decimal for JSON transport
  return profiles.map(p => ({
    platform:             p.platform,
    platform_username:    p.platformUsername,
    platform_display_name: p.platformDisplayName,
    platform_url:         p.platformUrl,
    connected_at:         p.connectedAt,
    sync_status:          p.syncStatus,
    last_synced_at:       p.lastSyncedAt,
    subscriber_count:     p.subscriberCount,
    total_view_count:     p.totalViewCount !== null ? Number(p.totalViewCount) : null,
    watch_hours_12mo:     p.watchHours12mo !== null ? Number(p.watchHours12mo) : null,
    avg_concurrent_viewers_30d: p.avgConcurrentViewers30d !== null
                                  ? Number(p.avgConcurrentViewers30d) : null,
  }));
}

module.exports = { connectPlatform, getConnectedPlatforms };
