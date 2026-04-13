'use strict';

const { getPool } = require('../../db/pool');
const { encrypt }  = require('../../lib/crypto');

// ─── connectPlatform ──────────────────────────────────────────────────────────
// Upserts a platform connection for the authenticated creator.
//
// Tenant isolation guarantee:
//   creator_id is derived from userId + tenantId taken from the session.
//   It is never accepted from the request body or URL params.
//   UNIQUE(platform, platform_user_id) in the DB prevents the same external
//   account being connected to more than one tenant.
//
// Tokens are encrypted with AES-256-GCM before storage — never stored in
// plaintext. See src/lib/crypto.js.
// ─────────────────────────────────────────────────────────────────────────────

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
  const pool   = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Derive creator from the session — never trust caller-supplied creator IDs
    const { rows: creatorRows } = await client.query(
      `SELECT id FROM creators WHERE user_id = $1 AND tenant_id = $2`,
      [userId, tenantId]
    );
    if (!creatorRows[0]) {
      const err = new Error('Creator record not found for this session');
      err.statusCode = 404;
      throw err;
    }
    const creatorId = creatorRows[0].id;

    // Encrypt tokens before write
    const encryptedAccess  = encrypt(accessToken);
    const encryptedRefresh = refreshToken ? encrypt(refreshToken) : null;
    const expiresAt        = tokenExpiresAt ? new Date(tokenExpiresAt * 1000) : null;

    // Upsert — reconnecting the same platform updates credentials, doesn't duplicate
    const { rows: upsertRows } = await client.query(
      `INSERT INTO creator_platform_profiles (
         tenant_id, creator_id, platform,
         platform_user_id, platform_username, platform_display_name, platform_url,
         access_token, refresh_token, token_expires_at, scopes_granted,
         sync_status, connected_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'active',NOW())
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
       RETURNING id`,
      [
        tenantId, creatorId, platform,
        platformUserId,
        platformUsername     ?? null,
        platformDisplayName  ?? null,
        platformUrl          ?? null,
        encryptedAccess,
        encryptedRefresh,
        expiresAt,
        scopesGranted        ?? [],
      ]
    );
    const platformProfileId = upsertRows[0].id;

    // Advance onboarding step on first connection
    await client.query(
      `UPDATE creators
         SET onboarding_step = 'platform_connected'
       WHERE id = $1 AND onboarding_step = 'account_created'`,
      [creatorId]
    );

    await client.query('COMMIT');
    return { creatorId, platform, platformProfileId };

  } catch (err) {
    await client.query('ROLLBACK');

    // Unique constraint: this platform account is already connected to another tenant
    if (err.code === '23505' && err.constraint === 'creator_platform_profiles_platform_platform_user_id_key') {
      const e = new Error('This platform account is already connected to another Creatrbase account.');
      e.statusCode = 409;
      throw e;
    }

    throw err;
  } finally {
    client.release();
  }
}

// ─── getConnectedPlatforms ────────────────────────────────────────────────────
// Returns safe, token-free platform data for the authenticated creator.
// ─────────────────────────────────────────────────────────────────────────────

async function getConnectedPlatforms(userId, tenantId) {
  const { rows } = await getPool().query(
    `SELECT
       cpp.platform,
       cpp.platform_username,
       cpp.platform_display_name,
       cpp.platform_url,
       cpp.connected_at,
       cpp.sync_status,
       cpp.last_synced_at,
       cpp.subscriber_count,
       cpp.total_view_count,
       cpp.watch_hours_12mo,
       cpp.avg_concurrent_viewers_30d
     FROM creator_platform_profiles cpp
     JOIN creators c ON c.id = cpp.creator_id
     WHERE c.user_id = $1 AND c.tenant_id = $2
     ORDER BY cpp.connected_at ASC`,
    [userId, tenantId]
  );
  return rows;
}

module.exports = { connectPlatform, getConnectedPlatforms };
