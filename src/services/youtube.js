'use strict';

// ─── YouTube API service ──────────────────────────────────────────────────────
// Wraps YouTube Data API v3 and YouTube Analytics API v2.
// All functions take a decrypted access token — decryption happens in the worker.
//
// Token refresh is handled here. The caller is responsible for re-encrypting
// and persisting the new token to the DB.
// ─────────────────────────────────────────────────────────────────────────────

const YOUTUBE_API      = 'https://www.googleapis.com/youtube/v3';
const YT_ANALYTICS_API = 'https://youtubeanalytics.googleapis.com/v2';

// ─── Token refresh ────────────────────────────────────────────────────────────

async function refreshAccessToken(refreshToken) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      grant_type:    'refresh_token',
      client_id:     process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    const err = new Error(`Token refresh failed: ${data.error_description ?? data.error ?? 'unknown'}`);
    err.code = data.error;
    throw err;
  }

  return {
    accessToken: data.access_token,
    expiresAt:   new Date(Date.now() + data.expires_in * 1000),
  };
}

// ─── Channel statistics (YouTube Data API v3) ────────────────────────────────

async function getChannelStats(accessToken) {
  const res = await fetch(
    `${YOUTUBE_API}/channels?part=snippet,statistics&mine=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error(`YouTube Data API error: ${data.error?.message ?? res.status}`);
  }

  const channel = data.items?.[0];
  if (!channel) throw new Error('No YouTube channel found for this access token');

  const stats = channel.statistics;

  return {
    channelId:       channel.id,
    subscriberCount: stats.hiddenSubscriberCount
                       ? null  // channel has hidden subscriber count
                       : parseInt(stats.subscriberCount ?? '0', 10),
    totalViewCount:  parseInt(stats.viewCount ?? '0', 10),
    videoCount:      parseInt(stats.videoCount ?? '0', 10),
  };
}

// ─── Watch hours — last 12 months (YouTube Analytics API v2) ─────────────────
// Returns watch hours as a float, or null if no data is available.
// New channels or channels with restricted analytics may return null.

async function getWatchHours12Months(accessToken) {
  const endDate   = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const url = new URL(`${YT_ANALYTICS_API}/reports`);
  url.searchParams.set('ids',       'channel==MINE');
  url.searchParams.set('startDate', startDate);
  url.searchParams.set('endDate',   endDate);
  url.searchParams.set('metrics',   'estimatedMinutesWatched');
  url.searchParams.set('alt',       'json');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = await res.json();

  if (!res.ok) {
    // 403 = Analytics not available for this channel (e.g. no watch history yet)
    // Treat as non-fatal — return null so the sync still completes
    if (res.status === 403) return null;
    throw new Error(`YouTube Analytics API error: ${data.error?.message ?? res.status}`);
  }

  const minutes = data.rows?.[0]?.[0] ?? null;
  return minutes !== null ? Number((minutes / 60).toFixed(2)) : null;
}

module.exports = { refreshAccessToken, getChannelStats, getWatchHours12Months };
