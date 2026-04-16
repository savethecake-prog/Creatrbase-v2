'use strict';

// Run: node scripts/previewDigestEmail.js
// Opens a preview of the digest email in your default browser.

const fs   = require('fs');
const path = require('path');

const APP_URL = 'https://creatrbase.com';

const TIER_LABELS = {
  pre_commercial: 'Pre-commercial',
  emerging:       'Emerging',
  viable:         'Viable',
  established:    'Established',
};

const DIMENSION_LABELS = {
  subscriber_momentum:     'Subscriber Momentum',
  engagement_quality:      'Engagement Quality',
  niche_commercial_value:  'Niche Commercial Value',
  audience_geo_alignment:  'Audience Geo Alignment',
  content_consistency:     'Content Consistency',
  content_brand_alignment: 'Content Brand Alignment',
};

const MILESTONE_LABELS = {
  giftable:                'Giftable',
  outreach_ready:          'Outreach Ready',
  paid_integration_viable: 'Paid Integration Viable',
  rate_negotiation_power:  'Rate Negotiation Power',
  portfolio_creator:       'Portfolio Creator',
};

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatChange(delta) {
  if (delta == null) return '';
  if (delta > 0)  return `+${delta}`;
  if (delta < 0)  return `${delta}`;
  return '→ no change';
}

function buildEmailHtml({ displayName, score, tier, scoreDelta, weakestDimension, recommendation, activeTaskCount, milestone }) {
  const tierLabel  = TIER_LABELS[tier] ?? tier ?? 'Unknown';
  const dimLabel   = DIMENSION_LABELS[weakestDimension] ?? weakestDimension ?? 'Unknown';
  const changeText = scoreDelta != null
    ? ` <span style="color:${scoreDelta >= 0 ? '#9EFFD8' : '#FFBFA3'}">(${formatChange(scoreDelta)} this week)</span>`
    : '';

  const milestoneHtml = milestone
    ? `<p style="margin:0 0 8px">Next milestone: <strong style="color:#C8AAFF">${milestone.label}</strong></p>`
    : '';

  const recHtml = recommendation
    ? `
      <tr>
        <td style="padding:24px 32px">
          <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#7B7A8E">THIS WEEK'S TASK</p>
          <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#F5F4FF">${escHtml(recommendation.title)}</p>
          <p style="margin:0 0 16px;font-size:14px;color:#9B99B0;line-height:1.6">${escHtml(recommendation.specificAction)}</p>
          <a href="${APP_URL}/tasks" style="display:inline-block;background:#9EFFD8;color:#05040A;font-size:13px;font-weight:700;padding:10px 22px;border-radius:999px;text-decoration:none">View task →</a>
        </td>
      </tr>`
    : `
      <tr>
        <td style="padding:24px 32px">
          <p style="margin:0 0 8px;font-size:14px;color:#9B99B0">No task recommendation yet — your next sync will generate one.</p>
          <a href="${APP_URL}/dashboard" style="display:inline-block;background:#9EFFD8;color:#05040A;font-size:13px;font-weight:700;padding:10px 22px;border-radius:999px;text-decoration:none">Go to dashboard →</a>
        </td>
      </tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Your Creatrbase Weekly Digest</title>
</head>
<body style="margin:0;padding:0;background:#05040A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding:32px 16px">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%">

          <!-- Header -->
          <tr>
            <td style="padding:0 0 24px">
              <p style="margin:0;font-size:22px;font-weight:900;color:#9EFFD8;letter-spacing:-0.02em">creatrbase</p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:0 0 24px">
              <p style="margin:0 0 4px;font-size:26px;font-weight:800;color:#F5F4FF">Your weekly digest</p>
              <p style="margin:0;font-size:15px;color:#9B99B0">Hey ${escHtml(displayName)} — here's where you stand this week.</p>
            </td>
          </tr>

          <!-- Score card -->
          <tr>
            <td style="padding:0 0 16px">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#111019;border:1px solid rgba(255,255,255,0.08);border-radius:16px">
                <tr>
                  <td style="padding:24px 32px">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#7B7A8E">COMMERCIAL VIABILITY SCORE</p>
                    <p style="margin:0 0 8px;font-size:42px;font-weight:900;color:#F5F4FF;line-height:1">${score ?? '–'}<span style="font-size:20px;color:#7B7A8E">/100</span>${changeText}</p>
                    <p style="margin:0 0 8px;display:inline-block;background:rgba(158,255,216,0.1);color:#9EFFD8;font-size:12px;font-weight:700;padding:4px 12px;border-radius:999px">${tierLabel}</p>
                    ${milestoneHtml}
                    <p style="margin:0;font-size:13px;color:#7B7A8E">Primary gap: <strong style="color:#FFBFA3">${dimLabel}</strong></p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Recommendation -->
          <tr>
            <td style="padding:0 0 16px">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#111019;border:1px solid rgba(255,255,255,0.08);border-radius:16px">
                ${recHtml}
              </table>
            </td>
          </tr>

          <!-- Active tasks -->
          ${activeTaskCount > 0 ? `
          <tr>
            <td style="padding:0 0 16px">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#111019;border:1px solid rgba(255,255,255,0.08);border-radius:16px">
                <tr>
                  <td style="padding:20px 32px">
                    <p style="margin:0;font-size:14px;color:#9B99B0">You have <strong style="color:#F5F4FF">${activeTaskCount} active task${activeTaskCount !== 1 ? 's' : ''}</strong> in progress. <a href="${APP_URL}/tasks" style="color:#9EFFD8;text-decoration:none">View tasks →</a></p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>` : ''}

          <!-- Footer -->
          <tr>
            <td style="padding:24px 0 0">
              <p style="margin:0;font-size:12px;color:#4A4860;text-align:center">You're receiving this because you signed up for Creatrbase. <a href="${APP_URL}/connections" style="color:#4A4860">Manage preferences</a></p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Sample data ────────────────────────────────────────────────────────────────

const html = buildEmailHtml({
  displayName:      'Anthony Nell',
  score:            43,
  tier:             'emerging',
  scoreDelta:       5,
  weakestDimension: 'content_consistency',
  recommendation: {
    title:          'Post 3 videos in the next 14 days',
    specificAction: 'Your upload frequency has dropped to 0.4 videos/week over the last 90 days. Brands in your niche expect at least 1 post per week before considering paid integrations. Set a 2-week sprint goal: publish 3 videos by the end of the fortnight, even if shorter or less produced than usual. Consistency matters more than quality at this stage.',
  },
  activeTaskCount:  2,
  milestone: {
    type:  'outreach_ready',
    label: MILESTONE_LABELS['outreach_ready'],
  },
});

const outPath = path.join(__dirname, '../digest-preview.html');
fs.writeFileSync(outPath, html, 'utf8');
console.log(`Preview written to: ${outPath}`);

// Open in default browser
const { execSync } = require('child_process');
try {
  execSync(`start "" "${outPath}"`);
} catch {
  console.log('Open the file manually in your browser.');
}
