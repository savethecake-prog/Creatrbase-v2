'use strict';

const bcrypt = require('bcrypt');
const { getPool } = require('../../db/pool');
const { createStripeCustomer, createTrialSubscription } = require('../billing/billingService');

const BCRYPT_ROUNDS = 12;
const SESSION_TTL_DAYS = 7;

// ─── Signup ──────────────────────────────────────────────────────────────────

async function signup({ firstName, lastName, email, password, ip, userAgent }) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Reject if email already exists
    const existing = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    if (existing.rowCount > 0) {
      const err = new Error('An account with this email already exists.');
      err.statusCode = 409;
      throw err;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // tenant → user → auth_provider (local) → creator — all in one transaction
    const { rows: [tenant] } = await client.query(
      `INSERT INTO tenants DEFAULT VALUES RETURNING id`
    );

    const displayName = [firstName, lastName].filter(Boolean).join(' ').trim() || email;

    const { rows: [user] } = await client.query(
      `INSERT INTO users (tenant_id, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, tenant_id, email`,
      [tenant.id, email.toLowerCase().trim(), passwordHash]
    );

    await client.query(
      `INSERT INTO auth_providers (user_id, provider) VALUES ($1, 'local')`,
      [user.id]
    );

    await client.query(
      `INSERT INTO creators (tenant_id, user_id, display_name) VALUES ($1, $2, $3)`,
      [tenant.id, user.id, displayName]
    );

    // Stripe customer + trial subscription (outside transaction — Stripe is external)
    // If Stripe fails, we still complete signup and retry can be done later
    let stripeCustomerId = 'pending';
    try {
      stripeCustomerId = await createStripeCustomer(email.toLowerCase().trim(), displayName);
      await createTrialSubscription(client, { tenantId: tenant.id, stripeCustomerId });
    } catch (stripeErr) {
      // Non-fatal: log but don't fail signup
      console.error('Stripe setup failed at signup (non-fatal):', stripeErr.message);
    }

    const session = await createSession(client, { userId: user.id, tenantId: tenant.id, ip, userAgent });

    await client.query('COMMIT');

    return { userId: user.id, tenantId: tenant.id, sessionId: session.id, displayName };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Login ───────────────────────────────────────────────────────────────────

async function login({ email, password, ip, userAgent }) {
  const pool = getPool();

  const { rows } = await pool.query(
    `SELECT u.id, u.tenant_id, u.password_hash,
            c.display_name
     FROM users u
     JOIN creators c ON c.user_id = u.id
     WHERE u.email = $1`,
    [email.toLowerCase().trim()]
  );

  const user = rows[0];
  const invalid = new Error('Incorrect email or password.');
  invalid.statusCode = 401;

  if (!user) throw invalid;
  if (!user.password_hash) {
    // OAuth-only account — no password set
    const err = new Error('This account uses Google or Twitch to sign in.');
    err.statusCode = 401;
    throw err;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw invalid;

  const client = await pool.connect();
  try {
    const session = await createSession(client, {
      userId: user.id,
      tenantId: user.tenant_id,
      ip,
      userAgent,
    });
    return {
      userId: user.id,
      tenantId: user.tenant_id,
      sessionId: session.id,
      displayName: user.display_name,
    };
  } finally {
    client.release();
  }
}

// ─── OAuth upsert ─────────────────────────────────────────────────────────────
// Called after a successful OAuth callback. Creates the user if they don't
// exist, or finds the existing one. Returns the same shape as login/signup.

async function oauthUpsert({ provider, providerId, email, displayName, ip, userAgent }) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check if this OAuth identity already exists
    const { rows: existing } = await client.query(
      `SELECT u.id, u.tenant_id, c.display_name
       FROM auth_providers ap
       JOIN users u ON u.id = ap.user_id
       JOIN creators c ON c.user_id = u.id
       WHERE ap.provider = $1 AND ap.provider_id = $2`,
      [provider, providerId]
    );

    if (existing[0]) {
      const u = existing[0];
      const session = await createSession(client, {
        userId: u.id, tenantId: u.tenant_id, ip, userAgent,
      });
      await client.query('COMMIT');
      return { userId: u.id, tenantId: u.tenant_id, sessionId: session.id, displayName: u.display_name };
    }

    // Check if email already exists (link provider to existing account)
    const { rows: byEmail } = await client.query(
      `SELECT u.id, u.tenant_id, c.display_name
       FROM users u JOIN creators c ON c.user_id = u.id
       WHERE u.email = $1`,
      [email.toLowerCase().trim()]
    );

    let userId, tenantId, resolvedName;

    if (byEmail[0]) {
      // Link new provider to existing account
      userId      = byEmail[0].id;
      tenantId    = byEmail[0].tenant_id;
      resolvedName = byEmail[0].display_name;
      await client.query(
        `INSERT INTO auth_providers (user_id, provider, provider_id) VALUES ($1, $2, $3)`,
        [userId, provider, providerId]
      );
    } else {
      // Brand new user
      const { rows: [tenant] } = await client.query(
        `INSERT INTO tenants DEFAULT VALUES RETURNING id`
      );
      const { rows: [user] } = await client.query(
        `INSERT INTO users (tenant_id, email) VALUES ($1, $2) RETURNING id, tenant_id`,
        [tenant.id, email.toLowerCase().trim()]
      );
      await client.query(
        `INSERT INTO auth_providers (user_id, provider, provider_id) VALUES ($1, $2, $3)`,
        [user.id, provider, providerId]
      );
      await client.query(
        `INSERT INTO creators (tenant_id, user_id, display_name) VALUES ($1, $2, $3)`,
        [tenant.id, user.id, displayName || email]
      );
      userId       = user.id;
      tenantId     = tenant.id;
      resolvedName = displayName || email;
    }

    const session = await createSession(client, { userId, tenantId, ip, userAgent });
    await client.query('COMMIT');
    return { userId, tenantId, sessionId: session.id, displayName: resolvedName };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Session management ───────────────────────────────────────────────────────

async function createSession(client, { userId, tenantId, ip, userAgent }) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_TTL_DAYS);

  const { rows: [session] } = await client.query(
    `INSERT INTO sessions (user_id, tenant_id, ip_address, user_agent, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [userId, tenantId, ip ?? null, userAgent ?? null, expiresAt]
  );
  return session;
}

async function validateSession(sessionId) {
  const { rows } = await getPool().query(
    `SELECT s.id, s.user_id, s.tenant_id, s.expires_at,
            u.email, c.display_name
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     JOIN creators c ON c.user_id = s.user_id
     WHERE s.id = $1 AND s.expires_at > NOW()`,
    [sessionId]
  );
  return rows[0] ?? null;
}

async function revokeSession(sessionId) {
  await getPool().query('DELETE FROM sessions WHERE id = $1', [sessionId]);
}

module.exports = { signup, login, oauthUpsert, validateSession, revokeSession };
