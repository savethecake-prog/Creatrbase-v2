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
        '<span style="font-size:13px;color:var(--text-sec)">' + esc(label) + '</span>' +
        '<span style="font-size:13px;color:var(--text)">' + (dimScore != null ? dimScore : '\u2014') + ' <span style="font-size:11px;color:' + dimLevel.color + '">' + esc(dimLevel.label) + '</span></span>' +
        '</div>' +
        '<div style="height:6px;background:var(--card-bg);border:1px solid var(--card-border);border-radius:3px;overflow:hidden">' +
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
'  <link href="https://fonts.googleapis.com/css2?family=Lilita+One&family=Outfit:wght@400;500;600;700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">\n' +
'\n' +
'  <style>\n' +
'    *{margin:0;padding:0;box-sizing:border-box}\n' +
'    :root{--bg:#05040A;--text:#EDEDE8;--text-sec:#888D9B;--text-muted:#555A66;--card-bg:rgba(255,255,255,0.03);--card-border:rgba(255,255,255,0.08);--share-btn-bg:rgba(255,255,255,0.03);--share-btn-border:rgba(255,255,255,0.08);--share-btn-hover-border:rgba(255,255,255,0.2)}\n' +
'    html[data-theme=light]{--bg:#FAF6EF;--text:#0E1B2A;--text-sec:#4A5568;--text-muted:#8A9AB0;--card-bg:rgba(14,27,42,0.03);--card-border:rgba(14,27,42,0.1);--share-btn-bg:rgba(14,27,42,0.03);--share-btn-border:rgba(14,27,42,0.12);--share-btn-hover-border:rgba(14,27,42,0.3)}\n' +
'    body{background:var(--bg);color:var(--text);font-family:"DM Sans",sans-serif;min-height:100vh;display:flex;flex-direction:column;align-items:center;transition:background 0.2s,color 0.2s}\n' +
'    .wrap{max-width:680px;width:100%;padding:32px 24px}\n' +
'    .nav{display:flex;align-items:center;justify-content:space-between;margin-bottom:40px}\n' +
'    .nav a{text-decoration:none;display:flex;align-items:center}\n' +
'    .wordmark-light{height:22px;display:none}\n' +
'    .wordmark-dark{height:22px;display:block}\n' +
'    html[data-theme=light] .wordmark-light{display:block}\n' +
'    html[data-theme=light] .wordmark-dark{display:none}\n' +
'    .theme-toggle{background:none;border:1px solid var(--card-border);border-radius:8px;padding:6px 12px;font-size:12px;font-weight:600;color:var(--text-sec);font-family:"DM Sans",sans-serif;cursor:pointer;transition:all 0.15s ease}\n' +
'    .theme-toggle:hover{background:var(--card-bg);color:var(--text)}\n' +
'    .channel{display:flex;align-items:center;gap:16px;margin-bottom:32px}\n' +
'    .avatar{width:56px;height:56px;border-radius:50%;object-fit:cover;border:2px solid var(--card-border)}\n' +
'    .avatar-placeholder{width:56px;height:56px;border-radius:50%;background:var(--card-bg);display:flex;align-items:center;justify-content:center;font-size:24px}\n' +
'    .channel-info h1{font-family:"DM Sans",sans-serif;font-weight:700;font-size:22px;color:var(--text)}\n' +
'    .channel-info .platform-tag{font-size:13px;color:var(--text-muted);margin-top:2px}\n' +
'    .score-section{text-align:center;margin:40px 0}\n' +
'    .score-number{font-family:"Lilita One",cursive;font-size:96px;line-height:1;color:var(--text)}\n' +
'    .score-of{font-family:"DM Sans",sans-serif;font-size:20px;color:var(--text-muted);margin-top:4px}\n' +
'    .tier-badge{display:inline-block;padding:6px 18px;border-radius:999px;font-weight:700;font-size:14px;margin-top:16px;border:1px solid}\n' +
'    .conf-note{font-size:13px;color:var(--text-muted);margin-top:12px}\n' +
'    .constraint{background:var(--card-bg);border:1px solid var(--card-border);border-radius:14px;padding:24px;margin:32px 0}\n' +
'    .constraint-label{font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-muted);margin-bottom:8px}\n' +
'    .constraint-name{font-size:18px;font-weight:700;color:#FF9E7A}\n' +
'    .what-means{margin:24px 0;padding:24px;background:var(--card-bg);border:1px solid var(--card-border);border-radius:14px}\n' +
'    .what-means h2{font-size:13px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-muted);margin-bottom:12px}\n' +
'    .what-means p{font-size:15px;line-height:1.7;color:var(--text-sec)}\n' +
'    .dimensions{margin:32px 0}\n' +
'    .dims-title{font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-muted);margin-bottom:16px}\n' +
'    .cta-section{margin:40px 0;text-align:center}\n' +
'    .btn-primary{display:inline-block;padding:14px 32px;background:#A4FFDB;color:#05040A;font-family:"DM Sans",sans-serif;font-weight:700;font-size:15px;border-radius:999px;text-decoration:none;border:none;cursor:pointer;box-shadow:3px 3px 0px #05040A;transition:box-shadow 0.08s ease,transform 0.08s ease}\n' +
'    .btn-primary:hover{box-shadow:1px 1px 0px #05040A;transform:translate(2px,2px)}\n' +
'    .btn-secondary{display:inline-block;padding:12px 28px;background:transparent;color:var(--text-sec);font-family:"DM Sans",sans-serif;font-weight:600;font-size:14px;border-radius:999px;text-decoration:none;border:1px solid var(--card-border);margin-left:12px}\n' +
'    .share-section{margin:40px 0;text-align:center}\n' +
'    .share-title{font-size:13px;font-weight:600;color:var(--text-muted);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:16px}\n' +
'    .share-btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}\n' +
'    .share-btn{padding:10px 20px;border-radius:999px;font-size:13px;font-weight:600;text-decoration:none;border:1px solid var(--share-btn-border);color:var(--text-sec);background:var(--share-btn-bg);cursor:pointer;font-family:"DM Sans",sans-serif;transition:border-color 0.15s ease,color 0.15s ease}\n' +
'    .share-btn:hover{border-color:var(--share-btn-hover-border);color:var(--text)}\n' +
'    .footer-sc{margin-top:auto;padding:32px 24px;text-align:center;font-size:12px;color:var(--text-muted)}\n' +
'    .footer-sc a{color:var(--text-sec);text-decoration:none}\n' +
'    @media(max-width:480px){.score-number{font-size:72px}.channel-info h1{font-size:18px}.share-btns{flex-direction:column;align-items:center}.btn-secondary{margin-left:0;margin-top:12px}}\n' +
'  </style>\n' +
'</head>\n' +
'<body>\n' +
'  <div class="wrap">\n' +
'    <nav class="nav">\n' +
'      <a href="/?' + utmBase + '">\n' +
'        <img class="wordmark-dark" src="/brand/wordmark-light.png" alt="Creatrbase">\n' +
'        <img class="wordmark-light" src="/brand/wordmark-dark.png" alt="Creatrbase">\n' +
'      </a>\n' +
'      <button class="theme-toggle" id="theme-toggle" aria-label="Toggle theme">Light mode</button>\n' +
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
'    var toggle = document.getElementById("theme-toggle");\n' +
'    var isLight = false;\n' +
'    toggle.addEventListener("click", function() {\n' +
'      isLight = !isLight;\n' +
'      document.documentElement.setAttribute("data-theme", isLight ? "light" : "");\n' +
'      toggle.textContent = isLight ? "Dark mode" : "Light mode";\n' +
'    });\n' +
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
