'use strict';

// ─── Platform connect routes ──────────────────────────────────────────────────
//
// These are DISTINCT from the auth OAuth flows in authRoutes.js.
//
//   authRoutes.js      → Google / Twitch LOGIN   (scopes: openid email profile)
//   platformConnect    → YouTube / Twitch DATA    (scopes: youtube.readonly, etc.)
//
// Both flows use the same Google / Twitch credentials, but different OAuth
// authorisation requests with different scopes and different callback URIs.
//
// Tenant isolation:
//   Every route that writes data requires authenticate middleware.
//   connectPlatform() derives creator_id from the session — never from the
//   request body. UNIQUE(platform, platform_user_id) in the DB prevents the
//   same external account being claimed by two tenants.
//
// ─────────────────────────────────────────────────────────────────────────────

const { authenticate }    = require('../../middleware/authenticate');
const { connectPlatform, getConnectedPlatforms, disconnectPlatform } = require('./platformConnectService');
const { getDataCollectionQueue }                 = require('../../jobs/queue');
const { getPrisma }       = require('../../lib/prisma');

// YouTube scopes needed for channel data + analytics
const YT_SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
];

// Twitch scopes needed for channel data
// user:read:email         — profile + email
// moderator:read:followers — follower count (required since Twitch API April 2023 change)
const TWITCH_DATA_SCOPES = [
  'user:read:email',
  'moderator:read:followers',
];

async function platformConnectRoutes(app) {
  const GOOGLE_ENABLED = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const TWITCH_ENABLED = !!(process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET);

  // ── YouTube ────────────────────────────────────────────────────────────────

  if (GOOGLE_ENABLED) {
    const oauthPlugin = require('@fastify/oauth2');

    // Separate registration from the login Google OAuth (different name + scopes + callback)
    app.register(oauthPlugin, {
      name:        'ytConnectOAuth2',
      scope:       YT_SCOPES,
      credentials: {
        client: {
          id:     process.env.GOOGLE_CLIENT_ID,
          secret: process.env.GOOGLE_CLIENT_SECRET,
        },
        auth: oauthPlugin.GOOGLE_CONFIGURATION,
      },
      callbackUri: `${process.env.APP_URL}/api/connect/youtube/callback`,
      // No startRedirectPath — we register the start route manually so we can
      // enforce authentication before initiating the OAuth flow
    });

    // Start: must be authenticated — no point sending an unauthenticated user
    // through a YouTube OAuth flow we can't complete for them
    app.get('/api/connect/youtube', { preHandler: authenticate }, async (req, reply) => {
      // access_type=offline → Google returns a refresh token (required for background sync)
      // prompt=consent      → forces the consent screen even if user has authorised before,
      //                       ensuring we always receive a fresh refresh token
      const baseUri = await app.ytConnectOAuth2.generateAuthorizationUri(req, reply);
      const uri     = new URL(baseUri);
      uri.searchParams.set('access_type', 'offline');
      uri.searchParams.set('prompt', 'consent');
      return reply.redirect(uri.toString());
    });

    // Callback: Google redirects here after the user grants (or denies) access.
    // The user's session cookie travels with the browser redirect, so authenticate works.
    app.get('/api/connect/youtube/callback', { preHandler: authenticate }, async (req, reply) => {
      let token;
      try {
        token = await app.ytConnectOAuth2.getAccessTokenFromAuthorizationCodeFlow(req);
      } catch (err) {
        // User denied access, or OAuth state mismatch (CSRF attempt blocked)
        app.log.warn({ err }, 'YouTube connect OAuth error');
        return reply.redirect('/dashboard?connect_error=youtube_denied');
      }

      // Fetch the channel this token belongs to
      const channelRes = await fetch(
        'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true',
        { headers: { Authorization: `Bearer ${token.token.access_token}` } }
      );
      const channelData = await channelRes.json();
      const channel     = channelData.items?.[0];

      if (!channel) {
        // Valid Google account but no YouTube channel attached
        app.log.warn({ userId: req.user.userId }, 'YouTube connect: no channel found');
        return reply.redirect('/dashboard?connect_error=youtube_no_channel');
      }

      const customUrl = channel.snippet?.customUrl ?? null;

      try {
        const { platformProfileId } = await connectPlatform({
          userId:              req.user.userId,
          tenantId:            req.user.tenantId,
          platform:            'youtube',
          platformUserId:      channel.id,
          platformUsername:    customUrl,
          platformDisplayName: channel.snippet?.title ?? null,
          platformUrl:         customUrl
                                 ? `https://www.youtube.com/${customUrl}`
                                 : `https://www.youtube.com/channel/${channel.id}`,
          accessToken:         token.token.access_token,
          refreshToken:        token.token.refresh_token ?? null,
          tokenExpiresAt:      token.token.expires_at
                                 ? Math.floor(new Date(token.token.expires_at).getTime() / 1000)
                                 : null,
          scopesGranted:       YT_SCOPES,
        });

        // Queue an immediate sync so KPI cards populate without waiting for cron
        getDataCollectionQueue().add('platform-sync', { platformProfileId });
        // Queue baseline content analysis (niche classification)
        getDataCollectionQueue().add('analysis:baseline-run', { platformProfileId });
      } catch (err) {
        if (err.statusCode === 409) {
          // Channel already claimed by another Creatrbase account
          return reply.redirect('/dashboard?connect_error=youtube_already_claimed');
        }
        throw err;
      }

      // New users (account_created step) go back to onboarding to see the processing screen.
      // Existing users reconnecting go to dashboard with a success banner.
      const prisma = require('../../lib/prisma').getPrisma();
      const creator = await prisma.creator.findFirst({
        where:  { userId: req.user.userId, tenantId: req.user.tenantId },
        select: { onboardingStep: true },
      });
      // Only route to onboarding if this is a brand-new account that has never
      // connected a platform before. Any other step means they've been through
      // the flow already (including reconnecting after a disconnect).
      const isFirstEverConnect = !creator || creator.onboardingStep === 'account_created';
      // New users → onboarding processing screen
      // Existing users → connections page so panels update immediately
      return reply.redirect(isFirstEverConnect ? '/onboarding' : '/connections?connected=youtube');
    });

  } else {
    app.get('/api/connect/youtube', async (_, reply) =>
      reply.code(503).send({ error: 'YouTube connection not configured' })
    );
    app.get('/api/connect/youtube/callback', async (_, reply) =>
      reply.code(503).send({ error: 'YouTube connection not configured' })
    );
  }

  // ── Twitch ─────────────────────────────────────────────────────────────────

  if (TWITCH_ENABLED) {
    const oauthPlugin = require('@fastify/oauth2');

    // Separate registration from the login Twitch OAuth (different name + scopes + callback)
    app.register(oauthPlugin, {
      name:        'twitchConnectOAuth2',
      scope:       TWITCH_DATA_SCOPES,
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
      callbackUri: `${process.env.APP_URL}/api/connect/twitch/callback`,
    });

    app.get('/api/connect/twitch', { preHandler: authenticate }, async (req, reply) => {
      const uri = await app.twitchConnectOAuth2.generateAuthorizationUri(req, reply);
      return reply.redirect(uri);
    });

    app.get('/api/connect/twitch/callback', { preHandler: authenticate }, async (req, reply) => {
      let token;
      try {
        token = await app.twitchConnectOAuth2.getAccessTokenFromAuthorizationCodeFlow(req);
      } catch (err) {
        app.log.warn({ err }, 'Twitch connect OAuth error');
        return reply.redirect('/dashboard?connect_error=twitch_denied');
      }

      const profileRes = await fetch('https://api.twitch.tv/helix/users', {
        headers: {
          Authorization: `Bearer ${token.token.access_token}`,
          'Client-Id':   process.env.TWITCH_CLIENT_ID,
        },
      });
      const profileData = await profileRes.json();
      const twitchUser  = profileData.data?.[0];

      if (!twitchUser) {
        app.log.warn({ userId: req.user.userId }, 'Twitch connect: no user profile returned');
        return reply.redirect('/dashboard?connect_error=twitch_no_profile');
      }

      try {
        const { platformProfileId } = await connectPlatform({
          userId:              req.user.userId,
          tenantId:            req.user.tenantId,
          platform:            'twitch',
          platformUserId:      twitchUser.id,
          platformUsername:    twitchUser.login,
          platformDisplayName: twitchUser.display_name,
          platformUrl:         `https://www.twitch.tv/${twitchUser.login}`,
          accessToken:         token.token.access_token,
          refreshToken:        token.token.refresh_token ?? null,
          tokenExpiresAt:      token.token.expires_at
                                 ? Math.floor(new Date(token.token.expires_at).getTime() / 1000)
                                 : null,
          scopesGranted:       TWITCH_DATA_SCOPES,
        });

        // Queue immediate sync (worker will skip unsupported platforms gracefully)
        getDataCollectionQueue().add('platform-sync', { platformProfileId });
      } catch (err) {
        if (err.statusCode === 409) {
          return reply.redirect('/dashboard?connect_error=twitch_already_claimed');
        }
        throw err;
      }

      return reply.redirect('/connections?connected=twitch');
    });

  } else {
    app.get('/api/connect/twitch', async (_, reply) =>
      reply.code(503).send({ error: 'Twitch connection not configured' })
    );
    app.get('/api/connect/twitch/callback', async (_, reply) =>
      reply.code(503).send({ error: 'Twitch connection not configured' })
    );
  }

  // ── TikTok ─────────────────────────────────────────────────────────────────
  // TikTok uses `client_key` (not `client_id`) so we can't use @fastify/oauth2.
  // We handle the OAuth flow manually with a state cookie for CSRF protection.

  const TIKTOK_ENABLED   = !!(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET);
  const TIKTOK_DEMO_MODE = process.env.TIKTOK_DEMO_MODE === 'true';
  const TIKTOK_SCOPES    = ['user.info.basic', 'user.info.profile', 'user.info.stats', 'video.list'];
  const TIKTOK_AUTH_URL  = 'https://www.tiktok.com/v2/auth/authorize/';
  const TIKTOK_CALLBACK  = `${process.env.APP_URL}/api/connect/tiktok/callback`;

  if (TIKTOK_DEMO_MODE) {
    // ── Demo/mock mode — bypasses real OAuth for recording the review video ──
    // Remove TIKTOK_DEMO_MODE from .env once real credentials are available.

    app.get('/api/connect/tiktok', { preHandler: authenticate }, async (req, reply) => {
      // Skip TikTok entirely — go straight to mock callback
      return reply.redirect(`${process.env.APP_URL}/api/connect/tiktok/callback?demo=1`);
    });

    app.get('/api/connect/tiktok/callback', { preHandler: authenticate }, async (req, reply) => {
      if (req.query.demo !== '1') {
        return reply.redirect('/connections?connect_error=tiktok_denied');
      }

      // Inject a realistic fake TikTok profile
      try {
        const { platformProfileId } = await connectPlatform({
          userId:              req.user.userId,
          tenantId:            req.user.tenantId,
          platform:            'tiktok',
          platformUserId:      'demo_tiktok_' + req.user.userId,
          platformUsername:    'creatrbase_demo',
          platformDisplayName: 'Creatrbase Demo',
          platformUrl:         'https://www.tiktok.com/@creatrbase_demo',
          accessToken:         'demo_access_token',
          refreshToken:        'demo_refresh_token',
          tokenExpiresAt:      Math.floor((Date.now() + 86400 * 1000) / 1000),
          scopesGranted:       TIKTOK_SCOPES,
        });

        // Directly write mock metrics — no real API call needed
        const prisma = getPrisma();
        await prisma.creatorPlatformProfile.update({
          where: { id: platformProfileId },
          data: {
            subscriberCount:      24800,
            tiktokFollowingCount: 312,
            tiktokLikeCount:      187400,
            tiktokVideoCount:     94,
            tiktokVerified:       false,
            syncStatus:           'active',
            lastSyncedAt:         new Date(),
            analyticsLastSyncedAt: new Date(),
          },
        });
      } catch (err) {
        if (err.statusCode !== 409) throw err;
        // Already connected — just redirect
      }

      return reply.redirect('/connections?connected=tiktok');
    });

  } else if (TIKTOK_ENABLED) {
    const { randomBytes }        = require('crypto');
    const { exchangeCodeForToken, getTikTokUserInfo } = require('../../services/tiktok');

    // Start: redirect to TikTok auth with a state cookie for CSRF protection
    app.get('/api/connect/tiktok', { preHandler: authenticate }, async (req, reply) => {
      const state = randomBytes(16).toString('hex');
      reply.setCookie('tt_oauth_state', state, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge:   600, // 10 minutes
        path:     '/',
      });

      const url = new URL(TIKTOK_AUTH_URL);
      url.searchParams.set('client_key',     process.env.TIKTOK_CLIENT_KEY);
      url.searchParams.set('scope',          TIKTOK_SCOPES.join(','));
      url.searchParams.set('response_type',  'code');
      url.searchParams.set('redirect_uri',   TIKTOK_CALLBACK);
      url.searchParams.set('state',          state);

      return reply.redirect(url.toString());
    });

    // Callback: TikTok redirects here after consent
    app.get('/api/connect/tiktok/callback', { preHandler: authenticate }, async (req, reply) => {
      const { code, state, error } = req.query;

      if (error) {
        app.log.warn({ error }, 'TikTok connect denied');
        return reply.redirect('/connections?connect_error=tiktok_denied');
      }

      // Verify CSRF state
      const savedState = req.cookies?.tt_oauth_state;
      reply.clearCookie('tt_oauth_state', { path: '/' });
      if (!savedState || savedState !== state) {
        app.log.warn('TikTok connect: state mismatch');
        return reply.redirect('/connections?connect_error=tiktok_state_mismatch');
      }

      let tokenData;
      try {
        tokenData = await exchangeCodeForToken(code, TIKTOK_CALLBACK);
      } catch (err) {
        app.log.error({ err }, 'TikTok token exchange failed');
        return reply.redirect('/connections?connect_error=tiktok_token_failed');
      }

      let userInfo;
      try {
        userInfo = await getTikTokUserInfo(tokenData.accessToken, tokenData.openId);
      } catch (err) {
        app.log.error({ err }, 'TikTok user info fetch failed');
        return reply.redirect('/connections?connect_error=tiktok_profile_failed');
      }

      try {
        const { platformProfileId } = await connectPlatform({
          userId:              req.user.userId,
          tenantId:            req.user.tenantId,
          platform:            'tiktok',
          platformUserId:      userInfo.openId,
          platformUsername:    userInfo.displayName,
          platformDisplayName: userInfo.displayName,
          platformUrl:         userInfo.profileDeepLink ?? null,
          accessToken:         tokenData.accessToken,
          refreshToken:        tokenData.refreshToken ?? null,
          tokenExpiresAt:      tokenData.expiresAt
                                 ? Math.floor(tokenData.expiresAt.getTime() / 1000)
                                 : null,
          scopesGranted: TIKTOK_SCOPES,
        });

        getDataCollectionQueue().add('platform-sync', { platformProfileId });
      } catch (err) {
        if (err.statusCode === 409) {
          return reply.redirect('/connections?connect_error=tiktok_already_claimed');
        }
        throw err;
      }

      return reply.redirect('/connections?connected=tiktok');
    });

  } else {
    app.get('/api/connect/tiktok', async (_, reply) =>
      reply.code(503).send({ error: 'TikTok connection not configured' })
    );
    app.get('/api/connect/tiktok/callback', async (_, reply) =>
      reply.code(503).send({ error: 'TikTok connection not configured' })
    );
  }

  // ── GET /api/connect/platforms ─────────────────────────────────────────────
  // Returns connected platforms for the authenticated creator — no tokens.

  app.get('/api/connect/platforms', { preHandler: authenticate }, async (req) => {
    const platforms = await getConnectedPlatforms(req.user.userId, req.user.tenantId);
    return { platforms };
  });

  // ── POST /api/connect/:platform/sync ───────────────────────────────────────
  // Queues an immediate platform-sync job for the given platform.

  app.post('/api/connect/:platform/sync', { preHandler: authenticate }, async (req, reply) => {
    const { platform } = req.params;
    if (!['youtube', 'twitch', 'tiktok'].includes(platform)) {
      return reply.code(400).send({ error: 'Unknown platform' });
    }

    const prisma  = getPrisma();
    const creator = await prisma.creator.findFirst({
      where:  { userId: req.user.userId, tenantId: req.user.tenantId },
      select: { id: true },
    });
    if (!creator) return reply.code(404).send({ error: 'Creator not found' });

    const profile = await prisma.creatorPlatformProfile.findFirst({
      where:  { creatorId: creator.id, platform, syncStatus: { not: 'disconnected' } },
      select: { id: true },
    });
    if (!profile) return reply.code(404).send({ error: `${platform} not connected` });

    await getDataCollectionQueue().add('platform-sync', { platformProfileId: profile.id });
    return { ok: true, message: 'Sync queued' };
  });

  // ── DELETE /api/connect/:platform ──────────────────────────────────────────
  // Disconnects a platform — clears tokens, marks syncStatus = 'disconnected'.

  app.delete('/api/connect/:platform', { preHandler: authenticate }, async (req, reply) => {
    const { platform } = req.params;
    if (!['youtube', 'twitch', 'tiktok'].includes(platform)) {
      return reply.code(400).send({ error: 'Unknown platform' });
    }

    const prisma  = getPrisma();
    const creator = await prisma.creator.findFirst({
      where:  { userId: req.user.userId, tenantId: req.user.tenantId },
      select: { id: true },
    });
    if (!creator) return reply.code(404).send({ error: 'Creator not found' });

    const result = await disconnectPlatform(creator.id, platform);
    if (!result) return reply.code(404).send({ error: `${platform} not connected` });

    return { ok: true };
  });
}

module.exports = platformConnectRoutes;
