'use strict';

// Score card server-rendered route
// GET /score/:platform/:handle
// Returns complete HTML (not React SPA) with OG tags for social unfurls.

const { getPrisma }         = require('../../lib/prisma');
const { resolveChannelId, getPublicChannelStats } = require('../../services/publicYoutube');
const { resolveHandle: resolveTwitchHandle, getPublicStats: getTwitchPublicStats } = require('../../services/publicTwitch');
const { calculatePublicScore } = require('../../services/publicScoring');
const { renderScoreCardHTML }  = require('../../templates/scoreCard');

const YOUTUBE_HANDLE_RE = /^@?[a-zA-Z0-9_.-]{1,100}$/;
const TWITCH_HANDLE_RE  = /^[a-zA-Z0-9_]{4,25}$/;

// Rate limiting: 5 scores per IP per hour
const scoreRateLimit = {};
function checkScoreRateLimit(ip) {
  const now = Date.now();
  const key = ip + ':score';
  if (!scoreRateLimit[key]) scoreRateLimit[key] = [];
  scoreRateLimit[key] = scoreRateLimit[key].filter(t => t > now - 3600000);
  if (scoreRateLimit[key].length >= 5) return false;
  scoreRateLimit[key].push(now);
  return true;
}

async function scoreCardRoutes(app) {
  const prisma = getPrisma();

  app.get('/score/:platform/:handle', async (request, reply) => {
    const { platform, handle } = request.params;

    // Validate platform
    if (platform !== 'youtube' && platform !== 'twitch') {
      return reply.code(404).send({ error: 'Unsupported platform. Use youtube or twitch.' });
    }

    // Validate handle format
    const cleanHandle = handle.replace(/^@/, '');
    if (platform === 'youtube' && !YOUTUBE_HANDLE_RE.test(handle)) {
      return reply.code(400).send({ error: 'Invalid YouTube handle format.' });
    }
    if (platform === 'twitch' && !TWITCH_HANDLE_RE.test(cleanHandle)) {
      return reply.code(400).send({ error: 'Invalid Twitch handle format.' });
    }

    const forceRescore = request.query.rescore === '1';

    try {
      // Check cache — serve if score exists and is less than 24h old
      let cached = await prisma.publicScoreCard.findFirst({
        where: {
          platform,
          handle: cleanHandle.toLowerCase(),
        },
      });

      const cacheStale = cached && cached.expiresAt < new Date();
      const needsScore = !cached || cacheStale || forceRescore;

      if (!needsScore) {
        // Serve from cache, increment view count
        await prisma.publicScoreCard.update({
          where: { id: cached.id },
          data:  { viewCount: { increment: 1 } },
        });
      } else {
        // Rate limit new scoring requests
        const ip = request.headers['x-real-ip'] || request.ip;
        if (!cached && !checkScoreRateLimit(ip)) {
          return reply.code(429).type('text/html').send(
            '<html><body style="background:#FAF6EF;color:#1B1040;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh">' +
            '<div style="text-align:center"><h1>Too many requests</h1><p style="color:#76688F">Too many scoring attempts. Try again in a few minutes.</p>' +
            '<a href="/" style="color:#1B1040;margin-top:16px;display:inline-block">Back to home</a></div></body></html>'
          );
        }

        // Fetch public data and score
        let channelData = {};
        let channelName = cleanHandle;
        let channelAvatarUrl = null;

        if (platform === 'youtube') {
          const apiKey = process.env.YOUTUBE_API_KEY;
          if (!apiKey) throw new Error('YOUTUBE_API_KEY not configured');

          // Try to resolve as handle/URL, falling back to search
          let channelId;
          if (handle.startsWith('@') || /^[a-zA-Z0-9_.-]+$/.test(handle)) {
            channelId = await resolveChannelId('@' + cleanHandle, apiKey);
          } else {
            channelId = await resolveChannelId(handle, apiKey);
          }

          const stats = await getPublicChannelStats(channelId, apiKey);
          channelData = {
            subscriberCount: stats.subscriberCount,
            totalViewCount:  stats.totalViewCount,
            videoCount:      null, // not returned by getPublicChannelStats directly
            avgViewsLast15:  stats.avgViewsLast15,
          };
          channelName      = stats.title || cleanHandle;
          channelAvatarUrl = stats.thumbnail;
        } else {
          // Twitch
          const twitchUser = await resolveTwitchHandle(cleanHandle);
          if (!twitchUser) {
            return reply.code(404).type('text/html').send(
              '<html><body style="background:#05040A;color:#EDEDE8;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh">' +
              '<div style="text-align:center"><h1>Channel not found</h1><p style="color:#888D9B">Could not find Twitch channel: ' + cleanHandle + '</p>' +
              '<a href="/" style="color:#A4FFDB;margin-top:16px;display:inline-block">Score a different channel</a></div></body></html>'
            );
          }

          const twitchStats = await getTwitchPublicStats(twitchUser.id);
          channelData = {
            followerCount: twitchStats.followerCount,
          };
          channelName      = twitchUser.displayName || cleanHandle;
          channelAvatarUrl = twitchUser.avatarUrl;
        }

        // Run scoring engine
        const scoreResult = calculatePublicScore(platform, channelData);

        if (scoreResult.overallScore == null) {
          return reply.code(200).type('text/html').send(
            '<html><body style="background:#05040A;color:#EDEDE8;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh">' +
            '<div style="text-align:center"><h1>Insufficient data</h1><p style="color:#888D9B">Not enough public data to score this channel. Connect via OAuth for a full analysis.</p>' +
            '<a href="/signup" style="color:#A4FFDB;margin-top:16px;display:inline-block">Sign up to connect</a></div></body></html>'
          );
        }

        // Insert/update cache — 24h re-score window, but row persists for 365 days
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        cached = await prisma.publicScoreCard.upsert({
          where: {
            platform_handle: { platform, handle: cleanHandle.toLowerCase() },
          },
          update: {
            channelName,
            channelAvatarUrl,
            calculatedScore: scoreResult.overallScore,
            tierBand:        scoreResult.tier,
            topConstraint:   scoreResult.primaryConstraint,
            confidenceSummary: scoreResult.confidenceSummary,
            scoreBreakdown:   scoreResult.dimensions,
            whatThisMeans:    scoreResult.whatThisMeans,
            calculatedAt:    new Date(),
            expiresAt,
            viewCount:       1,
          },
          create: {
            platform,
            handle:           cleanHandle.toLowerCase(),
            channelName,
            channelAvatarUrl,
            calculatedScore:  scoreResult.overallScore,
            tierBand:         scoreResult.tier,
            topConstraint:    scoreResult.primaryConstraint,
            confidenceSummary: scoreResult.confidenceSummary,
            scoreBreakdown:   scoreResult.dimensions,
            whatThisMeans:    scoreResult.whatThisMeans,
            expiresAt,
            viewCount:        1,
          },
        });
      }

      // Log distribution signal (fire and forget)
      prisma.distributionSignal.create({
        data: {
          signalType:        'score_card_view',
          vector:            'V1',
          sourceSurface:     'web:score_card',
          referenceObjectId: cached.id,
          signalPayload: {
            handle:             cleanHandle,
            platform,
            preliminary_score:  cached.calculatedScore,
            top_constraint:     cached.topConstraint,
            referrer:           request.headers.referer || null,
            utm_source:         request.query.utm_source || null,
            utm_medium:         request.query.utm_medium || null,
            utm_campaign:       request.query.utm_campaign || null,
            utm_content:        request.query.utm_content || null,
          },
        },
      }).catch(function(err) { app.log.error({ err }, 'Failed to log score card signal'); });

      // Render HTML
      const html = renderScoreCardHTML({
        scoreCardId:      cached.id,
        platform,
        handle:           cleanHandle,
        channelName:      cached.channelName,
        channelAvatarUrl: cached.channelAvatarUrl,
        calculatedScore:  cached.calculatedScore,
        tierBand:         cached.tierBand,
        topConstraint:    cached.topConstraint,
        confidenceSummary: cached.confidenceSummary,
        scoreBreakdown:   cached.scoreBreakdown,
        whatThisMeans:    cached.whatThisMeans,
      });

      return reply.type('text/html').send(html);

    } catch (err) {
      app.log.error({ err }, 'Score card route error');
      return reply.code(500).type('text/html').send(
        '<html><body style="background:#05040A;color:#EDEDE8;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh">' +
        '<div style="text-align:center"><h1>Something went wrong</h1><p style="color:#888D9B">' + (err.message || 'Failed to generate score') + '</p>' +
        '<a href="/" style="color:#A4FFDB;margin-top:16px;display:inline-block">Try again</a></div></body></html>'
      );
    }
  });
}

module.exports = { scoreCardRoutes };
