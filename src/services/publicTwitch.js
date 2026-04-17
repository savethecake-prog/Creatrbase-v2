'use strict';

// ─── Public Twitch data service ───────────────────────────────────────────────
// Uses app access tokens (client credentials) — no user OAuth required.
// ─────────────────────────────────────────────────────────────────────────────

const BASE = 'https://api.twitch.tv/helix';

let _appToken = null;
let _appTokenExpiresAt = 0;

async function getAppAccessToken() {
  if (_appToken && Date.now() < _appTokenExpiresAt - 60_000) return _appToken;

  const params = new URLSearchParams({
    client_id:     process.env.TWITCH_CLIENT_ID,
    client_secret: process.env.TWITCH_CLIENT_SECRET,
    grant_type:    'client_credentials',
  });

  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    params.toString(),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Twitch app token failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  _appToken = data.access_token;
  _appTokenExpiresAt = Date.now() + (data.expires_in * 1000);
  return _appToken;
}

async function helixGet(path, params = {}) {
  const token = await getAppAccessToken();
  const url   = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v != null) url.searchParams.set(k, String(v));
  }

  const res = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Client-Id':     process.env.TWITCH_CLIENT_ID,
    },
  });

  if (res.status === 401) {
    _appToken = null;
    _appTokenExpiresAt = 0;
    throw new Error('Twitch app token expired — retry');
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Twitch Helix ${path} (${res.status}): ${body}`);
  }

  return res.json();
}

async function resolveHandle(handle) {
  const clean = handle.replace(/^@/, '').toLowerCase();
  const data  = await helixGet('/users', { login: clean });
  const user  = data.data?.[0];
  if (!user) return null;

  return {
    id:           user.id,
    login:        user.login,
    displayName:  user.display_name,
    avatarUrl:    user.profile_image_url,
    broadcasterType: user.broadcaster_type,
  };
}

async function getPublicStats(userId) {
  const [followData] = await Promise.all([
    helixGet('/channels/followers', { broadcaster_id: userId, first: 1 }),
  ]);

  return {
    followerCount:   followData.total ?? null,
  };
}

module.exports = { resolveHandle, getPublicStats };
