'use strict';

// ─── OG image generator ──────────────────────────────────────────────────────
// GET /api/og?type=score&handle=...&platform=...&score=...&tier=...&channel=...
// Returns 1200×630 PNG. Cached 24h.
// ─────────────────────────────────────────────────────────────────────────────

const sharp = require('sharp');

const TIER_COLORS = {
  pre_commercial: '#8B8B9A',
  emerging:       '#FF9E7A',
  viable:         '#D1B9FF',
  established:    '#A4FFDB',
};

const TIER_LABELS = {
  pre_commercial: 'Pre-Commercial',
  emerging:       'Emerging',
  viable:         'Viable',
  established:    'Established',
};

function escSvg(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildScoreCardSVG({ handle, platform, score, tier, channel }) {
  const color = TIER_COLORS[tier] ?? '#A4FFDB';
  const label = TIER_LABELS[tier] ?? tier ?? '';
  const platformLabel = (platform === 'twitch' ? 'Twitch' : 'YouTube');
  const scoreNum = parseInt(score, 10) || 0;
  const channelName = channel || handle || '';

  // Arc for score ring (SVG arc path)
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const dashLen = (scoreNum / 100) * circumference;

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@700;900&amp;family=DM+Sans:wght@400;500;600;700&amp;display=swap');
    </style>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="#05040A"/>
  <!-- Subtle grid noise -->
  <rect width="1200" height="630" fill="url(#noise)" opacity="0.03"/>

  <!-- Brand mark -->
  <text x="60" y="60" font-family="Outfit, sans-serif" font-weight="900" font-size="28" fill="#A4FFDB">CREATR</text>
  <text x="210" y="60" font-family="Outfit, sans-serif" font-weight="900" font-size="28" fill="#FF9E7A">BASE</text>

  <!-- Platform badge -->
  <rect x="60" y="80" width="${platformLabel.length * 10 + 24}" height="28" rx="14" fill="rgba(255,255,255,0.08)"/>
  <text x="72" y="99" font-family="DM Sans, sans-serif" font-weight="600" font-size="12" fill="#888D9B" letter-spacing="0.1em">${escSvg(platformLabel.toUpperCase())}</text>

  <!-- Channel name -->
  <text x="60" y="170" font-family="Outfit, sans-serif" font-weight="700" font-size="42" fill="#EDEDE8">${escSvg(channelName)}</text>

  <!-- Score ring -->
  <g transform="translate(900, 200)">
    <circle cx="0" cy="0" r="${radius}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="12"/>
    <circle cx="0" cy="0" r="${radius}" fill="none" stroke="${color}" stroke-width="12"
            stroke-linecap="round" stroke-dasharray="${dashLen} ${circumference}"
            transform="rotate(-90)"/>
    <text x="0" y="10" font-family="Outfit, sans-serif" font-weight="900" font-size="64"
          fill="#EDEDE8" text-anchor="middle">${scoreNum}</text>
    <text x="0" y="40" font-family="DM Sans, sans-serif" font-weight="400" font-size="16"
          fill="#555A66" text-anchor="middle">/ 100</text>
  </g>

  <!-- Tier badge -->
  <rect x="60" y="210" width="${label.length * 12 + 32}" height="36" rx="18" fill="${color}20" stroke="${color}40" stroke-width="1"/>
  <text x="${60 + 16}" y="234" font-family="DM Sans, sans-serif" font-weight="700" font-size="15" fill="${color}">${escSvg(label)}</text>

  <!-- Commercial Viability Score label -->
  <text x="60" y="290" font-family="DM Sans, sans-serif" font-weight="600" font-size="13" fill="#555A66" letter-spacing="0.12em">COMMERCIAL VIABILITY SCORE</text>

  <!-- Confidence note -->
  <text x="60" y="330" font-family="DM Sans, sans-serif" font-weight="400" font-size="15" fill="#888D9B">Preliminary score from public data. Connect your channel for full analysis.</text>

  <!-- Footer -->
  <text x="60" y="590" font-family="DM Sans, sans-serif" font-weight="400" font-size="14" fill="#555A66">creatrbase.com/score/${escSvg(platform)}/${escSvg(handle)}</text>
</svg>`;
}

async function ogImageRoutes(app) {
  app.get('/api/og', async (request, reply) => {
    const { type, handle, platform, score, tier, channel } = request.query;

    if (type !== 'score' || !handle) {
      return reply.code(400).send({ error: 'Missing required params' });
    }

    const svg = buildScoreCardSVG({ handle, platform, score, tier, channel });
    const png = await sharp(Buffer.from(svg)).png().toBuffer();

    return reply
      .header('Content-Type', 'image/png')
      .header('Cache-Control', 'public, max-age=86400')
      .send(png);
  });
}

module.exports = { ogImageRoutes };
