'use strict';

/**
 * publicYoutube.js
 * Specialized service for public-only data fetching.
 * Uses the YOUTUBE_API_KEY from .env (no OAuth required).
 */

const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3';

/**
 * Resolves a YouTube channel URL or handle into a channel ID.
 * Supports: 
 * - https://www.youtube.com/channel/UC...
 * - https://www.youtube.com/c/Username
 * - https://www.youtube.com/@handle
 */
async function resolveChannelId(input, apiKey) {
  // 1. Direct ID extraction
  const idMatch = input.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})/);
  if (idMatch) return idMatch[1];

  // 2. Handle (@handle) or custom URL (@Username or c/Username)
  let query = '';
  if (input.includes('/@')) {
    query = input.split('/@')[1].split(/[/?#]/)[0];
  } else if (input.includes('/c/')) {
    query = input.split('/c/')[1].split(/[/?#]/)[0];
  } else if (!input.includes('youtube.com')) {
    // If they just typed @handle or a username
    query = input.startsWith('@') ? input.slice(1) : input;
  }

  if (!query) throw new Error('Could not identify channel handle/URL');

  // Search for the channel by handle/username
  const res = await fetch(`${YOUTUBE_API}/search?part=snippet&type=channel&q=${encodeURIComponent(query)}&key=${apiKey}`);
  const data = await res.json();

  if (!res.ok) throw new Error(`YouTube Search Error: ${data.error?.message || res.status}`);
  
  const channel = data.items?.[0];
  if (!channel) throw new Error('Channel not found');

  return channel.snippet.channelId;
}

async function getPublicChannelStats(channelId, apiKey) {
  // 1. Get channel stats + uploads playlist ID
  const chanRes = await fetch(`${YOUTUBE_API}/channels?part=statistics,contentDetails,snippet&id=${channelId}&key=${apiKey}`);
  const chanData = await chanRes.json();

  if (!chanRes.ok) throw new Error(`YouTube Channel API Error: ${chanData.error?.message || chanRes.status}`);

  const channel = chanData.items?.[0];
  if (!channel) throw new Error('Channel metadata not found');

  const stats = {
    channelId,
    title: channel.snippet.title,
    thumbnail: channel.snippet.thumbnails?.default?.url,
    subscriberCount: parseInt(channel.statistics.subscriberCount || '0', 10),
    totalViewCount: parseInt(channel.statistics.viewCount || '0', 10),
    uploadsPlaylistId: channel.contentDetails?.relatedPlaylists?.uploads
  };

  // 2. Get last 15 videos views
  if (stats.uploadsPlaylistId) {
    const listRes = await fetch(`${YOUTUBE_API}/playlistItems?part=contentDetails&playlistId=${stats.uploadsPlaylistId}&maxResults=15&key=${apiKey}`);
    const listData = await listRes.json();

    if (listRes.ok && listData.items?.length > 0) {
      const videoIds = listData.items.map(i => i.contentDetails.videoId).join(',');
      const vidRes = await fetch(`${YOUTUBE_API}/videos?part=statistics&id=${videoIds}&key=${apiKey}`);
      const vidData = await vidRes.json();

      if (vidRes.ok) {
        const views = vidData.items.map(v => parseInt(v.statistics.viewCount || '0', 10));
        const totalViews = views.reduce((a, b) => a + b, 0);
        stats.avgViewsLast15 = Math.round(totalViews / views.length);
      }
    }
  }

  return stats;
}

module.exports = {
  resolveChannelId,
  getPublicChannelStats
};
