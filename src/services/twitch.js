'use strict';

// ─── Twitch Helix service ─────────────────────────────────────────────────────
// Fetches channel metrics via the Twitch Helix API.
//
// Fields populated:
//   subscriberCount         → /helix/channels/followers  (total follower count)
//   twitchAffiliate         → /helix/users               (broadcaster_type === 'affiliate')
//   twitchPartner           → /helix/users               (broadcaster_type === 'partner')
//   streamHours30d          → /helix/videos (archives, last 30d, sum of durations)
//   uniqueBroadcastDays30d  → /helix/videos (archives, last 30d, unique calendar days)
//   avgConcurrentViewers30d → /helix/streams if currently live; null otherwise
//                             (Twitch does not expose historical concurrent data via
//                              the public API without partner-level analytics access)
// ─────────────────────────────────────────────────────────────────────────────

const BASE = 'https://api.twitch.tv/helix';

// ─── Token refresh ────────────────────────────────────────────────────────────

async function refreshTwitchToken(refreshToken) {
  const params = new URLSearchParams({
    client_id:     process.env.TWITCH_CLIENT_ID,
    client_secret: process.env.TWITCH_CLIENT_SECRET,
    grant_type:    'refresh_token',
    refresh_token: refreshToken,
  });

  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    params.toString(),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Twitch token refresh failed (${res.status}): ${body}`);
  }

  const data = await res.json();

  return {
    accessToken:  data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt:    data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : null,
  };
}

// ─── Helix fetch helper ───────────────────────────────────────────────────────

async function helixGet(path, accessToken, params = {}) {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v != null) url.searchParams.set(k, String(v));
  }

  const res = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Client-Id':     process.env.TWITCH_CLIENT_ID,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Twitch Helix ${path} failed (${res.status}): ${body}`);
  }

  return res.json();
}

// ─── Duration parser ──────────────────────────────────────────────────────────
// Twitch video durations are strings like "1h2m3s", "23m4s", "4s"

function parseDurationSeconds(str) {
  if (!str) return 0;
  const hours   = parseInt(str.match(/(\d+)h/)?.[1] ?? '0', 10);
  const minutes = parseInt(str.match(/(\d+)m/)?.[1] ?? '0', 10);
  const seconds = parseInt(str.match(/(\d+)s/)?.[1] ?? '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch all Twitch channel metrics for a connected profile.
 *
 * @param {string} accessToken  Decrypted access token
 * @param {string} broadcasterId  Twitch user ID (platform_user_id)
 * @returns {object} metrics
 */
async function getTwitchChannelMetrics(accessToken, broadcasterId) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [usersData, followersData, streamsData] = await Promise.all([
    helixGet('/users', accessToken, { id: broadcasterId }),
    helixGet('/channels/followers', accessToken, { broadcaster_id: broadcasterId }),
    helixGet('/streams', accessToken, { user_id: broadcasterId }),
  ]);

  const user = usersData.data?.[0];
  const broadcasterType = user?.broadcaster_type ?? '';

  const followerCount = followersData.total ?? null;

  // Current stream (if live)
  const liveStream = streamsData.data?.[0] ?? null;
  const currentViewers = liveStream ? (liveStream.viewer_count ?? null) : null;

  // Past broadcasts in last 30 days
  let streamHoursSeconds = 0;
  const broadcastDays = new Set();
  let cursor = null;
  let pagesFetched = 0;
  const MAX_PAGES = 5; // cap at 500 VODs to avoid runaway fetching

  do {
    const params = {
      user_id: broadcasterId,
      type:    'archive',
      first:   100,
    };
    if (cursor) params.after = cursor;

    const videosData = await helixGet('/videos', accessToken, params);
    const videos = videosData.data ?? [];

    let reachedOldVideo = false;
    for (const video of videos) {
      const createdAt = new Date(video.created_at);
      if (createdAt < thirtyDaysAgo) {
        reachedOldVideo = true;
        break;
      }
      streamHoursSeconds += parseDurationSeconds(video.duration);
      broadcastDays.add(createdAt.toISOString().slice(0, 10)); // YYYY-MM-DD
    }

    cursor = videosData.pagination?.cursor ?? null;
    pagesFetched++;

    if (reachedOldVideo || videos.length < 100) break;
  } while (cursor && pagesFetched < MAX_PAGES);

  const streamHours30d         = streamHoursSeconds > 0
    ? Math.round((streamHoursSeconds / 3600) * 100) / 100
    : null;
  const uniqueBroadcastDays30d = broadcastDays.size > 0 ? broadcastDays.size : null;

  // avgConcurrentViewers30d: use live viewer count if currently streaming.
  // Historical concurrent data is not available via the public Helix API.
  const avgConcurrentViewers30d = currentViewers;

  return {
    followerCount,
    twitchAffiliate:        broadcasterType === 'affiliate',
    twitchPartner:          broadcasterType === 'partner',
    streamHours30d,
    uniqueBroadcastDays30d,
    avgConcurrentViewers30d,
  };
}

module.exports = { refreshTwitchToken, getTwitchChannelMetrics };
