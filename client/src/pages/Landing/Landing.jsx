import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { BrandCheck } from '../../components/landing/BrandCheck/BrandCheck';
import { useIntersection } from '../../hooks/useIntersection';
import { PageMeta } from '../../components/PageMeta/PageMeta';
import { PublicNav } from '../../components/PublicNav/PublicNav';
import styles from './Landing.module.css';

function logSignal(signalType, payload) {
  fetch('/api/public/signal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      signal_type: signalType,
      vector: 'organic',
      source_surface: 'web:landing',
      signal_payload: payload || {},
    }),
  }).catch(function() {});
}

const STATS = [
  { num: '44', unit: '%', desc: <><b>of creators</b> say better communication with brands is the single biggest factor that would make partnerships more successful.</>, source: 'Source \u00b7 CreatorIQ \u00b7 State of Creator Marketing 2026' },
  { num: '68', unit: '%', desc: <><b>of creators undervalue their work</b> because rate-card data is fragmented, inconsistent, or gate-kept by agencies.</>, source: 'Source \u00b7 Influencer Marketing Hub \u00b7 2025 Report' },
  { num: '62', unit: '%', desc: <><b>of all creator payments</b> in 2025 went to the top 10% of creators. The other 90% are fighting for the remainder without the tools the top tier has.</>, source: 'Source \u00b7 CreatorIQ \u00b7 State of Creator Compensation, Jan 2026' },
  { num: '72', unit: '%', desc: <><b>of brands</b> now prioritise engagement rate and audience relevance over raw follower count when choosing creators.</>, source: 'Source \u00b7 Influencer Marketing Hub \u00b7 2025 State of Influencer Marketing' },
  { num: '$38.5', unit: 'k', desc: <><b>average micro-influencer earnings</b> in 2025 &mdash; while million-plus creators averaged $1.2M. The gap isn&rsquo;t talent. It&rsquo;s access to information.</>, source: 'Source \u00b7 Lumanu \u00b7 2025 Creator Compensation Insights' },
];

const DIMS = [
  { eyebrow: 'Growth signal', title: 'Subscriber momentum', desc: 'Velocity beats volume. A channel growing 200/day is worth more to a brand than a flat channel with twice the subs. We measure both the rate and the consistency.', weight: '25%', color: '' },
  { eyebrow: 'Audience signal', title: 'Engagement quality', desc: 'Raw engagement rate is a vanity metric. We look at view-to-subscriber ratio, comment-to-like balance, and whether the audience actually shows up \u2014 the numbers brands run before signing.', weight: '20%', color: 'peach' },
  { eyebrow: 'Commercial signal', title: 'Niche commercial value', desc: 'Not every niche is worth the same. Gaming hardware, beauty, finance, and fitness command different CPMs and different brand budgets. We score where your channel sits in brand-spend terms.', weight: '20%', color: 'mint' },
  { eyebrow: 'Audience signal', title: 'Geo alignment', desc: 'A UK-and-US audience is worth more to most brand briefs than a global spread. We score your Tier 1 geography mix against what brands in your niche are actually buying right now.', weight: '15%', color: '' },
  { eyebrow: 'Production signal', title: 'Content consistency', desc: 'Brands check your upload cadence before they check anything else. Scoring looks at frequency, reliability, and whether you can hit a campaign window without collapsing your schedule.', weight: '10%', color: 'peach' },
  { eyebrow: 'Readiness signal', title: 'Content brand alignment', desc: 'Have you integrated brand mentions before without it feeling forced? Do you already run affiliate links, product mentions, clean deliverables? This dimension measures brand-readiness.', weight: '10%', color: 'mint' },
];

const TIERS = [
  { range: '0 \u2013 24', name: 'Pre-Commercial', desc: 'Too early for most paid brand work. The focus is foundation: audience, niche clarity, cadence. Gifting partnerships are in play.', fill: 20, color: 'peach-shade' },
  { range: '25 \u2013 49', name: 'Emerging', desc: "You'll close paid deals with small and mid-market brands who value niche fit over scale. Rates 30\u201350% below tier average.", fill: 40, color: 'peach-deep' },
  { range: '50 \u2013 74', name: 'Viable', desc: 'Brand-ready. Agencies will engage, direct inbound is possible. Sustained rates start here. This is where most paid work gets signed.', fill: 66, color: 'mint-deep' },
  { range: '75 \u2013 100', name: 'Established', desc: 'Premium-rate territory. Agencies compete for you. Long-term ambassadorships and retainers become the category, not one-offs.', fill: 92, color: 'mint-shade' },
];

const FAQS = [
  { id: 'analytics', q: 'Is this just another analytics tool?', a: 'No. Analytics tools show you what happened. Creatrbase scores your channel against what brands actually pay for, and tells you which specific dimension to work on next. The output is a decision, not a dashboard.' },
  { id: 'under10k', q: 'Will this work if I\u2019m under 10,000 subscribers?', a: 'Yes. Our scoring model is tier-aware \u2014 your 7k-sub channel is compared to other 7k-sub channels in your niche, not to 500k mega-creators. Some YouTube audience data is only available at 1k+ subs (platform limit); we flag this clearly.' },
  { id: 'data', q: 'Do you actually read my data or sell it?', a: 'We read only the metrics shown in your score. We never sell data. Aggregate benchmarking is opt-in and anonymous \u2014 off by default. Your data is used to improve your score and nothing else.' },
  { id: 'disagree', q: 'What if I disagree with my score?', a: "The six dimensions and their weightings are public. If you think we\u2019re wrong about your niche\u2019s commercial value, or the way we\u2019re counting engagement, tell us \u2014 every calibration is published with the reasoning." },
  { id: 'platforms', q: 'Twitch, YouTube, anything else?', a: "YouTube and Twitch are live. Instagram and TikTok are already built \u2014 the product ships the moment we have sanctioned API access (TikTok\u2019s is gated, which is why it takes longer). No \u201croadmap\u201d hand-waving. They exist in the codebase today, waiting." },
  { id: 'cancel', q: 'Can I cancel without talking to someone?', a: 'Yes. One click, in your settings. No \u201cschedule a call\u201d nonsense. Your score data stays available in read-only mode for 30 days so you can still reference it.' },
];

const TICKER_ITEMS = ['Honest scoring', 'Real brand data', 'UK + US benchmarks', 'Built for independent creators', 'Weekly refresh', 'No agency middlemen'];

export function Landing() {
  const [heroRef, heroVisible] = useIntersection({ once: true, threshold: 0.1 });
  const [problemRef, problemVisible] = useIntersection({ once: true, threshold: 0.1 });
  const [howRef, howVisible] = useIntersection({ once: true, threshold: 0.1 });
  const [demoRef, demoVisible] = useIntersection({ once: true, threshold: 0.1 });
  const [dimsRef, dimsVisible] = useIntersection({ once: true, threshold: 0.1 });
  const [tiersRef, tiersVisible] = useIntersection({ once: true, threshold: 0.1 });
  const [honestyRef, honestyVisible] = useIntersection({ once: true, threshold: 0.1 });
  const [whomRef, whomVisible] = useIntersection({ once: true, threshold: 0.1 });
  const [pricingRef, pricingVisible] = useIntersection({ once: true, threshold: 0.1 });
  const [faqRef, faqVisible] = useIntersection({ once: true, threshold: 0.1 });
  const [ctaRef, ctaVisible] = useIntersection({ once: true, threshold: 0.1 });

  // Demo tabs
  const [demoTab, setDemoTab] = useState('score');

  // Rotating stats
  const [statsIdx, setStatsIdx] = useState(0);
  const [statsInView, setStatsInView] = useState(false);
  const statsRef = useRef(null);
  const reduced = useRef(typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    if (!statsRef.current || reduced.current) return;
    const obs = new IntersectionObserver(([e]) => setStatsInView(e.isIntersecting), { threshold: 0.2 });
    obs.observe(statsRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!statsInView || reduced.current) return;
    const t = setInterval(() => setStatsIdx(i => (i + 1) % STATS.length), 8000);
    return () => clearInterval(t);
  }, [statsInView]);

  // UTM persistence
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const utm = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].forEach(function(k) {
      if (params.get(k)) utm[k] = params.get(k);
    });
    if (Object.keys(utm).length > 0) {
      document.cookie = 'cb_utm=' + encodeURIComponent(JSON.stringify(utm)) + ';max-age=2592000;path=/;SameSite=Lax';
      logSignal('utm_landing', utm);
    }
  }, []);

  return (
    <div className={styles.page}>
      <PageMeta
        title="Know where you stand with brands"
        description="Commercial intelligence for independent creators on YouTube and Twitch. Get your Commercial Viability Score across six dimensions brands actually evaluate. Free, under a minute, no credit card."
        canonical="https://creatrbase.com/"
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'Organization',
        name: 'Creatrbase', url: 'https://creatrbase.com',
        description: 'The commercial intelligence platform for independent YouTube and Twitch creators.',
      }) }} />

      <PublicNav scrollEffect variant="v2" />

      {/* 01 — Hero */}
      <section ref={heroRef} className={`${styles.hero} ${heroVisible ? styles.visible : ''}`}>
        <div className={styles.heroBg1} />
        <div className={styles.heroBg2} />
        <div className={styles.heroGrid}>
          <div>
            <div className={`${styles.eyebrow} ${styles.reveal}`}>
              <span className={styles.eyebrowDot} />
              For independent creators &middot; <b className={styles.eyebrowAccent}>1k&ndash;100k subs</b>
            </div>
            <h1 className={`${styles.display} ${styles.reveal} ${styles.stagger1}`}>
              Know exactly<br/>where you stand<br/>with <span className={styles.highlight}>brands.</span>
            </h1>
            <p className={`${styles.lede} ${styles.reveal} ${styles.stagger2}`}>
              Connect your YouTube or Twitch channel and get your <strong>Commercial Viability Score</strong> across six dimensions brands actually evaluate. Free, in under sixty seconds, no credit card.
            </p>
            <div className={`${styles.reveal} ${styles.stagger3}`}>
              <BrandCheck />
            </div>
            <div className={`${styles.proofRow} ${styles.reveal} ${styles.stagger4}`}>
              <div className={styles.proofAvatars}>
                <div className={`${styles.av} ${styles.av1}`} />
                <div className={`${styles.av} ${styles.av2}`} />
                <div className={`${styles.av} ${styles.av3}`} />
                <div className={`${styles.av} ${styles.av4}`} />
                <div className={`${styles.av} ${styles.av5}`}>+2k</div>
              </div>
              <div className={styles.proofText}>
                <b>2,147 creators</b> scored this month.<br/>Median score: 58 &middot; Median tier: Viable.
              </div>
            </div>
          </div>
          <div className={styles.previewStage}>
            <span className={`${styles.stickerChip} ${styles.chip1}`}>Live preview</span>
            <span className={`${styles.stickerChip} ${styles.stickerPeach} ${styles.chip2}`}>+12 vs last month</span>
            <span className={`${styles.stickerChip} ${styles.stickerMint} ${styles.chip3}`}>YPP eligible</span>
            <div className={styles.scoreCard}>
              <div className={styles.scoreCardHead}>
                <div className={styles.scoreCardChannel}>
                  <div className={styles.channelAvatar}>M</div>
                  <div><div className={styles.channelName}>Mug of Chaos</div><div className={styles.channelHandle}>@mugofchaos &middot; YouTube</div></div>
                </div>
                <div className={styles.scoreTierPill}>Tier &middot; Viable</div>
              </div>
              <div className={styles.scoreHeadline}>
                <div className={styles.scoreNum}>67</div>
                <div className={styles.scoreOut}>/ 100</div>
                <div className={styles.scoreMetaRight}>
                  <div className={styles.scoreMetaLabel}>Confidence</div>
                  <div className={styles.scoreConfidence}>High &middot; 12 weeks of data</div>
                </div>
              </div>
              {[
                { name: 'Subscriber momentum', pct: '25%', score: 78, w: '78%' },
                { name: 'Engagement quality', pct: '20%', score: 71, w: '71%' },
                { name: 'Niche commercial value', pct: '20%', score: 54, w: '54%', warn: true },
                { name: 'Audience geo alignment', pct: '15%', score: 82, w: '82%' },
                { name: 'Content consistency', pct: '10%', score: 64, w: '64%', lav: true },
                { name: 'Content brand alignment', pct: '10%', score: 48, w: '48%', warn: true },
              ].map(d => (
                <div className={styles.dimRow} key={d.name}>
                  <div className={styles.dimName}>{d.name} <span className={styles.dimPct}>{d.pct}</span></div>
                  <div className={styles.dimBar}><div className={`${styles.dimBarFill} ${d.warn ? styles.dimWarn : ''} ${d.lav ? styles.dimLav : ''}`} style={{ width: d.w }} /></div>
                  <div className={`${styles.dimScore} ${d.warn ? styles.dimScoreWarn : ''}`}>{d.score}</div>
                </div>
              ))}
              <div className={styles.scoreCardFoot}>
                <div className={styles.footNote}><b>Two dimensions need work.</b> We&rsquo;ve drafted three tasks to close the gap.</div>
                <span className={styles.footLink}>See the tasks &rarr;</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ticker */}
      <div className={styles.ticker} aria-label="Creatrbase — honest scoring, real brand data">
        <div className={styles.tickerTrack}>
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((t, i) => <span key={i} className={styles.tickerItem}>{t}</span>)}
        </div>
      </div>

      {/* 02 — Problem */}
      <section ref={problemRef} className={`${styles.section} ${problemVisible ? styles.visible : ''}`} id="problem">
        <div className={styles.problemGrid}>
          <div>
            <div className={`${styles.eyebrow} ${styles.eyebrowPeach} ${styles.reveal}`}><span className={styles.eyebrowDot} /> The problem</div>
            <h2 className={`${styles.sectionTitle} ${styles.reveal} ${styles.stagger1}`}>Subscriber count isn&rsquo;t what brands actually <em>pay&nbsp;for.</em></h2>
            <p className={`${styles.sectionBody} ${styles.reveal} ${styles.stagger2}`}>Brands don&rsquo;t buy follower counts. They buy audiences, engagement quality, niche alignment, and whether you can deliver. The gap between what creators think brands want and what brands actually evaluate is where deals die.</p>
            <p className={`${styles.sectionBody} ${styles.reveal} ${styles.stagger3}`}>Creatrbase is the instrument for closing that gap.</p>
          </div>
          <div className={styles.statCard} ref={statsRef} aria-live="polite">
            {STATS.map((s, i) => (
              <div key={i} className={`${styles.statSlide} ${i === statsIdx ? styles.statActive : ''}`}>
                <div className={styles.statNum}>{s.num}<span className={styles.statUnit}>{s.unit}</span></div>
                <div className={styles.statDesc}>{s.desc}</div>
                <div className={styles.statSource}>{s.source}</div>
              </div>
            ))}
            <div className={styles.statDots}>
              {STATS.map((_, i) => (
                <button key={i} className={`${styles.statDot} ${i === statsIdx ? styles.statDotActive : ''}`} onClick={() => setStatsIdx(i)} aria-label={`Stat ${i + 1}`} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 03 — How it works */}
      <section ref={howRef} className={`${styles.section} ${styles.sectionAlt} ${howVisible ? styles.visible : ''}`} id="how-it-works">
        <div className={styles.container}>
          <div className={`${styles.eyebrow} ${styles.eyebrowLav} ${styles.reveal}`}><span className={styles.eyebrowDot} /> How it works</div>
          <h2 className={`${styles.sectionTitle} ${styles.reveal} ${styles.stagger1}`}>Three steps. Sixty seconds. Real&nbsp;data.</h2>
          <p className={`${styles.sectionLede} ${styles.reveal} ${styles.stagger2}`}>Nothing to install. Nothing to configure. No demo call. Your score is generated from real platform data, the moment you connect.</p>
          <div className={styles.howGrid}>
            <div className={`${styles.howStep} ${styles.reveal} ${styles.stagger1}`}>
              <div className={styles.howStepNum}>01 &middot; Connect</div>
              <div className={`${styles.howVisual} ${styles.visual1}`}>
                <div className={styles.v1Mock}>
                  <div className={styles.v1Url}>youtube.com/@mugofchaos</div>
                  <div className={styles.v1Btn}>Connect</div>
                </div>
              </div>
              <h3 className={styles.howStepTitle}>Paste your channel.</h3>
              <p>YouTube or Twitch, read-only. We pull subscriber count, growth velocity, engagement, uploads, watch time, and audience geography. One click. Nothing stored that you haven&rsquo;t explicitly agreed to.</p>
            </div>
            <div className={`${styles.howStep} ${styles.reveal} ${styles.stagger2}`}>
              <div className={`${styles.howStepNum} ${styles.howStepPeach}`}>02 &middot; Score</div>
              <div className={`${styles.howVisual} ${styles.visual2}`}>
                <div className={styles.v2Bars}>
                  <div className={styles.bar1} /><div className={styles.bar2} /><div className={styles.bar3} />
                  <div className={styles.bar4} /><div className={styles.bar5} /><div className={styles.bar6} />
                </div>
              </div>
              <h3 className={styles.howStepTitle}>Get your six-dimension read.</h3>
              <p>We score your channel across the six things brands actually evaluate. Each dimension carries its own weight and confidence level. No &ldquo;creator score out of ten&rdquo; black box &mdash; you see the maths.</p>
            </div>
            <div className={`${styles.howStep} ${styles.reveal} ${styles.stagger3}`}>
              <div className={`${styles.howStepNum} ${styles.howStepMint}`}>03 &middot; Act</div>
              <div className={`${styles.howVisual} ${styles.visual3}`}>
                <div className={styles.v3Card}><div className={styles.v3Check} /> Film 3 shorts per week</div>
                <div className={`${styles.v3Card} ${styles.v3CardB}`}><div className={styles.v3Check} /> Tag audience niche</div>
                <div className={styles.v3Card}><div className={styles.v3Check} /> Pitch 5 matched brands</div>
              </div>
              <h3 className={styles.howStepTitle}>Close the gap.</h3>
              <p>Weekly tasks generated from the specific dimensions holding you back &mdash; not generic &ldquo;grow your channel&rdquo; advice. Concrete actions. Measurable progress. Your score moves as you work.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 04 — Live demo */}
      <section ref={demoRef} className={`${styles.section} ${demoVisible ? styles.visible : ''}`}>
        <div className={styles.container}>
          <div className={styles.demoHead}>
            <div>
              <div className={`${styles.eyebrow} ${styles.reveal}`}><span className={styles.eyebrowDot} /> See what your score looks like</div>
              <h2 className={`${styles.sectionTitle} ${styles.reveal} ${styles.stagger1}`}>Six dimensions.<br/>One clear read.</h2>
            </div>
            <div className={`${styles.demoHeadRight} ${styles.reveal} ${styles.stagger2}`}>
              <p>This is the Creatrbase profile you&rsquo;ll see after connecting your channel. The data below is illustrative, not a real creator &mdash; your own numbers will replace it when you score your channel.</p>
            </div>
          </div>
          <div className={styles.demoCanvas}>
            <span className={styles.demoIllustrative}>Illustrative data &middot; not a real creator</span>
            <div className={styles.demoTabs}>
              {[
                { key: 'score', label: 'Score' },
                { key: 'peers', label: 'Peer comparison' },
                { key: 'gap', label: 'Gap tracker' },
                { key: 'brands', label: 'Brand matches' },
              ].map(t => (
                <button key={t.key} className={`${styles.demoTab} ${demoTab === t.key ? styles.demoTabActive : ''}`} onClick={() => setDemoTab(t.key)}>{t.label}</button>
              ))}
            </div>

            {/* Score tab */}
            {demoTab === 'score' && (
            <div className={styles.demoInner}>
              <div className={styles.demoLeft}>
                <h4 className={styles.demoCreator}>Dave Does Dishes</h4>
                <div className={styles.demoHandle}>@davedoesdishes &middot; Lifestyle &middot; UK &middot; 12,834 subs</div>
                <div className={styles.demoStats}>
                  <div className={styles.demoStatCard}><div className={styles.demoStatLabel}>Score</div><div className={styles.demoStatValue}>52</div><div className={styles.demoStatDelta}>+4 past 90 days</div></div>
                  <div className={styles.demoStatCard}><div className={styles.demoStatLabel}>Tier</div><div className={styles.demoStatValue}>Viable</div><div className={styles.demoStatDelta}>Just entered</div></div>
                  <div className={styles.demoStatCard}><div className={styles.demoStatLabel}>Engagement</div><div className={styles.demoStatValue}>3.1<span style={{fontSize:'18px'}}>%</span></div><div className={styles.demoStatDelta}>+0.2 past 30 days</div></div>
                  <div className={styles.demoStatCard}><div className={styles.demoStatLabel}>Geo mix</div><div className={styles.demoStatValue}>UK 64</div><div className={styles.demoStatDelta}>+US 18 +CA 6</div></div>
                </div>
                <a href="#score" className={styles.btnPeach}>See the six-dimension breakdown &rarr;</a>
              </div>
              <div className={styles.demoRight}>
                {[
                  { name: 'Subscriber momentum', score: 58, w: '58%', color: 'mint' },
                  { name: 'Engagement quality', score: 64, w: '64%', color: 'mint' },
                  { name: 'Niche commercial value', score: 42, w: '42%', color: 'peach' },
                  { name: 'Audience geo alignment', score: 71, w: '71%', color: 'mint' },
                  { name: 'Content consistency', score: 49, w: '49%', color: 'lav' },
                  { name: 'Content brand alignment', score: 38, w: '38%', color: 'peach' },
                ].map(d => (
                  <div className={styles.demoRow} key={d.name}>
                    <div className={`${styles.demoRowDot} ${styles['dot' + d.color]}`} />
                    <div className={styles.demoRowName}>{d.name}</div>
                    <div className={styles.demoRowBar}><div className={`${styles.demoRowFill} ${styles['fill' + d.color]}`} style={{ width: d.w }} /></div>
                    <div className={styles.demoRowNum}>{d.score}</div>
                  </div>
                ))}
              </div>
            </div>
            )}

            {/* Peer comparison tab */}
            {demoTab === 'peers' && (
            <div className={styles.demoInner}>
              <div className={styles.demoLeft}>
                <h4 className={styles.demoCreator}>Dave Does Dishes</h4>
                <div className={styles.demoHandle}>@davedoesdishes &middot; Lifestyle &middot; UK &middot; 12,834 subs</div>
                <div className={styles.demoStats}>
                  <div className={styles.demoStatCard}><div className={styles.demoStatLabel}>Your score</div><div className={styles.demoStatValue}>52</div><div className={styles.demoStatDelta}>Viable tier</div></div>
                  <div className={styles.demoStatCard}><div className={styles.demoStatLabel}>Tier median</div><div className={styles.demoStatValue}>48</div><div className={styles.demoStatDelta}>Lifestyle &middot; UK</div></div>
                  <div className={styles.demoStatCard}><div className={styles.demoStatLabel}>Percentile</div><div className={styles.demoStatValue}>62<span style={{fontSize:'18px'}}>nd</span></div><div className={styles.demoStatDelta}>In your niche</div></div>
                  <div className={styles.demoStatCard}><div className={styles.demoStatLabel}>Rank</div><div className={styles.demoStatValue}>#38</div><div className={styles.demoStatDelta}>of 164 in tier</div></div>
                </div>
                <a href="#score" className={styles.btnPeach}>Score my channel &rarr;</a>
              </div>
              <div className={styles.demoRight}>
                {[
                  { name: 'Subscriber momentum', you: 58, peer: 51 },
                  { name: 'Engagement quality', you: 64, peer: 55 },
                  { name: 'Niche commercial value', you: 42, peer: 46 },
                  { name: 'Audience geo alignment', you: 71, peer: 60 },
                  { name: 'Content consistency', you: 49, peer: 52 },
                  { name: 'Content brand alignment', you: 38, peer: 41 },
                ].map(d => (
                  <div className={styles.peerRow} key={d.name}>
                    <div className={styles.peerRowName}>{d.name}</div>
                    <div className={styles.peerBars}>
                      <div className={styles.peerBarTrack}><div className={styles.peerBarYou} style={{ width: d.you + '%' }} /><span className={styles.peerBarLabel}>{d.you}</span></div>
                      <div className={styles.peerBarTrack}><div className={styles.peerBarPeer} style={{ width: d.peer + '%' }} /><span className={styles.peerBarLabel}>{d.peer}</span></div>
                    </div>
                  </div>
                ))}
                <div className={styles.peerLegend}><span className={styles.peerLegYou} /> You <span className={styles.peerLegPeer} /> Tier median</div>
              </div>
            </div>
            )}

            {/* Gap tracker tab */}
            {demoTab === 'gap' && (
            <div className={styles.demoInner}>
              <div className={styles.demoLeft}>
                <h4 className={styles.demoCreator}>Dave Does Dishes</h4>
                <div className={styles.demoHandle}>@davedoesdishes &middot; Lifestyle &middot; UK &middot; 12,834 subs</div>
                <div className={styles.demoStats}>
                  <div className={styles.demoStatCard}><div className={styles.demoStatLabel}>Current</div><div className={styles.demoStatValue}>52</div><div className={styles.demoStatDelta}>Today</div></div>
                  <div className={styles.demoStatCard}><div className={styles.demoStatLabel}>Projected</div><div className={styles.demoStatValue}>61</div><div className={styles.demoStatDelta}>In 90 days</div></div>
                  <div className={styles.demoStatCard}><div className={styles.demoStatLabel}>Tasks done</div><div className={styles.demoStatValue}>4/7</div><div className={styles.demoStatDelta}>This week</div></div>
                  <div className={styles.demoStatCard}><div className={styles.demoStatLabel}>Top gap</div><div className={styles.demoStatValue}>Brand</div><div className={styles.demoStatDelta}>alignment</div></div>
                </div>
                <a href="#score" className={styles.btnPeach}>Score my channel &rarr;</a>
              </div>
              <div className={styles.demoRight}>
                <div className={styles.gapTask}><div className={styles.gapCheck} /><div><div className={styles.gapTaskTitle}>Film 3 shorts per week</div><div className={styles.gapTaskDim}>Content consistency &middot; +3 pts</div></div></div>
                <div className={styles.gapTask}><div className={styles.gapCheck} /><div><div className={styles.gapTaskTitle}>Tag audience niche in descriptions</div><div className={styles.gapTaskDim}>Brand alignment &middot; +2 pts</div></div></div>
                <div className={styles.gapTask}><div className={`${styles.gapCheck} ${styles.gapCheckDone}`} /><div><div className={`${styles.gapTaskTitle} ${styles.gapDone}`}>Update channel banner</div><div className={styles.gapTaskDim}>Brand alignment &middot; +1 pt</div></div></div>
                <div className={styles.gapTask}><div className={`${styles.gapCheck} ${styles.gapCheckDone}`} /><div><div className={`${styles.gapTaskTitle} ${styles.gapDone}`}>Publish 2 videos this week</div><div className={styles.gapTaskDim}>Content consistency &middot; +2 pts</div></div></div>
                <div className={styles.gapTask}><div className={styles.gapCheck} /><div><div className={styles.gapTaskTitle}>Pitch 5 matched brands</div><div className={styles.gapTaskDim}>Commercial value &middot; +4 pts</div></div></div>
              </div>
            </div>
            )}

            {/* Brand matches tab */}
            {demoTab === 'brands' && (
            <div className={styles.demoInner}>
              <div className={styles.demoLeft}>
                <h4 className={styles.demoCreator}>Dave Does Dishes</h4>
                <div className={styles.demoHandle}>@davedoesdishes &middot; Lifestyle &middot; UK &middot; 12,834 subs</div>
                <div className={styles.demoStats}>
                  <div className={styles.demoStatCard}><div className={styles.demoStatLabel}>Matches</div><div className={styles.demoStatValue}>12</div><div className={styles.demoStatDelta}>Active brands</div></div>
                  <div className={styles.demoStatCard}><div className={styles.demoStatLabel}>Fit score</div><div className={styles.demoStatValue}>78</div><div className={styles.demoStatDelta}>Top match avg</div></div>
                  <div className={styles.demoStatCard}><div className={styles.demoStatLabel}>Est. rate</div><div className={styles.demoStatValue}>&pound;340</div><div className={styles.demoStatDelta}>Per integration</div></div>
                  <div className={styles.demoStatCard}><div className={styles.demoStatLabel}>Window</div><div className={styles.demoStatValue}>Q2</div><div className={styles.demoStatDelta}>Active buying</div></div>
                </div>
                <a href="#score" className={styles.btnPeach}>Score my channel &rarr;</a>
              </div>
              <div className={styles.demoRight}>
                {[
                  { brand: 'CleanCo UK', fit: 92, status: 'Active buyer', color: 'mint' },
                  { brand: 'Dettol Home', fit: 85, status: 'Buying window', color: 'mint' },
                  { brand: 'Method Products', fit: 78, status: 'Active buyer', color: 'lav' },
                  { brand: 'Scrub Daddy', fit: 74, status: 'Past buyer', color: 'lav' },
                  { brand: 'Astonish', fit: 68, status: 'New to niche', color: 'peach' },
                ].map(b => (
                  <div className={styles.brandRow} key={b.brand}>
                    <div className={styles.brandIcon}>{b.brand.charAt(0)}</div>
                    <div className={styles.brandInfo}><div className={styles.brandName}>{b.brand}</div><div className={styles.brandStatus}>{b.status}</div></div>
                    <div className={`${styles.brandFit} ${styles['brandFit' + b.color.charAt(0).toUpperCase() + b.color.slice(1)]}`}>{b.fit}% fit</div>
                  </div>
                ))}
              </div>
            </div>
            )}
            <div className={styles.demoCta}>
              <p>This is the view after connecting a channel. <b>Yours is sixty seconds away.</b></p>
              <a href="#score" className={styles.btnMint}>Score my channel &rarr;</a>
            </div>
          </div>
        </div>
      </section>

      {/* 05 — Six dimensions */}
      <section ref={dimsRef} className={`${styles.section} ${styles.sectionAlt} ${dimsVisible ? styles.visible : ''}`} id="dimensions">
        <div className={styles.container}>
          <div className={`${styles.eyebrow} ${styles.eyebrowLav} ${styles.reveal}`}><span className={styles.eyebrowDot} /> The six dimensions</div>
          <h2 className={`${styles.sectionTitle} ${styles.reveal} ${styles.stagger1}`}>What brands actually evaluate.</h2>
          <p className={`${styles.sectionLede} ${styles.reveal} ${styles.stagger2}`}>Every score is a weighted composite of six things brands look at before they commit a budget. Not a black box. Not &ldquo;engagement rate good&rdquo;. The actual maths.</p>
          <div className={styles.dimsGrid}>
            {DIMS.map((d, i) => (
              <div key={i} className={`${styles.dimCard} ${styles.reveal} ${styles['stagger' + ((i % 3) + 1)]}`}>
                <div className={`${styles.dimCardEyebrow} ${d.color ? styles['dimCardEyebrow' + d.color.charAt(0).toUpperCase() + d.color.slice(1)] : ''}`}>{d.eyebrow}</div>
                <h3 className={styles.dimCardTitle}>{d.title}</h3>
                <p>{d.desc}</p>
                <div className={styles.dimCardWeight}><span>Weighting</span><b>{d.weight}</b></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 06 — Score tiers */}
      <section ref={tiersRef} className={`${styles.section} ${tiersVisible ? styles.visible : ''}`}>
        <div className={styles.container}>
          <div className={`${styles.eyebrow} ${styles.eyebrowPeach} ${styles.reveal}`}><span className={styles.eyebrowDot} /> Score tiers</div>
          <h2 className={`${styles.sectionTitle} ${styles.reveal} ${styles.stagger1}`}>Four tiers. Each with a different next step.</h2>
          <p className={`${styles.sectionLede} ${styles.reveal} ${styles.stagger2}`}>The tier you sit in determines what brands will and won&rsquo;t consider right now &mdash; and what work actually moves you up.</p>
          <div className={styles.tiersGrid}>
            {TIERS.map((t, i) => (
              <div key={i} className={`${styles.tierCard} ${styles.reveal} ${styles['stagger' + ((i % 3) + 1)]}`}>
                <div className={styles.tierRange}>{t.range}</div>
                <h3 className={styles.tierName}>{t.name}</h3>
                <p>{t.desc}</p>
                <div className={styles.tierStrip}><div className={styles.tierStripFill} style={{ width: t.fill + '%', background: `var(--lp-${t.color})` }} /></div>
                <div className={styles.tierLabel}><span>0</span><span>100</span></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 07 — Honesty principle */}
      <section ref={honestyRef} className={`${styles.honesty} ${honestyVisible ? styles.visible : ''}`}>
        <div className={styles.container}>
          <div className={`${styles.eyebrow} ${styles.eyebrowDark} ${styles.reveal}`}><span className={styles.eyebrowDot} /> The honesty principle</div>
          <h2 className={`${styles.sectionTitle} ${styles.reveal} ${styles.stagger1}`}>We tell you what we don&rsquo;t know.</h2>
          <p className={`${styles.sectionLede} ${styles.honestyLede} ${styles.reveal} ${styles.stagger2}`}>Every output carries a confidence level. Every estimate is labelled as an estimate. Where the data is thin, we say so &mdash; and we show you how to make it better.</p>
          <div className={styles.honestyGrid}>
            <div className={`${styles.honestyCard} ${styles.reveal} ${styles.stagger1}`}>
              <div className={`${styles.honestyLabel} ${styles.honestyLabelMint}`}>High confidence</div>
              <h3>Direct, unhedged.</h3>
              <p>When the data is clean and the calculation is deterministic, we state the result plainly. No &ldquo;might&rdquo; or &ldquo;could be.&rdquo; Just the number.</p>
              <div className={`${styles.honestyQuote} ${styles.honestyQuoteMint}`}>&ldquo;Your engagement rate is above the benchmark for your niche and tier. You are in the 72nd percentile.&rdquo;</div>
            </div>
            <div className={`${styles.honestyCard} ${styles.reveal} ${styles.stagger2}`}>
              <div className={`${styles.honestyLabel} ${styles.honestyLabelPeach}`}>Medium confidence</div>
              <h3>Directional, with basis.</h3>
              <p>When we&rsquo;re inferring from signals rather than facts, we tell you what we inferred and from what. You can see the shape of the reasoning.</p>
              <div className={`${styles.honestyQuote} ${styles.honestyQuotePeach}`}>&ldquo;Based on 90 days of observed brand activity in your niche, this brand appears to be in an active buying window.&rdquo;</div>
            </div>
            <div className={`${styles.honestyCard} ${styles.reveal} ${styles.stagger3}`}>
              <div className={`${styles.honestyLabel} ${styles.honestyLabelLav}`}>Low confidence</div>
              <h3>Estimated, with invitation.</h3>
              <p>When we don&rsquo;t have enough data, we say so directly. And we show you how contributing your own data improves the model for every creator in your position.</p>
              <div className={`${styles.honestyQuote} ${styles.honestyQuoteLav}`}>&ldquo;We have limited deal data for this brand in your niche. This estimate is directional. If you&rsquo;ve worked with them, share the rate and we&rsquo;ll sharpen the model.&rdquo;</div>
            </div>
          </div>
        </div>
      </section>

      {/* 08 — For whom */}
      <section ref={whomRef} className={`${styles.section} ${styles.sectionAlt} ${whomVisible ? styles.visible : ''}`}>
        <div className={styles.container}>
          <div className={`${styles.eyebrow} ${styles.eyebrowLav} ${styles.reveal}`}><span className={styles.eyebrowDot} /> For whom</div>
          <h2 className={`${styles.sectionTitle} ${styles.reveal} ${styles.stagger1}`}>Built for the creator who&rsquo;s been doing this alone.</h2>
          <p className={`${styles.sectionLede} ${styles.reveal} ${styles.stagger2}`}>We designed Creatrbase for the independent creator in the 1k&ndash;100k range. Not agencies. Not mega-creators. People who are building real audiences and deserve real infrastructure.</p>
          <div className={styles.whomGrid}>
            {[
              { name: 'The Stuck Climber', sub: '8\u201330k subs \u00b7 Growing', quote: '\u201cI\u2019m growing. I\u2019m engaged. But every time I pitch a brand I\u2019m guessing what they\u2019ll care about. Creatrbase gave me the frame to stop guessing.\u201d', tags: ['Lifestyle','UK','YouTube','Weekly uploads'], color: 'lav', img: '/brand/persona-climber.png' },
              { name: 'The Twitch Strategist', sub: '3\u201320k followers \u00b7 Affiliate', quote: '\u201cBrands on Twitch are different. Most tools were built for YouTube and treated me as an afterthought. Creatrbase scored me on Twitch terms.\u201d', tags: ['Gaming','US + UK','Twitch','Affiliate'], color: 'peach', img: '/brand/persona-twitch.png' },
              { name: 'The Full-Time Solo', sub: '30\u2013100k subs \u00b7 Established', quote: '\u201cI\u2019ve signed with agencies before. I wanted to know if I could do better solo. Creatrbase showed me my real rate range \u2014 and I stopped leaving money on the table.\u201d', tags: ['Wellness','UK','YouTube','Full-time'], color: 'mint', img: '/brand/persona-solo.png' },
            ].map((p, i) => (
              <div key={i} className={`${styles.whomCard} ${styles.reveal} ${styles['stagger' + (i + 1)]}`}>
                <div className={`${styles.whomPhoto} ${styles['whomPhoto' + p.color.charAt(0).toUpperCase() + p.color.slice(1)]}`}>
                  <img src={p.img} alt={p.name} className={styles.whomPhotoImg} />
                </div>
                <div className={styles.whomBody}>
                  <div className={styles.whomName}>{p.name}</div>
                  <div className={styles.whomSub}>{p.sub}</div>
                  <p className={styles.whomQuote}>{p.quote}</p>
                  <div className={styles.whomTags}>{p.tags.map(t => <span key={t} className={styles.whomTag}>{t}</span>)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 09 — Pricing */}
      <section ref={pricingRef} className={`${styles.section} ${pricingVisible ? styles.visible : ''}`} id="pricing">
        <div className={styles.container}>
          <div className={`${styles.eyebrow} ${styles.reveal}`}><span className={styles.eyebrowDot} /> Pricing</div>
          <h2 className={`${styles.sectionTitle} ${styles.reveal} ${styles.stagger1}`}>Simple, honest pricing.</h2>
          <p className={`${styles.sectionLede} ${styles.reveal} ${styles.stagger2}`}>Score your channel free. Upgrade if you want the tools that close the gap. No &ldquo;contact us,&rdquo; no enterprise tier, no upsell funnels.</p>
          <div className={`${styles.pricingNote} ${styles.reveal} ${styles.stagger2}`}>The free score is free forever. No card, no timer.</div>
          <div className={styles.pricingGrid}>
            <div className={`${styles.priceCard} ${styles.reveal} ${styles.stagger1}`}>
              <div className={styles.priceTier}>Free</div>
              <h3 className={styles.priceTitle}>Score</h3>
              <div className={styles.priceAmount}><span className={styles.priceNum}>&pound;0</span><span className={styles.pricePeriod}>forever &middot; no card</span></div>
              <ul className={styles.priceList}>
                <li>Full Commercial Viability Score</li>
                <li>All six dimensions, with weightings</li>
                <li>Confidence levels on every result</li>
                <li>Share your score card publicly</li>
                <li>Weekly refresh, for as long as you want</li>
              </ul>
              <div className={styles.priceUpgradeNote}>Need the task engine or brand outreach? See <b>Core</b> and <b>Full stack</b> &rarr;</div>
              <a href="#score" className={styles.btnPrimary}>Score my channel &rarr;</a>
            </div>
            <div className={`${styles.priceCard} ${styles.priceCardFeatured} ${styles.reveal} ${styles.stagger2}`}>
              <div className={styles.priceBadge}>Most chosen</div>
              <div className={styles.priceTier}>Core</div>
              <h3 className={styles.priceTitle}>Gap tracker</h3>
              <div className={styles.priceAmount}><span className={styles.priceNum}>&pound;9.99</span><span className={styles.pricePeriod}>/ month</span></div>
              <ul className={styles.priceList}>
                <li>Everything in Free</li>
                <li>Task engine &mdash; weekly gap-closing tasks</li>
                <li>Projection view &mdash; your score in 90 days</li>
                <li>Peer benchmarking against your tier</li>
                <li>Audience demographics deep-dive</li>
                <li>Milestone alerts on every dimension</li>
                <li>Historical tracking, all metrics</li>
              </ul>
              <Link to="/signup" className={styles.btnMint}>Start 14-day trial &rarr;</Link>
            </div>
            <div className={`${styles.priceCard} ${styles.reveal} ${styles.stagger3}`}>
              <div className={styles.priceTier}>Pro</div>
              <h3 className={styles.priceTitle}>Full stack</h3>
              <div className={styles.priceAmount}><span className={styles.priceNum}>&pound;19.99</span><span className={styles.pricePeriod}>/ month</span></div>
              <ul className={styles.priceList}>
                <li>Everything in Core</li>
                <li>Brand outreach agent</li>
                <li>Drafted pitch emails in your voice</li>
                <li>Rate intelligence for your tier</li>
                <li>Follow-up sequences, auto-scheduled</li>
                <li>Media kit generator</li>
                <li>Contract review helper</li>
              </ul>
              <Link to="/signup" className={styles.btnPeachBtn}>Start 14-day trial &rarr;</Link>
            </div>
          </div>
        </div>
      </section>

      {/* 10 — FAQ */}
      <section ref={faqRef} className={`${styles.section} ${styles.sectionAlt} ${faqVisible ? styles.visible : ''}`}>
        <div className={styles.container}>
          <div className={`${styles.eyebrow} ${styles.eyebrowPeach} ${styles.reveal}`}><span className={styles.eyebrowDot} /> Questions</div>
          <h2 className={`${styles.sectionTitle} ${styles.reveal} ${styles.stagger1}`}>Things people ask before signing up.</h2>
          <div className={styles.faqGrid}>
            {FAQS.map((f, i) => (
              <div key={f.id} className={`${styles.faqItem} ${styles.reveal} ${styles['stagger' + ((i % 3) + 1)]}`} onClick={() => logSignal('faq_open', { question: f.id })}>
                <h4>{f.q}</h4>
                <p>{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 11 — Final CTA */}
      <section ref={ctaRef} className={`${styles.finalCta} ${ctaVisible ? styles.visible : ''}`}>
        <div className={styles.finalGrid}>
          <div>
            <h2 className={styles.finalTitle}>Know where you stand.<br/><em>For free.</em><br/>In under a minute.</h2>
            <p className={styles.finalLede}>Paste your channel. Get your score. Decide what you want to do with it. We&rsquo;ll be here either way.</p>
            <BrandCheck />
          </div>
          <div className={styles.finalRight}>
            <div className={styles.finalStickers}>
              <span className={styles.stickerChip}>No signup &middot; no card</span>
              <span className={`${styles.stickerChip} ${styles.stickerPeach}`}>~45 seconds</span>
              <span className={`${styles.stickerChip} ${styles.stickerMint}`}>Free forever</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerGrid}>
          <div className={styles.footerBrand}>
            <Link to="/"><img src="/brand/wordmark-light.png" alt="Creatrbase" className={styles.footerLogo} /></Link>
            <p className={styles.footerTag}>Commercial intelligence for independent creators on YouTube and Twitch. Built in the UK.</p>
          </div>
          <div>
            <h5 className={styles.footerColTitle}>Product</h5>
            <ul className={styles.footerLinks}><li><a href="#score">Score</a></li><li><a href="#how-it-works">How it works</a></li><li><a href="#dimensions">The six dimensions</a></li><li><a href="#pricing">Pricing</a></li></ul>
          </div>
          <div>
            <h5 className={styles.footerColTitle}>Learn</h5>
            <ul className={styles.footerLinks}><li><Link to="/blog">Blog</Link></li><li><Link to="/scoring-explained">Scoring methodology</Link></li></ul>
          </div>
          <div>
            <h5 className={styles.footerColTitle}>Company</h5>
            <ul className={styles.footerLinks}><li><Link to="/privacy">Privacy</Link></li><li><Link to="/terms">Terms</Link></li></ul>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <span>&copy; 2026 Creatrbase &middot; Built with honesty</span>
          <span>v1.0 &middot; April 2026</span>
        </div>
      </footer>
    </div>
  );
}
