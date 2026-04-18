'use strict';

// Server-rendered score card HTML template
// Returns a complete HTML document. No React — fully self-contained.

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

const { getDimensionLevel } = require('../lib/dimensionLevels');

const DIMENSION_LABELS = {
  subscriber_momentum:     'Subscriber Momentum',
  engagement_quality:      'Engagement Quality',
  niche_commercial_value:  'Niche Commercial Value',
  audience_geo_alignment:  'Audience Geo Alignment',
  content_consistency:     'Content Consistency',
  content_brand_alignment: 'Content Brand Alignment',
};

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderScoreCardHTML({
  scoreCardId,
  platform,
  handle,
  channelName,
  channelAvatarUrl,
  calculatedScore,
  tierBand,
  topConstraint,
  confidenceSummary,
  scoreBreakdown,
  whatThisMeans,
  claimedAt,
}) {
  const tierColor = TIER_COLORS[tierBand] ?? '#A4FFDB';
  const tierLabel = TIER_LABELS[tierBand] ?? tierBand ?? 'Unknown';
  const constraintLabel = DIMENSION_LABELS[topConstraint] ?? topConstraint ?? '';
  const scoreNum  = calculatedScore ?? 0;
  const platformLabel = platform === 'twitch' ? 'Twitch' : 'YouTube';
  const platformIcon  = platform === 'twitch' ? '&#x1F7E3;' : '&#x1F534;';
  const displayName   = channelName || handle;

  const pageUrl = 'https://creatrbase.com/score/' + esc(platform) + '/' + esc(handle);
  const ogImageUrl = 'https://creatrbase.com/api/score/' + scoreCardId + '/share.png';

  const utmBase = 'utm_source=score_card&utm_medium=share&utm_campaign=v1_public&utm_content=' + scoreCardId;
  const shareText = encodeURIComponent('My channel scored ' + scoreNum + '/100 on Creatrbase (' + tierLabel + ' tier). See yours:');
  const shareUrl  = encodeURIComponent(pageUrl + '?' + utmBase);

  const xShareUrl = 'https://x.com/intent/tweet?text=' + shareText + '&url=' + shareUrl;
  const redditShareUrl = 'https://reddit.com/submit?url=' + shareUrl + '&title=' + encodeURIComponent(displayName + ' - Commercial Viability Score: ' + scoreNum + '/100');

  // Build dimension bars HTML
  let dimensionBarsHtml = '';
  if (scoreBreakdown && typeof scoreBreakdown === 'object') {
    for (const [key, dim] of Object.entries(scoreBreakdown)) {
      const dimScore = dim?.score ?? null;
      const dimConf  = dim?.confidence ?? 'insufficient_data';
      const label    = DIMENSION_LABELS[key] ?? key;
      const barWidth = dimScore != null ? dimScore : 0;
      const dimLevel = getDimensionLevel(dimScore);
      const barOpacity = dimConf === 'insufficient_data' ? '0.3' : '1';
      const confLabel  = dimConf === 'insufficient_data' ? 'No data' : dimConf;

      dimensionBarsHtml += '<div style="margin-bottom:12px">' +
        '<div style="display:flex;justify-content:space-between;margin-bottom:4px">' +
        '<span style="font-size:13px;color:#888D9B">' + esc(label) + '</span>' +
        '<span style="font-size:13px;color:' + (dimScore != null ? '#EDEDE8' : '#555A66') + '">' + (dimScore != null ? dimScore : '\u2014') + ' <span style="font-size:11px;color:' + dimLevel.color + '">' + esc(dimLevel.label) + '</span></span>' +
        '</div>' +
        '<div style="height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden">' +
        '<div style="height:100%;width:' + barWidth + '%;background:' + dimLevel.color + ';opacity:' + barOpacity + ';border-radius:3px"></div>' +
        '</div></div>';
    }
  }

  // Confidence count
  const confValues = Object.values(confidenceSummary || {});
  const lowCount   = confValues.filter(function(c) { return c === 'low' || c === 'insufficient_data'; }).length;
  const confNote   = lowCount >= 4
    ? 'Low confidence \u2014 based on public data only. Connect your channel for full analysis.'
    : lowCount >= 2
    ? 'Medium confidence \u2014 some dimensions estimated from public data.'
    : 'Reasonable confidence from available data.';

  const copyLinkUrl = pageUrl + '?' + utmBase;

  return '<!DOCTYPE html>\n' +
'<html lang="en">\n' +
'<head>\n' +
'  <meta charset="UTF-8">\n' +
'  <meta name="viewport" content="width=device-width,initial-scale=1">\n' +
'  <title>' + esc(displayName) + ' \u2014 Commercial Viability Score ' + scoreNum + '/100 | Creatrbase</title>\n' +
'  <meta name="description" content="' + esc(displayName) + ' scores ' + scoreNum + '/100 on the Commercial Viability Score (' + tierLabel + ' tier). Top constraint: ' + esc(constraintLabel.toLowerCase()) + '. Score your channel free at Creatrbase.">\n' +
'  <link rel="canonical" href="' + pageUrl + '">\n' +
'\n' +
'  <meta property="og:type" content="website">\n' +
'  <meta property="og:site_name" content="Creatrbase">\n' +
'  <meta property="og:title" content="' + esc(displayName) + ' \u2014 CVS ' + scoreNum + '/100 (' + tierLabel + ')">\n' +
'  <meta property="og:description" content="Commercial Viability Score: ' + scoreNum + '/100. Top constraint: ' + esc(constraintLabel.toLowerCase()) + '. Score your channel free.">\n' +
'  <meta property="og:image" content="' + ogImageUrl + '">\n' +
'  <meta property="og:url" content="' + pageUrl + '">\n' +
'  <meta name="twitter:card" content="summary_large_image">\n' +
'  <meta name="twitter:title" content="' + esc(displayName) + ' \u2014 CVS ' + scoreNum + '/100 (' + tierLabel + ')">\n' +
'  <meta name="twitter:description" content="Commercial Viability Score: ' + scoreNum + '/100. Score yours free at Creatrbase.">\n' +
'  <meta name="twitter:image" content="' + ogImageUrl + '">\n' +
'\n' +
'  <link rel="preconnect" href="https://fonts.googleapis.com">\n' +
'  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
'  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">\n' +
'\n' +
'  <style>\n' +
'    *{margin:0;padding:0;box-sizing:border-box}\n' +
'    body{background:#05040A;color:#EDEDE8;font-family:"DM Sans",sans-serif;min-height:100vh;display:flex;flex-direction:column;align-items:center}\n' +
'    .wrap{max-width:680px;width:100%;padding:32px 24px}\n' +
'    .nav{display:flex;align-items:center;gap:8px;margin-bottom:40px}\n' +
'    .nav a{text-decoration:none}\n' +
'    .logo-creatr{font-family:"Outfit",sans-serif;font-weight:900;font-size:22px;color:#A4FFDB}\n' +
'    .logo-base{font-family:"Outfit",sans-serif;font-weight:900;font-size:22px;color:#FF9E7A}\n' +
'    .channel{display:flex;align-items:center;gap:16px;margin-bottom:32px}\n' +
'    .avatar{width:56px;height:56px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,0.08)}\n' +
'    .avatar-placeholder{width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:center;font-size:24px}\n' +
'    .channel-info h1{font-family:"DM Sans",sans-serif;font-weight:700;font-size:22px;color:#EDEDE8}\n' +
'    .channel-info .platform-tag{font-size:13px;color:#888D9B;margin-top:2px}\n' +
'    .score-section{text-align:center;margin:40px 0}\n' +
'    .score-number{font-family:"Outfit",sans-serif;font-weight:900;font-size:96px;line-height:1;color:#EDEDE8}\n' +
'    .score-of{font-family:"DM Sans",sans-serif;font-size:20px;color:#555A66;margin-top:4px}\n' +
'    .tier-badge{display:inline-block;padding:6px 18px;border-radius:999px;font-weight:700;font-size:14px;margin-top:16px;border:1px solid}\n' +
'    .conf-note{font-size:13px;color:#555A66;margin-top:12px}\n' +
'    .constraint{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:24px;margin:32px 0}\n' +
'    .constraint-label{font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#555A66;margin-bottom:8px}\n' +
'    .constraint-name{font-size:18px;font-weight:700;color:#FF9E7A}\n' +
'    .what-means{margin:24px 0;padding:24px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px}\n' +
'    .what-means h2{font-size:13px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#555A66;margin-bottom:12px}\n' +
'    .what-means p{font-size:15px;line-height:1.7;color:#888D9B}\n' +
'    .dimensions{margin:32px 0}\n' +
'    .dims-title{font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#555A66;margin-bottom:16px}\n' +
'    .cta-section{margin:40px 0;text-align:center}\n' +
'    .btn-primary{display:inline-block;padding:14px 32px;background:#A4FFDB;color:#05040A;font-family:"DM Sans",sans-serif;font-weight:700;font-size:15px;border-radius:999px;text-decoration:none;border:none;cursor:pointer;transition:transform 0.08s ease}\n' +
'    .btn-primary:active{transform:translate(2px,2px)}\n' +
'    .btn-secondary{display:inline-block;padding:12px 28px;background:transparent;color:#A4FFDB;font-family:"DM Sans",sans-serif;font-weight:600;font-size:14px;border-radius:999px;text-decoration:none;border:1px solid rgba(164,255,219,0.3);margin-left:12px}\n' +
'    .share-section{margin:40px 0;text-align:center}\n' +
'    .share-title{font-size:13px;font-weight:600;color:#555A66;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:16px}\n' +
'    .share-btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}\n' +
'    .share-btn{padding:10px 20px;border-radius:999px;font-size:13px;font-weight:600;text-decoration:none;border:1px solid rgba(255,255,255,0.08);color:#888D9B;background:rgba(255,255,255,0.03);cursor:pointer;font-family:"DM Sans",sans-serif;transition:border-color 0.15s ease}\n' +
'    .share-btn:hover{border-color:rgba(255,255,255,0.2);color:#EDEDE8}\n' +
'    .footer-sc{margin-top:auto;padding:32px 24px;text-align:center;font-size:12px;color:#555A66}\n' +
'    .footer-sc a{color:#888D9B;text-decoration:none}\n' +
'    @media(max-width:480px){.score-number{font-size:72px}.channel-info h1{font-size:18px}.share-btns{flex-direction:column;align-items:center}.btn-secondary{margin-left:0;margin-top:12px}}\n' +
'  </style>\n' +
'</head>\n' +
'<body>\n' +
'  <div class="wrap">\n' +
'    <nav class="nav">\n' +
'      <a href="/?' + utmBase + '"><span class="logo-creatr">CREATR</span><span class="logo-base">BASE</span></a>\n' +
'    </nav>\n' +
'\n' +
'    <div class="channel">\n' +
      (channelAvatarUrl
        ? '      <img class="avatar" src="' + esc(channelAvatarUrl) + '" alt="' + esc(displayName) + '">\n'
        : '      <div class="avatar-placeholder">' + platformIcon + '</div>\n') +
'      <div class="channel-info">\n' +
'        <h1>' + esc(displayName) + '</h1>\n' +
'        <div class="platform-tag">' + platformIcon + ' ' + platformLabel + '</div>\n' +
'      </div>\n' +
'    </div>\n' +
'\n' +
'    <div class="score-section">\n' +
'      <div class="score-number">' + scoreNum + '</div>\n' +
'      <div class="score-of">/ 100</div>\n' +
'      <div class="tier-badge" style="color:' + tierColor + ';border-color:' + tierColor + '40;background:' + tierColor + '15">' + tierLabel + '</div>\n' +
'      <p class="conf-note">' + esc(confNote) + '</p>\n' +
'    </div>\n' +
'\n' +
'    <div class="constraint">\n' +
'      <div class="constraint-label">Top Constraint</div>\n' +
'      <div class="constraint-name">' + esc(constraintLabel) + '</div>\n' +
'    </div>\n' +
'\n' +
'    <div class="dimensions">\n' +
'      <div class="dims-title">Dimension Breakdown</div>\n' +
       dimensionBarsHtml +
'    </div>\n' +
'\n' +
'    <div class="what-means">\n' +
'      <h2>What this means for brand deals</h2>\n' +
'      <p>' + esc(whatThisMeans) + '</p>\n' +
'    </div>\n' +
'\n' +
'    <div class="cta-section">\n' +
    (claimedAt
      ? '      <div style="display:inline-block;padding:8px 20px;border-radius:999px;background:rgba(164,255,219,0.15);border:1px solid rgba(164,255,219,0.3);color:#A4FFDB;font-weight:600;font-size:14px;margin-bottom:12px">&#10003; Score claimed</div>\n' +
        '      <p style="font-size:13px;color:#555A66;margin-top:8px">This score has been saved to an account.</p>\n'
      : '      <a class="btn-primary" href="/signup?claim=' + scoreCardId + '&platform=' + esc(platform) + '&handle=' + encodeURIComponent(handle) + '&' + utmBase + '">Save this score</a>\n' +
        '      <a class="btn-secondary" href="/score?' + utmBase + '">Score your channel</a>\n' +
        '      <p style="font-size:13px;color:#555A66;margin-top:16px">Own this channel? Sign up to connect via OAuth and get a full-confidence score.</p>\n') +
'    </div>\n' +
'\n' +
'    <div class="share-section">\n' +
'      <div class="share-title">Share</div>\n' +
'      <div class="share-btns">\n' +
'        <a class="share-btn" href="' + xShareUrl + '" target="_blank" rel="noopener">Share on X</a>\n' +
'        <a class="share-btn" href="' + redditShareUrl + '" target="_blank" rel="noopener">Share on Reddit</a>\n' +
'        <button class="share-btn" id="copy-link">Copy link</button>\n' +
'      </div>\n' +
'    </div>\n' +
'  </div>\n' +
'\n' +
'  <footer class="footer-sc">\n' +
'    <p>&copy; 2026 <a href="/?' + utmBase + '">Creatrbase</a>. Commercial Viability Score is a diagnostic tool, not a guarantee of brand deal outcomes.</p>\n' +
'  </footer>\n' +
'\n' +
'  <script>\n' +
'    document.getElementById("copy-link").addEventListener("click", function() {\n' +
'      var btn = this;\n' +
'      navigator.clipboard.writeText("' + copyLinkUrl + '").then(function() {\n' +
'        btn.textContent = "Copied!";\n' +
'        setTimeout(function() { btn.textContent = "Copy link"; }, 2000);\n' +
'      });\n' +
'    });\n' +
'  </script>\n' +
'</body>\n' +
'</html>';
}

module.exports = { renderScoreCardHTML };
