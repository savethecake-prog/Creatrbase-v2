import { Link } from 'react-router-dom';
import { PublicNav } from '../../components/PublicNav/PublicNav';
import { PageMeta } from '../../components/PageMeta/PageMeta';
import styles from './ScoringMethodology.module.css';

const DIMENSIONS = [
  {
    name: 'Audience Momentum',
    weight: 25,
    description:
      'Growth velocity over the last 30 and 90 days. Brands pay a premium for creators on an upward trajectory — a growing audience signals untapped reach that a static one does not.',
    signals: ['Subscriber / follower growth rate', '30-day vs 90-day growth delta', 'Recent upload cadence vs historical average'],
  },
  {
    name: 'Engagement Quality',
    weight: 20,
    description:
      'Engagement rate adjusted for audience size. Raw engagement inflates for small accounts; we normalise against channel size to surface whether your audience is genuinely active.',
    signals: ['Engagement rate (30-day average)', 'Comment-to-view ratio', 'Average watch time where available'],
  },
  {
    name: 'Niche Clarity',
    weight: 20,
    description:
      'How well your content maps to a commercially recognised category. Brands need to know exactly who they are reaching. Unfocused content is harder to monetise regardless of reach.',
    signals: ['Primary content category confidence', 'Topic consistency across recent uploads', 'Cross-platform niche alignment'],
  },
  {
    name: 'Geographic Fit',
    weight: 15,
    description:
      'Audience location relative to your primary commercial market. Most direct-to-consumer brands target specific regions; audiences concentrated in high-CPM markets carry more commercial value.',
    signals: ['Primary audience country', 'Concentration in Tier-1 markets (UK, US, CA, AU)', 'Secondary market spread'],
  },
  {
    name: 'Posting Consistency',
    weight: 10,
    description:
      'How reliably you publish against your own historical cadence. Brands want creators who will deliver on contracted timelines — irregular posting is a risk signal.',
    signals: ['Uploads per week vs 90-day average', 'Gap between last three uploads', 'Consistency across connected platforms'],
  },
  {
    name: 'Brand Alignment',
    weight: 10,
    description:
      'Compatibility between your content categories and brand-friendly verticals. Some niches attract significantly more brand spend; alignment to those verticals increases commercial viability.',
    signals: ['Category fit to high-spend verticals', 'Absence of brand-risk content patterns', 'Existing partnership history'],
  },
];

const TIERS = [
  {
    id: 'pre_commercial',
    label: 'Pre-Commercial',
    range: '0–39',
    color: 'var(--text-tertiary)',
    description:
      'Foundation-building phase. The score reflects gaps in reach, consistency, or niche clarity. Tasks at this tier focus on closing those gaps before brand conversations are likely to convert.',
  },
  {
    id: 'emerging',
    label: 'Emerging',
    range: '40–59',
    color: 'var(--neon-peach, #E8874C)',
    description:
      'You have traction but inconsistencies remain. Brands may gift at this tier but paid deals require more proof points. Tasks focus on sharpening engagement and stabilising momentum.',
  },
  {
    id: 'viable',
    label: 'Viable',
    range: '60–79',
    color: 'var(--neon-lavender, #D1B9FF)',
    description:
      'Commercially competitive. Paid sponsorships are realistic at this tier. Outreach to mid-market brands is likely to receive genuine responses. Gap tracking becomes the primary focus.',
  },
  {
    id: 'established',
    label: 'Established',
    range: '80–100',
    color: 'var(--neon-mint)',
    description:
      'Fully commercial. You have the audience quality, consistency, and niche authority that agencies are built around. Outreach at this tier should focus on deal terms, not qualification.',
  },
];

const MILESTONES = [
  { label: 'First Sync', description: 'Platform connected and analysed. Baseline score set.' },
  { label: 'Score 40+', description: 'Reached the Emerging tier. Gifting opportunities open.' },
  { label: 'Score 60+', description: 'Reached the Viable tier. Paid sponsorships become realistic.' },
  { label: 'First Deal Logged', description: 'A brand conversation has been tracked in your pipeline.' },
  { label: 'Score 80+', description: 'Reached the Established tier. Full commercial viability confirmed.' },
];

export function ScoringMethodology() {
  return (
    <div className={styles.page}>
      <PageMeta
        title="How Your Score Is Calculated"
        description="The Commercial Viability Score measures six dimensions of brand-readiness across momentum, engagement, niche, geography, consistency, and brand alignment."
        canonical="https://creatrbase.com/scoring-explained"
      />

      <PublicNav />

      <main className={styles.main}>

        {/* Hero */}
        <header className={styles.hero}>
          <p className={styles.eyebrow}>Methodology</p>
          <h1 className={styles.heroTitle}>How your score is calculated</h1>
          <p className={styles.heroDesc}>
            The Commercial Viability Score (CVS) is a single number that summarises how
            brand-ready your channel is right now. It is derived from six weighted dimensions,
            each targeting a factor that brands and agencies evaluate when making partnership decisions.
          </p>
        </header>

        {/* Score overview */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>The six dimensions</h2>
          <p className={styles.sectionIntro}>
            Each dimension is scored independently and then combined into your overall CVS using the
            weights below. The total always sums to 100.
          </p>

          <div className={styles.dimensionGrid}>
            {DIMENSIONS.map(dim => (
              <div key={dim.name} className={styles.dimensionCard}>
                <div className={styles.dimensionHeader}>
                  <span className={styles.dimensionName}>{dim.name}</span>
                  <span className={styles.dimensionWeight}>{dim.weight}%</span>
                </div>
                <div className={styles.dimensionBar}>
                  <div className={styles.dimensionBarFill} style={{ width: `${dim.weight * 4}%` }} />
                </div>
                <p className={styles.dimensionDesc}>{dim.description}</p>
                <ul className={styles.signalList}>
                  {dim.signals.map(s => (
                    <li key={s} className={styles.signalItem}>{s}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Tiers */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Score tiers</h2>
          <p className={styles.sectionIntro}>
            Your overall CVS maps to one of four tiers. Each tier represents a distinct stage of
            commercial readiness and determines which features and recommendations are active for you.
          </p>

          <div className={styles.tierList}>
            {TIERS.map(tier => (
              <div key={tier.id} className={styles.tierRow}>
                <div className={styles.tierLeft}>
                  <span className={styles.tierLabel} style={{ color: tier.color }}>{tier.label}</span>
                  <span className={styles.tierRange}>{tier.range}</span>
                </div>
                <p className={styles.tierDesc}>{tier.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Milestones */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Milestones</h2>
          <p className={styles.sectionIntro}>
            Five milestones mark key progress points on your commercial journey. Reaching a milestone
            unlocks new recommendations and triggers a notification.
          </p>

          <ol className={styles.milestoneList}>
            {MILESTONES.map((m, i) => (
              <li key={m.label} className={styles.milestoneItem}>
                <span className={styles.milestoneNum}>{i + 1}</span>
                <div>
                  <p className={styles.milestoneLabel}>{m.label}</p>
                  <p className={styles.milestoneDesc}>{m.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* How it updates */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>How your score updates</h2>
          <div className={styles.updateFlow}>
            {['Platform sync runs', 'Raw metrics collected', 'Six dimensions scored', 'CVS recalculated', 'Tasks regenerated'].map((step, i, arr) => (
              <div key={step} className={styles.flowStep}>
                <span className={styles.flowDot} />
                <span className={styles.flowLabel}>{step}</span>
                {i < arr.length - 1 && <span className={styles.flowArrow}>→</span>}
              </div>
            ))}
          </div>
          <p className={styles.updateNote}>
            Your score recalculates automatically after every platform sync. Syncs run on the schedule
            you configured, or you can trigger a manual sync from the Dashboard. Score history is retained
            so you can track progress week-over-week.
          </p>
        </section>

        {/* CTA */}
        <section className={styles.ctaSection}>
          <p className={styles.ctaTitle}>See your score now</p>
          <p className={styles.ctaDesc}>Connect your channels and get your Commercial Viability Score in under two minutes.</p>
          <Link to="/signup" className={styles.ctaBtn}>Get started free</Link>
        </section>

      </main>

      <footer className={styles.footer}>
        <p className={styles.footerText}>
          &copy; {new Date().getFullYear()} Creatrbase &mdash;{' '}
          <Link to="/privacy" className={styles.footerLink}>Privacy</Link>{' '}
          &middot;{' '}
          <Link to="/terms" className={styles.footerLink}>Terms</Link>
        </p>
      </footer>
    </div>
  );
}
