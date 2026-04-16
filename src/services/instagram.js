'use strict';

// ─── Instagram Graph API service ──────────────────────────────────────────────
// Uses Instagram Business Login (v2) — requires a Professional Instagram
// account. Tokens are long-lived (60 days) and refreshable.
//
// Fields populated on sync:
//   subscriberCount         → followers_count
//   instagramMediaCount     → media_count
//   instagramReach30d       → reach (30d insight)
//   instagramProfileViews30d→ profile_views (30d insight)
//   instagramImpressions30d → impressions (30d insight)
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE  = 'https://graph.instagram.com';
const TOKEN_URL = 'https://api.instagram.com/oauth/access_token';

// ─── Exchange auth code for short-lived token, then upgrade to long-lived ────

async function exchangeCodeForToken(code, redirectUri) {
  const params = new URLSearchParams({
    client_id:     process.env.INSTAGRAM_CLIENT_ID,
    client_secret: process.env.INSTAGRAM_CLIENT_SECRET,
    grant_type:    'authorization_code',
    redirect_uri:  redirectUri,
    code,
  });

  const res = await fetch(TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    params.toString(),
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(`Instagram token exchange failed: ${data.error_message ?? data.error?.message ?? res.status}`);
  }

  // Upgrade to long-lived token (60 days)
  const longRes = await fetch(
    `${API_BASE}/access_token?grant_type=ig_exchange_token&client_secret=${process.env.INSTAGRAM_CLIENT_SECRET}&access_token=${data.access_token}`
  );
  const longData = await longRes.json();
  if (!longRes.ok || longData.error) {
    throw new Error(`Instagram long-lived token exchange failed: ${longData.error?.message ?? longRes.status}`);
  }

  return {
    accessToken:  longData.access_token,
    userId:       data.user_id,
    // Long-lived tokens expire in 60 days
    expiresAt:    longData.expires_in
      ? new Date(Date.now() + longData.expires_in * 1000)
      : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
  };
}

// ─── Refresh long-lived token ─────────────────────────────────────────────────
// Instagram long-lived tokens must be refreshed before they expire.
// Refreshing resets the 60-day window.

async function refreshInstagramToken(accessToken) {
  const res = await fetch(
    `${API_BASE}/refresh_access_token?grant_type=ig_refresh_token&access_token=${accessToken}`
  );
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(`Instagram token refresh failed: ${data.error?.message ?? res.status}`);
  }

  return {
    accessToken: data.access_token,
    expiresAt:   data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
  };
}

// ─── User profile ─────────────────────────────────────────────────────────────

async function getInstagramProfile(accessToken, userId) {
  const fields = 'id,username,name,followers_count,media_count,profile_picture_url,biography,website';
  const res = await fetch(
    `${API_BASE}/${userId}?fields=${fields}&access_token=${accessToken}`
  );
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(`Instagram profile fetch failed: ${data.error?.message ?? res.status}`);
  }

  return {
    userId:         data.id,
    username:       data.username ?? null,
    name:           data.name ?? null,
    followersCount: data.followers_count ?? null,
    mediaCount:     data.media_count ?? null,
    profilePicture: data.profile_picture_url ?? null,
    biography:      data.biography ?? null,
    website:        data.website ?? null,
  };
}

// ─── Insights (30d) ───────────────────────────────────────────────────────────
// Non-fatal — insights require app review. If not approved yet, returns nulls.

async function getInstagramInsights(accessToken, userId) {
  try {
    const since = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
    const until = Math.floor(Date.now() / 1000);

    const res = await fetch(
      `${API_BASE}/${userId}/insights?metric=reach,profile_views,impressions&period=day&since=${since}&until=${until}&access_token=${accessToken}`
    );
    const data = await res.json();

    if (!res.ok || data.error) return { reach30d: null, profileViews30d: null, impressions30d: null };

    const sum = (metric) => {
      const entry = data.data?.find(d => d.name === metric);
      return entry?.values?.reduce((acc, v) => acc + (v.value ?? 0), 0) ?? null;
    };

    return {
      reach30d:        sum('reach'),
      profileViews30d: sum('profile_views'),
      impressions30d:  sum('impressions'),
    };
  } catch {
    return { reach30d: null, profileViews30d: null, impressions30d: null };
  }
}

module.exports = { exchangeCodeForToken, refreshInstagramToken, getInstagramProfile, getInstagramInsights };
