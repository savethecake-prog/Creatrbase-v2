'use strict';

const { signup, login, oauthUpsert, revokeSession } = require('./authService');

const COOKIE_NAME  = 'cb_session';
const COOKIE_OPTS  = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path:     '/',
  maxAge:   60 * 60 * 24 * 7, // 7 days in seconds
};

function setSessionCookie(reply, app, payload) {
  const token = app.jwt.sign(payload, { expiresIn: '7d' });
  reply.setCookie(COOKIE_NAME, token, COOKIE_OPTS);
  return token;
}

async function authRoutes(app) {
  // ── POST /api/auth/signup ───────────────────────────────────────────────────
  app.post('/api/auth/signup', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          firstName: { type: 'string', maxLength: 100 },
          lastName:  { type: 'string', maxLength: 100 },
          email:     { type: 'string', format: 'email' },
          password:  { type: 'string', minLength: 8, maxLength: 72 },
        },
      },
    },
  }, async (req, reply) => {
    const { firstName = '', lastName = '', email, password } = req.body;
    const result = await signup({
      firstName, lastName, email, password,
      ip:        req.ip,
      userAgent: req.headers['user-agent'],
    });
    setSessionCookie(reply, app, {
      userId:    result.userId,
      tenantId:  result.tenantId,
      sessionId: result.sessionId,
    });
    return reply.code(201).send({ displayName: result.displayName });
  });

  // ── POST /api/auth/login ────────────────────────────────────────────────────
  app.post('/api/auth/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email:    { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (req, reply) => {
    const { email, password } = req.body;
    const result = await login({
      email, password,
      ip:        req.ip,
      userAgent: req.headers['user-agent'],
    });
    setSessionCookie(reply, app, {
      userId:    result.userId,
      tenantId:  result.tenantId,
      sessionId: result.sessionId,
    });
    return { displayName: result.displayName };
  });

  // ── POST /api/auth/logout ───────────────────────────────────────────────────
  app.post('/api/auth/logout', async (req, reply) => {
    try {
      await req.jwtVerify();
      await revokeSession(req.user.sessionId);
    } catch {
      // Best-effort — clear cookie regardless
    }
    reply.clearCookie(COOKIE_NAME, { path: '/' });
    return { ok: true };
  });

  // ── GET /api/auth/me ────────────────────────────────────────────────────────
  const { authenticate } = require('../../middleware/authenticate');
  const { getSubscription } = require('../billing/billingService');
  const { resolveTier } = require('../../services/tierResolver');

  app.get('/api/auth/me', { preHandler: authenticate }, async (req) => {
    const prisma = require('../../lib/prisma').getPrisma();

    const [sub, creator, tierInfo] = await Promise.all([
      getSubscription(req.user.tenantId),
      prisma.creator.findFirst({
        where:  { userId: req.user.userId, tenantId: req.user.tenantId },
        select: { onboardingStep: true },
      }),
      resolveTier(req.user.tenantId),
    ]);

    const trialDaysLeft = sub?.trialEnd
      ? Math.max(0, Math.ceil((new Date(sub.trialEnd) - new Date()) / (1000 * 60 * 60 * 24)))
      : null;

    return {
      userId:         req.user.userId,
      tenantId:       req.user.tenantId,
      email:          req.user.email,
      displayName:    req.user.displayName,
      onboardingStep: creator?.onboardingStep ?? null,
      tier:           tierInfo.tier,
      subscription: sub ? {
        status:        tierInfo.status,
        planName:      sub.plan?.name ?? null,
        trialEnd:      sub.trialEnd,
        trialDaysLeft,
        features:      sub.plan?.features ?? null,
      } : null,
    };
  });

  // ── OAuth: Google ───────────────────────────────────────────────────────────
  const GOOGLE_ENABLED = !!(process.env.GOOGLE_LOGIN_CLIENT_ID && process.env.GOOGLE_LOGIN_CLIENT_SECRET);
  const TWITCH_ENABLED = !!(process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET);

  if (GOOGLE_ENABLED) {
    const oauthPlugin = require('@fastify/oauth2');
    app.register(oauthPlugin, {
      name:           'googleOAuth2',
      scope:          ['openid', 'email', 'profile'],
      credentials: {
        client: {
          id:     process.env.GOOGLE_LOGIN_CLIENT_ID,
          secret: process.env.GOOGLE_LOGIN_CLIENT_SECRET,
        },
        auth: oauthPlugin.GOOGLE_CONFIGURATION,
      },
      startRedirectPath: '/api/auth/google',
      callbackUri:       `${process.env.APP_URL}/api/auth/google/callback`,
    });

    app.get('/api/auth/google/callback', async (req, reply) => {
      const token = await app.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(req);
      const profile = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${token.token.access_token}` },
      }).then(r => r.json());

      const result = await oauthUpsert({
        provider:    'google',
        providerId:  profile.id,
        email:       profile.email,
        displayName: profile.name,
        ip:          req.ip,
        userAgent:   req.headers['user-agent'],
      });

      setSessionCookie(reply, app, {
        userId:    result.userId,
        tenantId:  result.tenantId,
        sessionId: result.sessionId,
      });
      return reply.redirect('/dashboard');
    });
  } else {
    app.get('/api/auth/google', async (_, reply) =>
      reply.code(503).send({ error: 'Google OAuth not configured' })
    );
  }

  // ── OAuth: Twitch ───────────────────────────────────────────────────────────
  if (TWITCH_ENABLED) {
    const oauthPlugin = require('@fastify/oauth2');
    app.register(oauthPlugin, {
      name:           'twitchOAuth2',
      scope:          ['user:read:email'],
      credentials: {
        client: {
          id:     process.env.TWITCH_CLIENT_ID,
          secret: process.env.TWITCH_CLIENT_SECRET,
        },
        auth: {
          authorizeHost: 'https://id.twitch.tv',
          authorizePath: '/oauth2/authorize',
          tokenHost:     'https://id.twitch.tv',
          tokenPath:     '/oauth2/token',
        },
        options: {
          authorizationMethod: 'body',
        },
      },
      startRedirectPath: '/api/auth/twitch',
      callbackUri:       `${process.env.APP_URL}/api/auth/twitch/callback`,
    });

    app.get('/api/auth/twitch/callback', async (req, reply) => {
      const token = await app.twitchOAuth2.getAccessTokenFromAuthorizationCodeFlow(req);
      const profile = await fetch('https://api.twitch.tv/helix/users', {
        headers: {
          Authorization:  `Bearer ${token.token.access_token}`,
          'Client-Id':    process.env.TWITCH_CLIENT_ID,
        },
      }).then(r => r.json());

      const twitchUser = profile.data?.[0];
      if (!twitchUser) throw new Error('Failed to fetch Twitch profile');

      const result = await oauthUpsert({
        provider:    'twitch',
        providerId:  twitchUser.id,
        email:       twitchUser.email,
        displayName: twitchUser.display_name,
        ip:          req.ip,
        userAgent:   req.headers['user-agent'],
      });

      setSessionCookie(reply, app, {
        userId:    result.userId,
        tenantId:  result.tenantId,
        sessionId: result.sessionId,
      });
      return reply.redirect('/dashboard');
    });
  } else {
    app.get('/api/auth/twitch', async (_, reply) =>
      reply.code(503).send({ error: 'Twitch OAuth not configured' })
    );
  }
}

module.exports = authRoutes;
