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

// EU country codes for geo mapping
const EU_COUNTRIES = new Set([
  'DE','FR','IT','ES','NL','BE','AT','SE','NO','DK','FI','IE','PT','PL',
  'CZ','HU','RO','SK','BG','HR','SI','EE','LV','LT','CY','LU','MT',
]);

function mapCountryToGeo(code) {
  if (code === 'GB') return 'UK';
  if (code === 'US') return 'US';
  if (EU_COUNTRIES.has(code)) return 'EU';
  return 'global';
}

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
    `${YOUTUBE_API}/channels?part=snippet,statistics,contentDetails&mine=true`,
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
    channelId:           channel.id,
    uploadsPlaylistId:   channel.contentDetails?.relatedPlaylists?.uploads ?? null,
    subscriberCount:     stats.hiddenSubscriberCount
                           ? null  // channel has hidden subscriber count
                           : parseInt(stats.subscriberCount ?? '0', 10),
    totalViewCount:      parseInt(stats.viewCount ?? '0', 10),
    videoCount:          parseInt(stats.videoCount ?? '0', 10),
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

// ─── Extended analytics (engagement, geo, uploads cadence) ───────────────────
// Fetches four additional signals in parallel. All are non-fatal — if the
// Analytics API returns 403 (new channels, restricted access), nulls are
// returned and the sync still succeeds.
//
// Returns:
//   engagementRate30d     — (likes + comments) / views as decimal (e.g. 0.034)
//   avgViewsPerVideo30d   — total 30d views / videoCount
//   publicUploads90d      — count of videos published in last 90 days
//   primaryAudienceGeo    — 'UK' | 'US' | 'EU' | 'global'

async function getExtendedAnalytics(accessToken, { uploadsPlaylistId, videoCount }) {
  const now      = new Date();
  const endDate  = now.toISOString().split('T')[0];
  const start30  = new Date(now - 30 * 86_400_000).toISOString().split('T')[0];
  const start90  = new Date(now - 90 * 86_400_000).toISOString().split('T')[0];

  // Run all three requests in parallel; swallow errors individually
  const [engagement30, geo90, uploads90] = await Promise.allSettled([
    analyticsGet({ startDate: start30, endDate, metrics: 'views,likes,comments' }, accessToken),
    analyticsGet({
      startDate: start90, endDate,
      dimensions: 'country', metrics: 'views', sort: '-views', maxResults: '5',
    }, accessToken),
    uploadsPlaylistId ? countUploads(uploadsPlaylistId, start90, accessToken) : Promise.resolve(null),
  ]);

  // Engagement rate + avg views per video (30d)
  let engagementRate30d   = null;
  let avgViewsPerVideo30d = null;

  if (engagement30.status === 'fulfilled') {
    const row = engagement30.value.rows?.[0];
    if (row) {
      const [views, likes, comments] = row.map(Number);
      if (views > 0) {
        engagementRate30d = parseFloat(((likes + comments) / views).toFixed(6));
      }
      if (videoCount && videoCount > 0) {
        avgViewsPerVideo30d = parseFloat((views / videoCount).toFixed(2));
      }
    }
  }

  // Primary audience geography — top country by 90d views
  let primaryAudienceGeo = null;

  if (geo90.status === 'fulfilled') {
    const topRow = geo90.value.rows?.[0];
    if (topRow) {
      primaryAudienceGeo = mapCountryToGeo(topRow[0]);
    }
  }

  // Uploads in last 90 days
  const publicUploads90d = uploads90.status === 'fulfilled' ? uploads90.value : null;

  return { engagementRate30d, avgViewsPerVideo30d, publicUploads90d, primaryAudienceGeo };
}

// ─── Analytics API helper ─────────────────────────────────────────────────────

async function analyticsGet(params, accessToken) {
  const url = new URL(`${YT_ANALYTICS_API}/reports`);
  url.searchParams.set('ids', 'channel==MINE');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('alt', 'json');

  const res  = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();

  if (!res.ok) {
    // 403 = Analytics unavailable for this channel (new / restricted)
    if (res.status === 403) return { rows: null };
    throw new Error(`YouTube Analytics API error: ${data.error?.message ?? res.status}`);
  }
  return data;
}

// ─── Uploads count helper ─────────────────────────────────────────────────────
// Pages through the uploads playlist (newest first) and counts videos published
// after cutoffDate. Stops early when it hits a video older than the cutoff, or
// after 3 pages (150 videos) — sufficient for all but extremely high-volume channels.

async function countUploads(playlistId, cutoffDate, accessToken) {
  const cutoff = new Date(cutoffDate);
  let count     = 0;
  let pageToken = null;

  for (let page = 0; page < 3; page++) {
    const url = new URL(`${YOUTUBE_API}/playlistItems`);
    url.searchParams.set('part',       'contentDetails');
    url.searchParams.set('playlistId', playlistId);
    url.searchParams.set('maxResults', '50');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const res  = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();

    if (!res.ok) return count; // non-fatal

    let hitOld = false;
    for (const item of (data.items ?? [])) {
      const published = new Date(item.contentDetails?.videoPublishedAt ?? 0);
      if (published < cutoff) { hitOld = true; break; }
      count++;
    }

    if (hitOld || !data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }

  return count;
}

module.exports = {
  refreshAccessToken,
  getChannelStats,
  getWatchHours12Months,
  getExtendedAnalytics,
};
