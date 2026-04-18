import { Link } from 'react-router-dom';
import { PublicNav } from '../../components/PublicNav/PublicNav';
import { MarketingFooter } from '../../components/MarketingFooter/MarketingFooter';
import { PageMeta } from '../../components/PageMeta/PageMeta';
import styles from './ScoringMethodology.module.css';

const DIM_COLOURS = ['', 'peach', 'mint', '', 'peach', 'mint'];

const DIMENSIONS = [
  {
    name: 'Subscriber momentum',
    eyebrow: 'Growth signal',
    weight: 25,
    description:
      'Velocity beats volume. A channel growing 200/day is worth more to a brand than a flat channel with twice the subs. We measure both the rate and the consistency.',
    whyBrands: 'Brands pay a premium for creators on an upward trajectory — a growing audience signals untapped reach that a static one does not.',
    howCalc: 'Subscriber growth rate over 30 and 90 days, normalised against channel size. A 10k-sub channel growing at 2%/week scores higher than a 100k channel growing at 0.1%.',
    signals: ['Subscriber / follower growth rate', '30-day vs 90-day growth delta', 'Recent upload cadence vs historical average'],
  },
  {
    name: 'Engagement quality',
    eyebrow: 'Audience signal',
    weight: 20,
    description:
      'Raw engagement rate is a vanity metric. We look at view-to-subscriber ratio, comment-to-like balance, and whether the audience actually shows up.',
    whyBrands: 'Brands want proof that an audience is active, not just subscribed. High engagement signals real influence and conversion potential.',
    howCalc: 'Engagement rate adjusted for audience size, combined with comment-to-view ratio and average watch time where available.',
    signals: ['Engagement rate (30-day average)', 'Comment-to-view ratio', 'Average watch time where available'],
  },
  {
    name: 'Niche commercial value',
    eyebrow: 'Commercial signal',
    weight: 20,
    description:
      'Not every niche is worth the same. Gaming hardware, beauty, finance, and fitness command different CPMs and different brand budgets.',
    whyBrands: 'Brand budgets are allocated by category. A creator in finance or beauty is worth more per impression than one in a low-CPM niche.',
    howCalc: 'Category classification confidence score multiplied by the niche\'s weighted CPM index, calibrated quarterly against live brand-spend data.',
    signals: ['Primary content category confidence', 'Topic consistency across recent uploads', 'Cross-platform niche alignment'],
  },
  {
    name: 'Audience geo alignment',
    eyebrow: 'Audience signal',
    weight: 15,
    description:
      'A UK-and-US audience is worth more to most brand briefs than a global spread. We score your Tier 1 geography mix against what brands are actually buying.',
    whyBrands: 'Most DTC brands target specific regions. Audiences concentrated in high-CPM markets (UK, US, CA, AU) carry significantly more commercial value.',
    howCalc: 'Percentage of audience in Tier 1 markets weighted by the brand-spend distribution for your niche.',
    signals: ['Primary audience country', 'Concentration in Tier-1 markets (UK, US, CA, AU)', 'Secondary market spread'],
  },
  {
    name: 'Content consistency',
    eyebrow: 'Production signal',
    weight: 10,
    description:
      'Brands check your upload cadence before they check anything else. We score frequency, reliability, and whether you can hit a campaign window.',
    whyBrands: 'Irregular posting is a risk signal. Brands need confidence that a creator will deliver on contracted timelines.',
    howCalc: 'Uploads per week compared against your own 90-day average. Consistency of gaps between uploads, penalising long silences.',
    signals: ['Uploads per week vs 90-day average', 'Gap between last three uploads', 'Consistency across connected platforms'],
  },
  {
    name: 'Content brand alignment',
    eyebrow: 'Readiness signal',
    weight: 10,
    description:
      'Have you integrated brand mentions before without it feeling forced? Do you already run affiliate links, product mentions, clean deliverables?',
    whyBrands: 'Creators who have done brand work before are lower-risk. This dimension measures brand-readiness, not just audience quality.',
    howCalc: 'Presence of prior brand integrations, affiliate links, sponsored content markers, and production quality signals across recent uploads.',
    signals: ['Category fit to high-spend verticals', 'Absence of brand-risk content patterns', 'Existing partnership history'],
  },
];

const TIERS = [
  { range: '0 – 24', name: 'Pre-Commercial', desc: 'Too early for most paid brand work. The focus is foundation: audience, niche clarity, cadence. Gifting partnerships are in play.', fill: 20, color: 'peach-shade' },
  { range: '25 – 49', name: 'Emerging', desc: "You'll close paid deals with small and mid-market brands who value niche fit over scale. Rates 30–50% below tier average.", fill: 40, color: 'peach-deep' },
  { range: '50 – 74', name: 'Viable', desc: 'Brand-ready. Agencies will engage, direct inbound is possible. Sustained rates start here. This is where most paid work gets signed.', fill: 66, color: 'mint-deep' },
  { range: '75 – 100', name: 'Established', desc: 'Premium-rate territory. Agencies compete for you. Long-term ambassadorships and retainers become the category, not one-offs.', fill: 92, color: 'mint-shade' },
];

export function ScoringMethodology() {
  return (
    <div className={styles.page}>
      <PageMeta
        title="Scoring methodology — Creatrbase"
        description="Every dimension, every weighting, every calibration. The full Creatrbase scoring methodology, in plain English. No black box."
        canonical="https://creatrbase.com/scoring-explained"
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'WebPage',
        name: 'Scoring Methodology', url: 'https://creatrbase.com/scoring-explained',
        description: 'The full Creatrbase scoring methodology, in plain English.',
        breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://creatrbase.com' },
          { '@type': 'ListItem', position: 2, name: 'Scoring Methodology', item: 'https://creatrbase.com/scoring-explained' },
        ] },
      }) }} />

      <PublicNav variant="v2" />

      <main className={styles.main}>
        <header className={styles.hero}>
          <span className={styles.eyebrow}><span className={styles.eyebrowDot} /> Methodology</span>
          <h1 className={styles.heroTitle}>How we score channels.</h1>
          <p className={styles.heroDesc}>
            The Commercial Viability Score is a single number that summarises how brand-ready your channel is right now. It is derived from six weighted dimensions, each targeting a factor that brands and agencies evaluate when making partnership decisions. Every dimension, every weighting, every calibration — in plain English.
          </p>
        </header>

        {/* Six dimensions */}
        <section className={styles.section}>
          <span className={`${styles.eyebrow} ${styles.eyebrowLav}`}><span className={styles.eyebrowDot} /> The six dimensions</span>
          <h2 className={styles.sectionTitle}>What brands actually evaluate.</h2>
          <p className={styles.sectionIntro}>
            Each dimension is scored independently and then combined into your overall CVS using the weights below. The total always sums to 100.
          </p>

          <div className={styles.dimsGrid}>
            {DIMENSIONS.map((dim, i) => (
              <div key={dim.name} className={styles.dimCard}>
                <div className={`${styles.dimCardEyebrow} ${DIM_COLOURS[i] ? styles['dimEyebrow' + DIM_COLOURS[i].charAt(0).toUpperCase() + DIM_COLOURS[i].slice(1)] : ''}`}>{dim.eyebrow}</div>
                <h3 className={styles.dimCardTitle}>{dim.name}</h3>
                <p className={styles.dimCardDesc}>{dim.description}</p>

                <div className={styles.dimDetail}>
                  <h4 className={styles.dimDetailLabel}>Why brands care</h4>
                  <p>{dim.whyBrands}</p>
                </div>
                <div className={styles.dimDetail}>
                  <h4 className={styles.dimDetailLabel}>How we calculate it</h4>
                  <p>{dim.howCalc}</p>
                </div>

                <div className={styles.dimPanel}>
                  <div className={styles.dimPanelHead}>
                    <span>Signals</span>
                    <span className={styles.dimPanelWeight}>{dim.weight}%</span>
                  </div>
                  <ul className={styles.signalList}>
                    {dim.signals.map(s => <li key={s}>{s}</li>)}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Tiers */}
        <section className={styles.section}>
          <span className={`${styles.eyebrow} ${styles.eyebrowPeach}`}><span className={styles.eyebrowDot} /> Score tiers</span>
          <h2 className={styles.sectionTitle}>Four tiers. Each with a different next step.</h2>
          <p className={styles.sectionIntro}>
            Your overall CVS maps to one of four tiers. Each tier represents a distinct stage of commercial readiness.
          </p>

          <div className={styles.tiersGrid}>
            {TIERS.map((t, i) => (
              <div key={i} className={styles.tierCard}>
                <div className={styles.tierRange}>{t.range}</div>
                <h3 className={styles.tierName}>{t.name}</h3>
                <p>{t.desc}</p>
                <div className={styles.tierStrip}><div className={styles.tierStripFill} style={{ width: t.fill + '%', background: `var(--lp-${t.color})` }} /></div>
                <div className={styles.tierLabel}><span>0</span><span>100</span></div>
              </div>
            ))}
          </div>
        </section>

        {/* How it updates */}
        <section className={styles.section}>
          <span className={styles.eyebrow}><span className={styles.eyebrowDot} /> How it updates</span>
          <h2 className={styles.sectionTitle}>Your score recalculates automatically.</h2>
          <div className={styles.updateFlow}>
            {['Platform sync runs', 'Raw metrics collected', 'Six dimensions scored', 'CVS recalculated', 'Tasks regenerated'].map((step, i, arr) => (
              <div key={step} className={styles.flowStep}>
                <span className={styles.flowDot} />
                <span className={styles.flowLabel}>{step}</span>
                {i < arr.length - 1 && <span className={styles.flowArrow}>&rarr;</span>}
              </div>
            ))}
          </div>
          <p className={styles.updateNote}>
            Syncs run on the schedule you configured, or you can trigger a manual sync from the Dashboard. Score history is retained so you can track progress week-over-week.
          </p>
        </section>

        {/* CTA */}
        <div className={styles.ctaSection}>
          <h2 className={styles.ctaTitle}>Score your channel now</h2>
          <p className={styles.ctaDesc}>Connect your channels and get your Commercial Viability Score in under sixty seconds.</p>
          <a href="/#score" className={styles.ctaBtn}>Get my score &rarr;</a>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
