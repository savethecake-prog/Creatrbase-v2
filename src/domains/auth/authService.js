'use strict';

const bcrypt = require('bcrypt');
const { getPrisma } = require('../../lib/prisma');
const { createFreeSubscription } = require('../billing/billingService');

const BCRYPT_ROUNDS  = 12;
const SESSION_TTL_DAYS = 7;

// ─── Signup ──────────────────────────────────────────────────────────────────

async function signup({ firstName, lastName, email, password, ip, userAgent }) {
  const prisma = getPrisma();
  const normalEmail = email.toLowerCase().trim();

  // 1. Core DB transaction — tenant, user, creator, session
  const { userId, tenantId, sessionId, displayName } = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { email: normalEmail } });
    if (existing) {
      const err = new Error('An account with this email already exists.');
      err.statusCode = 409;
      throw err;
    }

    const passwordHash  = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const resolvedName  = [firstName, lastName].filter(Boolean).join(' ').trim() || normalEmail;

    const tenant = await tx.tenant.create({ data: {} });
    const user   = await tx.user.create({
      data: { tenantId: tenant.id, email: normalEmail, passwordHash },
    });

    await tx.authProvider.create({ data: { userId: user.id, provider: 'local' } });
    await tx.creator.create({
      data: { tenantId: tenant.id, userId: user.id, displayName: resolvedName },
    });

    const session = await createSession(tx, { userId: user.id, tenantId: tenant.id, ip, userAgent });

    return { userId: user.id, tenantId: tenant.id, sessionId: session.id, displayName: resolvedName };
  });

  // 2. Free subscription — no Stripe call, non-fatal
  try {
    await createFreeSubscription({ tenantId });
  } catch (subErr) {
    console.error('Free subscription setup failed at signup (non-fatal):', subErr.message);
  }

  return { userId, tenantId, sessionId, displayName };
}

// ─── Login ───────────────────────────────────────────────────────────────────

async function login({ email, password, ip, userAgent }) {
  const prisma = getPrisma();

  const user = await prisma.user.findUnique({
    where:   { email: email.toLowerCase().trim() },
    include: { creator: { select: { displayName: true } } },
  });

  const invalid = new Error('Incorrect email or password.');
  invalid.statusCode = 401;

  if (!user) throw invalid;

  if (!user.passwordHash) {
    const err = new Error('This account uses Google or Twitch to sign in.');
    err.statusCode = 401;
    throw err;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw invalid;

  const session = await prisma.$transaction(async (tx) =>
    createSession(tx, { userId: user.id, tenantId: user.tenantId, ip, userAgent })
  );

  return {
    userId:      user.id,
    tenantId:    user.tenantId,
    sessionId:   session.id,
    displayName: user.creator?.displayName ?? '',
  };
}

// ─── OAuth upsert ─────────────────────────────────────────────────────────────

async function oauthUpsert({ provider, providerId, email, displayName, ip, userAgent }) {
  const prisma     = getPrisma();
  const normalEmail = email.toLowerCase().trim();

  const { userId, tenantId, sessionId, resolvedName, isNew } =
    await prisma.$transaction(async (tx) => {

      // Check if this OAuth identity already exists
      const existingProvider = await tx.authProvider.findUnique({
        where:   { provider_providerId: { provider, providerId } },
        include: { user: { include: { creator: { select: { displayName: true } } } } },
      });

      if (existingProvider) {
        const u       = existingProvider.user;
        const session = await createSession(tx, { userId: u.id, tenantId: u.tenantId, ip, userAgent });
        return { userId: u.id, tenantId: u.tenantId, sessionId: session.id,
                 resolvedName: u.creator?.displayName ?? '', isNew: false };
      }

      // Check if email already exists — link provider to existing account
      const existingUser = await tx.user.findUnique({
        where:   { email: normalEmail },
        include: { creator: { select: { displayName: true } } },
      });

      let userId, tenantId, resolvedName;

      if (existingUser) {
        userId       = existingUser.id;
        tenantId     = existingUser.tenantId;
        resolvedName = existingUser.creator?.displayName ?? '';
        await tx.authProvider.create({ data: { userId, provider, providerId } });
      } else {
        // Brand new user
        const name   = displayName || normalEmail;
        const tenant = await tx.tenant.create({ data: {} });
        const user   = await tx.user.create({ data: { tenantId: tenant.id, email: normalEmail } });
        await tx.authProvider.create({ data: { userId: user.id, provider, providerId } });
        await tx.creator.create({
          data: { tenantId: tenant.id, userId: user.id, displayName: name },
        });
        userId       = user.id;
        tenantId     = tenant.id;
        resolvedName = name;
      }

      const session = await createSession(tx, { userId, tenantId, ip, userAgent });
      return { userId, tenantId, sessionId: session.id, resolvedName, isNew: !existingUser };
    });

  // Free subscription for brand-new users — no Stripe call, non-fatal
  if (isNew) {
    try {
      await createFreeSubscription({ tenantId });
    } catch (subErr) {
      console.error('Free subscription setup failed at OAuth signup (non-fatal):', subErr.message);
    }
  }

  return { userId, tenantId, sessionId, displayName: resolvedName };
}

// ─── Session helpers ──────────────────────────────────────────────────────────

async function createSession(tx, { userId, tenantId, ip, userAgent }) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_TTL_DAYS);

  return tx.session.create({
    data: {
      userId,
      tenantId,
      ipAddress: ip ? String(ip).slice(0, 64)  : null,
      userAgent: userAgent ? String(userAgent).slice(0, 500) : null,
      expiresAt,
    },
  });
}

async function validateSession(sessionId) {
  const session = await getPrisma().session.findFirst({
    where:   { id: sessionId, expiresAt: { gt: new Date() } },
    include: { user: { select: { email: true } } },
  });

  if (!session) return null;

  // Fetch displayName via the user relation → creator
  const creator = await getPrisma().creator.findUnique({
    where:  { userId: session.userId },
    select: { displayName: true },
  });

  return {
    id:          session.id,
    user_id:     session.userId,
    tenant_id:   session.tenantId,
    expires_at:  session.expiresAt,
    email:       session.user.email,
    display_name: creator?.displayName ?? '',
  };
}

async function revokeSession(sessionId) {
  await getPrisma().session.delete({ where: { id: sessionId } }).catch(() => {});
}

module.exports = { signup, login, oauthUpsert, validateSession, revokeSession };
