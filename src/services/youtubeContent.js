'use strict';

// ─── YouTube content signal fetcher ──────────────────────────────────────────
// Fetches video signals needed for the niche classification prompt.
//
// Flow:
//   1. channels.list  — get uploads playlist ID + channel description/keywords
//   2. playlistItems  — get up to MAX_VIDEOS video IDs from uploads playlist
//   3. videos.list    — batch-fetch titles, descriptions, tags for those IDs
//
// Returns structured data ready to inject into the prompt template.
// ─────────────────────────────────────────────────────────────────────────────

const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3';
const MAX_VIDEOS  = 20;   // cap per classification run
const SAMPLE_DAYS = 90;   // label for the prompt; we take the most recent N videos

async function ytGet(path, params, accessToken) {
  const url = new URL(`${YOUTUBE_API}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res  = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(`YouTube Data API error (${path}): ${data.error?.message ?? res.status}`);
  }
  return data;
}

// ─── Main export ──────────────────────────────────────────────────────────────

async function getVideoSignals(accessToken) {
  // 1. Channel info — uploads playlist + description + keywords
  const channelData = await ytGet('channels', {
    part: 'snippet,contentDetails,brandingSettings',
    mine: 'true',
  }, accessToken);

  const channel = channelData.items?.[0];
  if (!channel) throw new Error('No YouTube channel found');

  const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads;
  const channelDescription = channel.snippet?.description?.trim() || '';
  const channelKeywords    = channel.brandingSettings?.channel?.keywords?.trim() || '';

  if (!uploadsPlaylistId) {
    throw new Error('YouTube channel has no uploads playlist');
  }

  // 2. Playlist items — most recent video IDs
  const playlistData = await ytGet('playlistItems', {
    part:       'contentDetails',
    playlistId: uploadsPlaylistId,
    maxResults: MAX_VIDEOS,
  }, accessToken);

  const videoIds = (playlistData.items ?? []).map(i => i.contentDetails.videoId);

  if (videoIds.length === 0) {
    return {
      videoSignals:       [],
      channelDescription,
      channelKeywords,
      videoCount:         0,
      sampleDays:         SAMPLE_DAYS,
      affiliateDomains:   [],
      promoCodes:         [],
    };
  }

  // 3. Video details — titles, descriptions, tags
  const videosData = await ytGet('videos', {
    part: 'snippet',
    id:   videoIds.join(','),
  }, accessToken);

  const videos = videosData.items ?? [];

  // Extract affiliate-pattern links + promo codes across all descriptions
  const allDescriptions = videos.map(v => v.snippet?.description ?? '').join('\n');
  const affiliateDomains = extractAffiliateDomains(allDescriptions);
  const promoCodes       = extractPromoCodes(allDescriptions);

  const videoSignals = videos.map(v => ({
    title:       v.snippet?.title ?? '',
    description: truncate(v.snippet?.description ?? '', 500),
    tags:        (v.snippet?.tags ?? []).slice(0, 15),
    publishedAt: v.snippet?.publishedAt ?? null,
  }));

  return {
    videoSignals,
    channelDescription,
    channelKeywords,
    videoCount: videos.length,
    sampleDays: SAMPLE_DAYS,
    affiliateDomains,
    promoCodes,
  };
}

// ─── Signal extractors ────────────────────────────────────────────────────────

// Look for URLs that carry affiliate/tracking parameters or known affiliate
// path patterns. Conservative — only flag when there's a clear signal.
function extractAffiliateDomains(text) {
  const domainSet = new Set();

  // URLs with common affiliate/tracking params
  const urlPattern = /https?:\/\/([a-z0-9.-]+\.[a-z]{2,})[^\s]*/gi;
  const affiliateParams = /[?&](ref|aff|affiliate|partner|utm_source|tag|invitedby|via|code)=/i;
  // Known affiliate link shorteners / redirect domains
  const knownAffiliate = /\b(amzn\.to|geni\.us|shrsl\.com|bit\.ly|go\.skimresources|prf\.hn|rstyle\.me)\b/i;

  let match;
  while ((match = urlPattern.exec(text)) !== null) {
    const fullUrl = match[0];
    const domain  = match[1];
    if (affiliateParams.test(fullUrl) || knownAffiliate.test(domain)) {
      domainSet.add(domain.replace(/^www\./, ''));
    }
  }

  return [...domainSet];
}

// Extract promo code strings — "USE CODE X", "PROMO: X", "DISCOUNT: X", etc.
function extractPromoCodes(text) {
  const codeSet = new Set();
  const patterns = [
    /use\s+(?:code\s+|promo\s+)?([A-Z0-9]{4,20})\b/gi,
    /promo(?:\s+code)?[:\s]+([A-Z0-9]{4,20})\b/gi,
    /discount(?:\s+code)?[:\s]+([A-Z0-9]{4,20})\b/gi,
    /coupon(?:\s+code)?[:\s]+([A-Z0-9]{4,20})\b/gi,
  ];

  for (const pattern of patterns) {
    let m;
    while ((m = pattern.exec(text)) !== null) {
      codeSet.add(m[1].toUpperCase());
    }
  }

  return [...codeSet];
}

function truncate(str, maxLen) {
  return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
}

module.exports = { getVideoSignals };
