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
const { connectPlatform, getConnectedPlatforms } = require('./platformConnectService');
const { getDataCollectionQueue }                 = require('../../jobs/queue');

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
      } catch (err) {
        if (err.statusCode === 409) {
          // Channel already claimed by another Creatrbase account
          return reply.redirect('/dashboard?connect_error=youtube_already_claimed');
        }
        throw err;
      }

      return reply.redirect('/dashboard?connected=youtube');
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

      return reply.redirect('/dashboard?connected=twitch');
    });

  } else {
    app.get('/api/connect/twitch', async (_, reply) =>
      reply.code(503).send({ error: 'Twitch connection not configured' })
    );
    app.get('/api/connect/twitch/callback', async (_, reply) =>
      reply.code(503).send({ error: 'Twitch connection not configured' })
    );
  }

  // ── GET /api/connect/platforms ─────────────────────────────────────────────
  // Returns connected platforms for the authenticated creator — no tokens.

  app.get('/api/connect/platforms', { preHandler: authenticate }, async (req) => {
    const platforms = await getConnectedPlatforms(req.user.userId, req.user.tenantId);
    return { platforms };
  });
}

module.exports = platformConnectRoutes;
