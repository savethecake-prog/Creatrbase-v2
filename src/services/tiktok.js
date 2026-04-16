'use strict';

// ─── TikTok service ───────────────────────────────────────────────────────────
// TikTok Login Kit v2 — OAuth + data retrieval.
//
// Fields populated on sync:
//   subscriberCount     → follower_count
//   tiktokLikeCount     → likes_count  (total profile likes)
//   tiktokVideoCount    → video_count
//   tiktokFollowingCount→ following_count
//   tiktokVerified      → is_verified
// ─────────────────────────────────────────────────────────────────────────────

const TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
const API_BASE  = 'https://open.tiktokapis.com/v2';

// ─── Token refresh ────────────────────────────────────────────────────────────

async function refreshTikTokToken(refreshToken) {
  const params = new URLSearchParams({
    client_key:    process.env.TIKTOK_CLIENT_KEY,
    client_secret: process.env.TIKTOK_CLIENT_SECRET,
    grant_type:    'refresh_token',
    refresh_token: refreshToken,
  });

  const res = await fetch(TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    params.toString(),
  });

  const data = await res.json();

  if (!res.ok || data.error) {
    throw new Error(`TikTok token refresh failed: ${data.error_description ?? data.error ?? res.status}`);
  }

  return {
    accessToken:  data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt:    data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : null,
    openId: data.open_id,
  };
}

// ─── Exchange auth code for token ─────────────────────────────────────────────

async function exchangeCodeForToken(code, redirectUri) {
  const params = new URLSearchParams({
    client_key:    process.env.TIKTOK_CLIENT_KEY,
    client_secret: process.env.TIKTOK_CLIENT_SECRET,
    code,
    grant_type:    'authorization_code',
    redirect_uri:  redirectUri,
  });

  const res = await fetch(TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    params.toString(),
  });

  const data = await res.json();

  if (!res.ok || data.error) {
    throw new Error(`TikTok token exchange failed: ${data.error_description ?? data.error ?? res.status}`);
  }

  return {
    accessToken:  data.access_token,
    refreshToken: data.refresh_token,
    expiresAt:    data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : null,
    openId: data.open_id,
  };
}

// ─── User info + stats ────────────────────────────────────────────────────────

async function getTikTokUserInfo(accessToken, openId) {
  const fields = [
    'open_id', 'display_name', 'avatar_url',
    'profile_deep_link', 'bio_description', 'is_verified',
    'follower_count', 'following_count', 'likes_count', 'video_count',
  ].join(',');

  const res = await fetch(`${API_BASE}/user/info/?fields=${fields}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await res.json();

  if (!res.ok || data.error?.code !== 'ok') {
    const msg = data.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`TikTok user info failed: ${msg}`);
  }

  const u = data.data?.user;
  if (!u) throw new Error('TikTok user info: empty response');

  return {
    openId:          u.open_id ?? openId,
    displayName:     u.display_name ?? null,
    avatarUrl:       u.avatar_url ?? null,
    profileDeepLink: u.profile_deep_link ?? null,
    bio:             u.bio_description ?? null,
    isVerified:      u.is_verified ?? false,
    followerCount:   u.follower_count ?? null,
    followingCount:  u.following_count ?? null,
    likesCount:      u.likes_count ?? null,
    videoCount:      u.video_count ?? null,
  };
}

// ─── Video list ───────────────────────────────────────────────────────────────
// Returns up to maxVideos recent public videos with per-video metrics.

async function getTikTokVideoList(accessToken, { maxVideos = 20 } = {}) {
  const fields = 'id,title,create_time,cover_image_url,share_url,view_count,like_count,comment_count,share_count,duration';

  const res = await fetch(`${API_BASE}/video/list/?fields=${fields}`, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ max_count: Math.min(maxVideos, 20) }),
  });

  const data = await res.json();

  if (!res.ok || data.error?.code !== 'ok') {
    const msg = data.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`TikTok video list failed: ${msg}`);
  }

  return (data.data?.videos ?? []).map(v => ({
    videoId:      v.id,
    title:        v.title ?? null,
    createdAt:    v.create_time ? new Date(v.create_time * 1000) : null,
    viewCount:    v.view_count ?? null,
    likeCount:    v.like_count ?? null,
    commentCount: v.comment_count ?? null,
    shareCount:   v.share_count ?? null,
    duration:     v.duration ?? null,
  }));
}

module.exports = { refreshTikTokToken, exchangeCodeForToken, getTikTokUserInfo, getTikTokVideoList };
