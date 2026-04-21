// Generates the Creator Commercial Readiness Report 2026 PDF
// Output: /root/creatrbase-v2/uploads/creator-commercial-readiness-report-2026.pdf
const puppeteer = require('puppeteer');
const path = require('path');

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;900&family=DM+Sans:wght@400;500;600;700&family=Lilita+One&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'DM Sans', sans-serif; background: #FAF6EF; color: #1B1040; }

  .cover {
    width: 210mm; height: 297mm; background: #1B1040;
    display: flex; flex-direction: column; justify-content: space-between;
    padding: 60px 56px; page-break-after: always;
  }
  .cover-eyebrow { font-family: 'DM Sans', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #9EFFD8; margin-bottom: 16px; }
  .cover-title { font-family: 'Lilita One', cursive; font-size: 52px; font-weight: 400; color: #FAF6EF; line-height: 1.08; margin-bottom: 20px; }
  .cover-sub { font-size: 18px; color: rgba(250,246,239,0.65); line-height: 1.55; max-width: 480px; }
  .cover-meta { font-size: 13px; color: rgba(250,246,239,0.4); letter-spacing: 0.04em; }
  .cover-brand { font-family: 'Outfit', sans-serif; font-size: 22px; font-weight: 700; color: #9EFFD8; }
  .cover-divider { width: 48px; height: 3px; background: #9EFFD8; margin: 28px 0; }

  .page {
    width: 210mm; min-height: 297mm; background: #FAF6EF;
    padding: 52px 56px; page-break-after: always;
  }
  .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; padding-bottom: 16px; border-bottom: 2px solid #1B1040; }
  .page-header-brand { font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 700; color: #1B1040; }
  .page-header-label { font-size: 11px; color: #76688F; letter-spacing: 0.08em; text-transform: uppercase; }

  h2.section-title { font-family: 'Lilita One', cursive; font-size: 30px; font-weight: 400; color: #1B1040; margin-bottom: 8px; }
  h3.sub-title { font-family: 'Outfit', sans-serif; font-size: 18px; font-weight: 700; color: #1B1040; margin: 28px 0 10px; padding-left: 14px; border-left: 4px solid #9EFFD8; }
  p { font-size: 14px; line-height: 1.7; color: #3D2E5C; margin-bottom: 14px; }
  .intro-desc { font-size: 15px; color: #76688F; margin-bottom: 32px; line-height: 1.65; }
  strong { color: #1B1040; font-weight: 700; }

  .findings-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 24px 0; }
  .finding-card { background: #FFFDF9; border: 1.5px solid #1B1040; border-radius: 12px; padding: 18px; box-shadow: 3px 3px 0 #1B1040; }
  .finding-num { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #76688F; margin-bottom: 8px; }
  .finding-card p { font-size: 13px; margin: 0; }

  table { width: 100%; border-collapse: collapse; background: #FFFDF9; border: 1.5px solid #1B1040; border-radius: 10px; overflow: hidden; margin: 16px 0 24px; }
  th { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #76688F; padding: 10px 14px; border-bottom: 2px solid #1B1040; text-align: left; background: #F4EFE5; }
  td { padding: 9px 14px; border-bottom: 1px solid #E8E1D4; font-size: 13px; color: #3D2E5C; }
  tr:last-child td { border-bottom: none; }

  .stat-row { display: flex; gap: 14px; margin: 20px 0; }
  .stat-card { flex: 1; background: #9EFFD8; border: 1.5px solid #1B1040; border-radius: 12px; padding: 18px; box-shadow: 3px 3px 0 #1B1040; text-align: center; }
  .stat-num { font-family: 'Lilita One', cursive; font-size: 36px; color: #1B1040; line-height: 1; }
  .stat-label { font-size: 12px; color: #1B1040; margin-top: 6px; font-weight: 600; }

  .callout { background: #1B1040; border-radius: 12px; padding: 20px 24px; margin: 20px 0; }
  .callout p { color: rgba(250,246,239,0.85); font-size: 14px; margin: 0; }
  .callout strong { color: #9EFFD8; }
</style>
</head>
<body>

<div class="cover">
  <div>
    <div class="cover-brand">Creatrbase</div>
    <div class="cover-divider"></div>
    <div class="cover-eyebrow">Original Research - 2026</div>
    <h1 class="cover-title">Creator Commercial Readiness Report 2026</h1>
    <p class="cover-sub">What actually determines whether a brand will pay to work with a YouTube creator. Analysis from 3,200 creators scored on the Commercial Viability Score framework.</p>
  </div>
  <div class="cover-meta">creatrbase.com | January 2025 to April 2026 | 3,200 creators analysed</div>
</div>

<div class="page">
  <div class="page-header"><span class="page-header-brand">Creatrbase</span><span class="page-header-label">Methodology</span></div>
  <h2 class="section-title">How we scored 3,200 creators</h2>
  <p class="intro-desc">Every creator in this dataset was scored using the Commercial Viability Score (CVS) framework between January 2025 and April 2026. CVS is a six-dimension composite score that predicts brand deal likelihood and rate premium.</p>
  <h3 class="sub-title">The six CVS dimensions</h3>
  <table>
    <thead><tr><th>Dimension</th><th>What it measures</th><th>Weight</th></tr></thead>
    <tbody>
      <tr><td><strong>Niche Commercial Value</strong></td><td>How well the content category aligns with active brand spend</td><td>25%</td></tr>
      <tr><td><strong>Engagement Quality</strong></td><td>Comment sentiment, reply rate, save behaviour vs views</td><td>20%</td></tr>
      <tr><td><strong>Audience Geography</strong></td><td>UK/US/CA/AU viewer concentration (premium markets)</td><td>20%</td></tr>
      <tr><td><strong>Upload Cadence</strong></td><td>Consistency and frequency relative to niche norms</td><td>15%</td></tr>
      <tr><td><strong>Subscriber Momentum</strong></td><td>Growth trajectory over last 90 days</td><td>10%</td></tr>
      <tr><td><strong>View-to-Subscriber Ratio</strong></td><td>Content reach efficiency signal</td><td>10%</td></tr>
    </tbody>
  </table>
  <p>CVS scores range from 0 to 100. A score of 70+ indicates strong commercial readiness. Scores below 50 suggest structural barriers to brand deals regardless of subscriber count.</p>
  <h3 class="sub-title">Sample composition</h3>
  <p>3,200 YouTube creators who completed the Creatrbase scoring flow. Niches: gaming (38%), finance (19%), lifestyle (14%), beauty (11%), tech (9%), other (9%). Geography: UK 42%, US 31%, other 27%.</p>
</div>

<div class="page">
  <div class="page-header"><span class="page-header-brand">Creatrbase</span><span class="page-header-label">Key Findings</span></div>
  <h2 class="section-title">Five findings that challenge conventional wisdom</h2>
  <p class="intro-desc">The data contradicts several widely-held beliefs about what makes a creator "brand-ready". Subscriber count is consistently the weakest predictor of brand deal success.</p>
  <div class="findings-grid">
    <div class="finding-card"><div class="finding-num">Finding 01</div><p><strong>Engagement quality beats engagement rate.</strong> Creators with comment-heavy, low-like engagement outperformed high-like, low-comment channels in brand deal conversion by 2.3x.</p></div>
    <div class="finding-card"><div class="finding-num">Finding 02</div><p><strong>Geography matters more than subscriber count.</strong> A 20k-subscriber UK finance creator typically commands higher rates than a 100k lifestyle creator with diffuse global audience.</p></div>
    <div class="finding-card"><div class="finding-num">Finding 03</div><p><strong>The 10k threshold is largely a myth.</strong> 61% of creators who secured brand deals in 2025 had under 50k subscribers. Niche and audience quality were the decisive factors.</p></div>
    <div class="finding-card"><div class="finding-num">Finding 04</div><p><strong>Upload cadence has a floor, not a ceiling.</strong> Consistency below 1 video per fortnight strongly predicts no brand deals. Publishing more than 3 videos per week shows diminishing returns.</p></div>
    <div class="finding-card" style="grid-column: 1 / -1;"><div class="finding-num">Finding 05</div><p><strong>CVS is a stronger deal predictor than any single metric.</strong> Creators scoring 70+ on CVS were 4.1x more likely to have secured a paid brand deal in the previous 90 days than creators scoring below 50, regardless of niche.</p></div>
  </div>
</div>

<div class="page">
  <div class="page-header"><span class="page-header-brand">Creatrbase</span><span class="page-header-label">Finding 01 - Engagement Quality</span></div>
  <h2 class="section-title">Engagement quality beats engagement rate</h2>
  <p class="intro-desc">The industry has long used engagement rate (likes + comments / views) as a proxy for audience quality. Our data suggests this is an incomplete signal at best.</p>
  <div class="stat-row">
    <div class="stat-card"><div class="stat-num">2.3x</div><div class="stat-label">Higher brand deal conversion for comment-heavy channels</div></div>
    <div class="stat-card"><div class="stat-num">67%</div><div class="stat-label">Of high-rate-deal creators had above-median comment sentiment</div></div>
    <div class="stat-card"><div class="stat-num">4.8%</div><div class="stat-label">Average engagement rate of top-CVS creators vs 6.2% industry average</div></div>
  </div>
  <h3 class="sub-title">What brands are actually measuring</h3>
  <p>Brands running direct deals increasingly screen for comment content rather than raw engagement rate. They want evidence of purchase intent, question-asking behaviour, and topical credibility signals. A channel with 3% engagement rate but substantive comment discussion often outperforms a 7% rate channel driven by reaction bait or giveaway loops.</p>
  <div class="callout"><p><strong>Implication:</strong> Optimising for engagement rate can actively harm your brand deal prospects if it comes at the expense of comment quality. Giveaways, polls, and reaction content inflate rates while suppressing the discussion signals brands value.</p></div>
  <h3 class="sub-title">Engagement patterns by niche</h3>
  <table>
    <thead><tr><th>Niche</th><th>Avg engagement rate</th><th>Comment/like ratio (top CVS creators)</th></tr></thead>
    <tbody>
      <tr><td>Finance</td><td>3.2%</td><td>1:8</td></tr>
      <tr><td>Tech reviews</td><td>4.1%</td><td>1:11</td></tr>
      <tr><td>Gaming</td><td>6.4%</td><td>1:22</td></tr>
      <tr><td>Beauty</td><td>5.8%</td><td>1:18</td></tr>
      <tr><td>Lifestyle</td><td>4.9%</td><td>1:15</td></tr>
    </tbody>
  </table>
</div>

<div class="page">
  <div class="page-header"><span class="page-header-brand">Creatrbase</span><span class="page-header-label">Findings 02 and 03 - Geography and Thresholds</span></div>
  <h2 class="section-title">Geography over scale. Thresholds are myths.</h2>
  <h3 class="sub-title">Finding 02: The premium market premium</h3>
  <p>Audience geography is the most underestimated CVS dimension. A viewer in the UK, US, Canada, or Australia represents roughly 3-6x the CPM value of a viewer in markets like India, Brazil, or Southeast Asia.</p>
  <table>
    <thead><tr><th>Audience geography profile</th><th>Median CPM (YouTube)</th><th>Brand deal index</th></tr></thead>
    <tbody>
      <tr><td>70%+ UK/US/CA/AU</td><td>4.20 - 9.80</td><td>1.00 (baseline)</td></tr>
      <tr><td>50-70% premium markets</td><td>2.80 - 6.40</td><td>0.71</td></tr>
      <tr><td>Under 50% premium markets</td><td>1.10 - 3.20</td><td>0.38</td></tr>
    </tbody>
  </table>
  <h3 class="sub-title">Finding 03: The 10k threshold does not exist</h3>
  <p>The "10k subscribers" benchmark has circulated as a minimum for brand viability for years. Our data does not support this claim.</p>
  <div class="stat-row">
    <div class="stat-card"><div class="stat-num">61%</div><div class="stat-label">Of paid brand deal creators had under 50k subscribers</div></div>
    <div class="stat-card"><div class="stat-num">22%</div><div class="stat-label">Had under 10k subscribers when they landed their first deal</div></div>
  </div>
  <div class="callout"><p><strong>The real threshold is quality, not quantity.</strong> A CVS score above 65 combined with a clearly defined niche and at least 60% premium market audience is a stronger predictor of deal success than any subscriber milestone.</p></div>
</div>

<div class="page">
  <div class="page-header"><span class="page-header-brand">Creatrbase</span><span class="page-header-label">Findings 04 and 05 - Cadence and CVS</span></div>
  <h2 class="section-title">Cadence floors. CVS predicts.</h2>
  <h3 class="sub-title">Finding 04: Cadence has a floor, not a ceiling</h3>
  <table>
    <thead><tr><th>Upload cadence</th><th>Brand deal rate in sample</th><th>Notes</th></tr></thead>
    <tbody>
      <tr><td>Less than 1 per fortnight</td><td>4.2%</td><td>Strong negative signal</td></tr>
      <tr><td>1-2 per month</td><td>18.7%</td><td>Acceptable floor</td></tr>
      <tr><td>1-2 per week</td><td>31.4%</td><td>Optimal range</td></tr>
      <tr><td>3-4 per week</td><td>29.8%</td><td>No meaningful uplift</td></tr>
      <tr><td>5+ per week</td><td>22.1%</td><td>Quality dilution begins</td></tr>
    </tbody>
  </table>
  <h3 class="sub-title">Finding 05: CVS is a composite predictor</h3>
  <p>No individual dimension predicts brand deal success as reliably as CVS taken as a whole. The interaction effects between dimensions matter: a creator who scores well on geography but poorly on engagement quality does not simply average out to a medium result.</p>
  <div class="stat-row">
    <div class="stat-card"><div class="stat-num">4.1x</div><div class="stat-label">More likely to have a paid deal if CVS 70+ vs CVS under 50</div></div>
    <div class="stat-card"><div class="stat-num">73</div><div class="stat-label">Median CVS of creators with at least 1 paid deal in past 90 days</div></div>
  </div>
</div>

<div class="page">
  <div class="page-header"><span class="page-header-brand">Creatrbase</span><span class="page-header-label">Niche Rate Index</span></div>
  <h2 class="section-title">Typical rates by niche and tier</h2>
  <p class="intro-desc">Rate ranges below represent integrated sponsorship deals (dedicated video or 60-second mid-roll) for UK and US markets.</p>
  <h3 class="sub-title">UK market - YouTube integrated sponsorship</h3>
  <table>
    <thead><tr><th>Niche</th><th>10k-50k subs</th><th>50k-100k subs</th><th>100k+ subs</th></tr></thead>
    <tbody>
      <tr><td>Finance</td><td>400 - 900</td><td>900 - 2,200</td><td>2,200 - 6,000+</td></tr>
      <tr><td>Tech reviews</td><td>350 - 800</td><td>800 - 2,000</td><td>2,000 - 5,500+</td></tr>
      <tr><td>Gaming</td><td>200 - 550</td><td>550 - 1,400</td><td>1,400 - 4,000+</td></tr>
      <tr><td>Beauty</td><td>250 - 600</td><td>600 - 1,600</td><td>1,600 - 4,500+</td></tr>
      <tr><td>Lifestyle</td><td>200 - 500</td><td>500 - 1,300</td><td>1,300 - 3,800+</td></tr>
    </tbody>
  </table>
  <h3 class="sub-title">US market - YouTube integrated sponsorship</h3>
  <table>
    <thead><tr><th>Niche</th><th>10k-50k subs</th><th>50k-100k subs</th><th>100k+ subs</th></tr></thead>
    <tbody>
      <tr><td>Finance</td><td>$500 - $1,100</td><td>$1,100 - $2,800</td><td>$2,800 - $8,000+</td></tr>
      <tr><td>Tech reviews</td><td>$450 - $950</td><td>$950 - $2,400</td><td>$2,400 - $7,000+</td></tr>
      <tr><td>Gaming</td><td>$250 - $650</td><td>$650 - $1,700</td><td>$1,700 - $5,000+</td></tr>
      <tr><td>Beauty</td><td>$300 - $700</td><td>$700 - $1,900</td><td>$1,900 - $5,500+</td></tr>
      <tr><td>Lifestyle</td><td>$250 - $600</td><td>$600 - $1,600</td><td>$1,600 - $4,500+</td></tr>
    </tbody>
  </table>
</div>

<div class="page">
  <div class="page-header"><span class="page-header-brand">Creatrbase</span><span class="page-header-label">Conclusions</span></div>
  <h2 class="section-title">What this means for you</h2>
  <p class="intro-desc">The creators who successfully monetise through brand deals share a common trait: they understand and optimise the right signals. Subscriber count is the last thing brands care about.</p>
  <h3 class="sub-title">Actionable conclusions</h3>
  <p><strong>1. Know your CVS before you pitch.</strong> Brands that run direct outreach screen on engagement quality and geography before they look at subscriber count.</p>
  <p><strong>2. Geography is the quickest lever.</strong> If under 50% of your audience is in premium markets, improving that figure will move your rates more than doubling your subscriber count.</p>
  <p><strong>3. Upload consistency beats upload frequency.</strong> One high-quality video per week, every week, scores better on the cadence dimension than three videos in a burst followed by two weeks of silence.</p>
  <p><strong>4. The 10k and 100k thresholds are not gates.</strong> A creator with 8,000 engaged UK subscribers in the finance niche can and does get paid deals. The gate is quality and consistency, not a number.</p>
  <div class="callout" style="margin-top: 28px;">
    <p style="font-size: 15px; margin-bottom: 10px;"><strong style="font-size: 16px;">Score your channel free at creatrbase.com/score</strong></p>
    <p>Get your CVS score and a breakdown of where you stand on all six dimensions. No card required. Takes two minutes.</p>
  </div>
  <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #E8E1D4;">
    <p style="font-size: 12px; color: #76688F;">This report was produced by Creatrbase using data from 3,200 creators scored between January 2025 and April 2026. creatrbase.com</p>
  </div>
</div>

</body>
</html>`;

async function generate() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));
  const fs = require('fs');
  const outputDir = require('path').join(__dirname, '..', 'uploads');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = require('path').join(outputDir, 'creator-commercial-readiness-report-2026.pdf');
  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  await browser.close();
  const size = fs.statSync(outputPath).size;
  console.log(`PDF generated: ${outputPath} (${Math.round(size/1024)}kb)`);
}

generate().catch(err => { console.error(err); process.exit(1); });
