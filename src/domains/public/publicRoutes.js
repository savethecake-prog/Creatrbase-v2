'use strict';

const { resolveChannelId, getPublicChannelStats } = require('../../services/publicYoutube');

async function publicRoutes(app) {
  // GET /api/public/youtube-check?url=...
  app.get('/api/public/youtube-check', async (request, reply) => {
    const { url } = request.query;

    if (!url) {
      return reply.code(400).send({ error: 'URL is required' });
    }

    try {
      const apiKey = process.env.YOUTUBE_API_KEY;
      if (!apiKey) {
        throw new Error('Server misconfiguration: YOUTUBE_API_KEY missing');
      }

      const channelId = await resolveChannelId(url, apiKey);
      const stats = await getPublicChannelStats(channelId, apiKey);

      // --- Brand Readiness Logic (The Oracle Lite) ---
      // Milestone Tiers (Simplified for the Hook)
      const tiers = [
        { name: 'Emerging', subs: 500, views: 100 },
        { name: 'Giftable', subs: 2000, views: 500 },
        { name: 'Paid Viable', subs: 10000, views: 2500 },
        { name: 'Agency Ready', subs: 50000, views: 10000 }
      ];

      // Find the tier they are currently "working towards"
      let targetTier = tiers.find(t => stats.subscriberCount < t.subs || stats.avgViewsLast15 < t.views) || tiers[tiers.length - 1];
      
      // Calculate progress percentage to next tier (blend of subs and views)
      const subProgress = Math.min(1, stats.subscriberCount / targetTier.subs);
      const viewProgress = Math.min(1, (stats.avgViewsLast15 || 0) / targetTier.views);
      const overallScore = Math.round(((subProgress + viewProgress) / 2) * 100);

      // Generate the "Hook" insight
      let insight = '';
      if (stats.subscriberCount < targetTier.subs) {
        const diff = targetTier.subs - stats.subscriberCount;
        insight = `You're just ${diff.toLocaleString()} subscribers away from the '${targetTier.name}' milestone.`;
      } else {
        const diff = targetTier.views - (stats.avgViewsLast15 || 0);
        insight = `Your consistency is key. Add ~${diff.toLocaleString()} average views per video to unlock '${targetTier.name}' opportunities.`;
      }

      return {
        success: true,
        channel: {
          title: stats.title,
          thumbnail: stats.thumbnail,
          subscribers: stats.subscriberCount,
          avgViews: stats.avgViewsLast15
        },
        score: overallScore,
        targetTier: targetTier.name,
        insight
      };

    } catch (err) {
      request.log.error(err);
      return reply.code(err.statusCode || 500).send({ 
        success: false, 
        error: err.message || 'Failed to analyze channel' 
      });
    }
  });
}

module.exports = publicRoutes;
