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

      // If this platform account already exists under a different creator row within
      // the SAME tenant (e.g. after account recreation), remove it so the INSERT below
      // can proceed. Cross-tenant conflicts are NOT cleared here — they will still
      // trigger the 23505 handler and return 409.
      await tx.$executeRaw`
        DELETE FROM creator_platform_profiles
        WHERE  platform          = ${platform}
          AND  platform_user_id  = ${platformUserId}
          AND  tenant_id         = ${tenantId}::uuid
          AND  creator_id       != ${creator.id}::uuid
      `;

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
    // Unique constraint: this platform account is already connected to another tenant.
    // Prisma wraps $queryRaw errors as P2010 with the PG code inside the message,
    // so we match on both the direct PG code and the Prisma wrapper.
    const is23505 = err.code === '23505' ||
                    (err.code === 'P2010' && err.message?.includes('23505'));
    const isPlatformUserIdConflict =
      err.message?.includes('(platform, platform_user_id)') ||
      err.message?.includes('creator_platform_profiles_platform_platform_user_id_key');

    if (is23505 && isPlatformUserIdConflict) {
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
      platform:             true,
      platformUsername:     true,
      platformDisplayName:  true,
      platformUrl:          true,
      connectedAt:          true,
      syncStatus:           true,
      lastSyncedAt:         true,
      analyticsLastSyncedAt: true,
      subscriberCount:      true,
      totalViewCount:       true,
      watchHours12mo:       true,
      engagementRate30d:    true,
      publicUploads90d:     true,
      primaryAudienceGeo:   true,
      avgConcurrentViewers30d: true,
    },
  });

  // Serialise BigInt and Decimal for JSON transport
  return profiles.map(p => ({
    platform:              p.platform,
    platform_username:     p.platformUsername,
    platform_display_name: p.platformDisplayName,
    platform_url:          p.platformUrl,
    connected_at:          p.connectedAt,
    sync_status:           p.syncStatus,
    last_synced_at:        p.lastSyncedAt,
    analytics_last_synced_at: p.analyticsLastSyncedAt,
    subscriber_count:      p.subscriberCount,
    total_view_count:      p.totalViewCount !== null ? Number(p.totalViewCount) : null,
    watch_hours_12mo:      p.watchHours12mo !== null ? Number(p.watchHours12mo) : null,
    engagement_rate_30d:   p.engagementRate30d !== null ? Number(p.engagementRate30d) : null,
    public_uploads_90d:    p.publicUploads90d,
    primary_audience_geo:  p.primaryAudienceGeo,
    avg_concurrent_viewers_30d: p.avgConcurrentViewers30d !== null
                                  ? Number(p.avgConcurrentViewers30d) : null,
  }));
}

// ─── disconnectPlatform ───────────────────────────────────────────────────────
// Clears tokens and marks the profile as disconnected.
// accessToken is non-nullable in the schema, so we store an encrypted sentinel.

async function disconnectPlatform(creatorId, platform) {
  const prisma = getPrisma();

  const profile = await prisma.creatorPlatformProfile.findFirst({
    where:  { creatorId, platform },
    select: { id: true },
  });
  if (!profile) return null;

  await prisma.creatorPlatformProfile.update({
    where: { id: profile.id },
    data:  {
      syncStatus:     'disconnected',
      accessToken:    encrypt('disconnected'),
      refreshToken:   null,
      tokenExpiresAt: null,
    },
  });

  return { id: profile.id };
}

module.exports = { connectPlatform, getConnectedPlatforms, disconnectPlatform };
