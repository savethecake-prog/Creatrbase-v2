'use strict';

// ── OG image generator ──────────────────────────────────────────────────────
// GET /api/og?type=score&handle=...&platform=...&score=...&tier=...&channel=...
// GET /api/score/:id/share.png  (pulls from PublicScoreCard)
// Returns 1200x630 PNG. SVG + Sharp pipeline.
// ─────────────────────────────────────────────────────────────────────────────

const sharp = require('sharp');
const { getPrisma } = require('../../lib/prisma');
const { getDimensionLevel } = require('../../lib/dimensionLevels');

const TIER_COLORS = {
  pre_commercial: '#C8AAFF',
  emerging:       '#FFBFA3',
  viable:         '#9EFFD8',
  established:    '#9EFFD8',
};

const TIER_LABELS = {
  pre_commercial: 'Pre-Commercial',
  emerging:       'Emerging',
  viable:         'Viable',
  established:    'Established',
};

const DIMENSION_ORDER = [
  'subscriber_momentum',
  'engagement_quality',
  'niche_commercial_value',
  'audience_geo_alignment',
  'content_consistency',
  'content_brand_alignment',
];

const DIMENSION_LABELS = {
  subscriber_momentum:     'Subscriber Momentum',
  engagement_quality:      'Engagement Quality',
  niche_commercial_value:  'Niche Commercial Value',
  audience_geo_alignment:  'Geo Alignment',
  content_consistency:     'Consistency',
  content_brand_alignment: 'Brand Alignment',
};

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncate(str, max) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max) + '...' : str;
}

function buildSharePNG({ channelName, handle, platform, avatarInitial, subscriberCount, score, tier, dimensions, publicUrl }) {
  const tierColor = TIER_COLORS[tier] ?? '#9EFFD8';
  const tierLabel = TIER_LABELS[tier] ?? tier ?? '';
  const scoreNum = score ?? 0;
  const platformLabel = platform === 'twitch' ? 'Twitch' : 'YouTube';
  const displayName = truncate(channelName || handle || '', 20);
  const subLabel = subscriberCount ? (subscriberCount >= 1000 ? Math.round(subscriberCount / 1000) + 'k' : subscriberCount) + ' subs' : '';

  // Build dimension bars SVG
  let dimBars = '';
  let dimY = 120;
  for (const key of DIMENSION_ORDER) {
    const dim = dimensions?.[key];
    const dimScore = dim?.score ?? null;
    const label = DIMENSION_LABELS[key] ?? key;
    const level = getDimensionLevel(dimScore);
    const barWidth = dimScore != null ? Math.round(dimScore * 2) : 0; // 200px max

    dimBars += `
      <text x="920" y="${dimY}" font-family="Outfit, sans-serif" font-weight="600" font-size="14" fill="#FAF6EF" opacity="0.7">${esc(label)}</text>
      <rect x="920" y="${dimY + 6}" width="200" height="8" rx="4" fill="rgba(255,255,255,0.08)"/>
      <rect x="920" y="${dimY + 6}" width="${barWidth}" height="8" rx="4" fill="${level.color}"/>
      <text x="${920 + 210}" y="${dimY + 14}" font-family="Outfit, sans-serif" font-weight="700" font-size="13" fill="#FAF6EF" opacity="0.8">${dimScore != null ? dimScore : '-'}</text>
    `;
    dimY += 42;
  }

  // Avatar circle with initial
  const initial = (channelName || handle || 'C').charAt(0).toUpperCase();

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&amp;family=DM+Sans:wght@400;500;600;700&amp;family=JetBrains+Mono:wght@400;500;600&amp;display=swap');
    </style>
  </defs>

  <!-- Navy background -->
  <rect width="1200" height="630" fill="#1B1040"/>

  <!-- Subtle halftone pattern top-right -->
  <circle cx="1100" cy="80" r="4" fill="#FAF6EF" opacity="0.04"/>
  <circle cx="1120" cy="60" r="3" fill="#FAF6EF" opacity="0.03"/>
  <circle cx="1140" cy="90" r="5" fill="#FAF6EF" opacity="0.03"/>
  <circle cx="1080" cy="50" r="3" fill="#FAF6EF" opacity="0.04"/>

  <!-- LEFT COLUMN: Channel identity -->
  <!-- Avatar -->
  <circle cx="108" cy="148" r="48" fill="#9EFFD8"/>
  <text x="108" y="162" font-family="Outfit, sans-serif" font-weight="800" font-size="36" fill="#1B1040" text-anchor="middle">${esc(initial)}</text>

  <!-- Display name -->
  <text x="60" y="240" font-family="Outfit, sans-serif" font-weight="800" font-size="32" fill="#FAF6EF">${esc(displayName)}</text>

  <!-- Handle + platform -->
  <text x="60" y="268" font-family="JetBrains Mono, monospace" font-weight="500" font-size="14" fill="#FAF6EF" opacity="0.5">@${esc(handle)} · ${esc(platformLabel)}</text>

  <!-- Subscriber count -->
  <text x="60" y="300" font-family="DM Sans, sans-serif" font-weight="600" font-size="16" fill="#FAF6EF" opacity="0.6">${esc(subLabel)}</text>

  <!-- Accent strip -->
  <rect x="60" y="320" width="48" height="3" rx="1.5" fill="#9EFFD8"/>

  <!-- CENTRE COLUMN: Score -->
  <text x="580" y="260" font-family="Outfit, sans-serif" font-weight="800" font-size="180" fill="#9EFFD8" text-anchor="middle">${scoreNum}</text>
  <text x="580" y="310" font-family="Outfit, sans-serif" font-weight="600" font-size="48" fill="#FAF6EF" opacity="0.3" text-anchor="middle">/ 100</text>

  <!-- Tier badge -->
  <rect x="${580 - tierLabel.length * 6 - 16}" y="340" width="${tierLabel.length * 12 + 32}" height="32" rx="16" fill="${tierColor}25" stroke="${tierColor}50" stroke-width="1"/>
  <text x="580" y="362" font-family="JetBrains Mono, monospace" font-weight="700" font-size="14" fill="${tierColor}" text-anchor="middle" letter-spacing="0.08em">${esc(tierLabel.toUpperCase())}</text>

  <!-- RIGHT COLUMN: Dimension bars -->
  ${dimBars}

  <!-- BOTTOM BAR: Cream -->
  <rect x="0" y="570" width="1200" height="60" fill="#FAF6EF"/>

  <!-- Wordmark text on bottom bar -->
  <text x="60" y="606" font-family="Outfit, sans-serif" font-weight="800" font-size="20" fill="#1B1040">CREATR</text>
  <text x="165" y="606" font-family="Outfit, sans-serif" font-weight="800" font-size="20" fill="#9EFFD8">BASE</text>

  <!-- Public URL on bottom bar -->
  <text x="1140" y="606" font-family="JetBrains Mono, monospace" font-weight="500" font-size="13" fill="#1B1040" text-anchor="end" opacity="0.6">${esc(publicUrl)}</text>
</svg>`;
}

async function ogImageRoutes(app) {
  // Legacy endpoint (query-param based)
  app.get('/api/og', async (request, reply) => {
    const { type, handle, platform, score, tier, channel } = request.query;

    if (type !== 'score' || !handle) {
      return reply.code(400).send({ error: 'Missing required params' });
    }

    const svg = buildSharePNG({
      channelName: channel,
      handle,
      platform,
      score: parseInt(score, 10) || 0,
      tier,
      dimensions: {},
      publicUrl: `creatrbase.com/score/${platform}/${handle}`,
    });
    const png = await sharp(Buffer.from(svg)).png().toBuffer();

    return reply
      .header('Content-Type', 'image/png')
      .header('Cache-Control', 'public, max-age=86400')
      .send(png);
  });

  // New endpoint: score card share PNG by ID
  app.get('/api/score/:id/share.png', async (request, reply) => {
    const prisma = getPrisma();
    const card = await prisma.publicScoreCard.findUnique({
      where: { id: request.params.id },
    });

    if (!card || !card.calculatedScore) {
      return reply.code(404).send({ error: 'Score not found or not yet complete' });
    }

    const svg = buildSharePNG({
      channelName: card.channelName,
      handle: card.handle,
      platform: card.platform,
      subscriberCount: null, // not stored on public score card
      score: card.calculatedScore,
      tier: card.tierBand,
      dimensions: card.scoreBreakdown || {},
      publicUrl: `creatrbase.com/score/${card.platform}/${card.handle}`,
    });
    const png = await sharp(Buffer.from(svg)).png().toBuffer();

    return reply
      .header('Content-Type', 'image/png')
      .header('Cache-Control', 'public, max-age=3600')
      .send(png);
  });
}

module.exports = { ogImageRoutes };
