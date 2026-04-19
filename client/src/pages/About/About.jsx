import { Link } from 'react-router-dom';
import { PublicNav } from '../../components/PublicNav/PublicNav';
import { MarketingFooter } from '../../components/MarketingFooter/MarketingFooter';
import { PageMeta } from '../../components/PageMeta/PageMeta';
import styles from './About.module.css';

const PRINCIPLES = [
  {
    icon: '01',
    heading: 'We show our working.',
    body: 'The scoring methodology is public, not behind a paywall. Every dimension, every weighting, every calibration change is documented at /scoring-explained.',
    accent: 'mint',
  },
  {
    icon: '02',
    heading: 'We say it plainly.',
    body: 'If a score drops, we tell you why. If we don\'t have the data, the field is empty rather than estimated. No hedging. No vanity.',
    accent: '',
  },
  {
    icon: '03',
    heading: 'We build for the person without an agent.',
    body: 'The platform is designed for creators who are negotiating alone, without a manager or agency in their corner. That means practical, actionable commercial data -- not just charts.',
    accent: 'peach',
  },
  {
    icon: '04',
    heading: 'We don\'t sell your data.',
    body: 'Not to brands, not to agencies, not to anyone. Full details on the honesty page.',
    accent: '',
  },
];

const orgSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Creatrbase',
  url: 'https://creatrbase.com',
  description: 'Commercial intelligence platform for YouTube and Twitch creators. Scores channels across 6 dimensions of commercial viability so creators can negotiate brand deals with the same information agencies already have.',
  foundingDate: '2025',
  sameAs: [],
};

export function About() {
  return (
    <div className={styles.page}>
      <PageMeta
        title="About Creatrbase — Creator commercial intelligence"
        description="Creatrbase was built by someone who worked inside an influencer marketing agency and watched micro creators get overlooked and underpaid. Here is why we built it and how we think."
        canonical="https://creatrbase.com/about"
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
      />

      <PublicNav variant="v2" />

      <main className={styles.main}>
        {/* ── Hero ── */}
        <header className={styles.hero}>
          <span className={styles.eyebrow}>
            <span className={styles.eyebrowDot} /> About
          </span>
          <h1 className={styles.heroTitle}>
            The information the industry keeps to itself. Handed to creators.
          </h1>
          <p className={styles.heroDesc}>
            Creatrbase is a commercial intelligence platform for YouTube and Twitch creators. We score your channel across the six dimensions brands and agencies evaluate, and we tell you exactly how the number is calculated.
          </p>
        </header>

        {/* ── Problem section ── */}
        <section className={styles.problemSection}>
          <span className={`${styles.eyebrow} ${styles.eyebrowPeach}`}>
            <span className={styles.eyebrowDot} /> Why we built this
          </span>
          <h2 className={styles.sectionTitle}>We worked inside an influencer agency. Here is what we saw.</h2>

          <div className={styles.problemBody}>
            <p>
              Inside an agency, you develop an instinct for commercial viability. You learn that a 30k-subscriber creator in the personal finance space is worth more to most brands than a 200k lifestyle creator with a diffuse, low-CPM audience. You learn which metrics brands actually weight in their briefs, and which ones are noise. You learn the rate ranges, the deal structures, the red flags that kill a campaign before it starts.
            </p>
            <p>
              Creators walking into the same conversation have none of that. They guess at their own value. They accept the first rate they are offered, because they have no reference point. Some never get approached at all, not because their channels are weak, but because they cannot communicate commercial readiness in the language brands and agencies speak.
            </p>
            <p>
              The micro creator space -- roughly 1,000 to 100,000 subscribers -- is where this problem is worst. Agencies are not incentivised to represent them. Brands struggle to evaluate them at scale. The information gap is not a side effect of the industry. It is structural. We built Creatrbase to close it.
            </p>
          </div>
        </section>

        {/* ── What we built ── */}
        <section className={styles.builtSection}>
          <span className={`${styles.eyebrow} ${styles.eyebrowMint}`}>
            <span className={styles.eyebrowDot} /> What Creatrbase is
          </span>
          <h2 className={styles.sectionTitle}>Commercial data that was previously only available inside agencies.</h2>

          <div className={styles.builtBody}>
            <p>
              Connect your YouTube or Twitch channel and Creatrbase scores you across six dimensions: subscriber momentum, engagement quality, niche commercial value, audience geo alignment, content consistency, and brand readiness. The result is a single Commercial Viability Score, a number that tells you how brand-ready your channel is right now and why.
            </p>
            <p>
              The score is not decorative. It maps to real-world rate tiers, flags the specific gaps holding you back, and generates a prioritised task list for improving each dimension. The methodology is public. Nothing is a black box.
            </p>
          </div>

          <div className={styles.statsRow}>
            <div className={styles.stat}>
              <span className={styles.statNumber}>6</span>
              <span className={styles.statLabel}>scoring dimensions</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statNumber}>100%</span>
              <span className={styles.statLabel}>methodology published</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statNumber}>Real</span>
              <span className={styles.statLabel}>platform data, no guessing</span>
            </div>
          </div>
        </section>

        {/* ── How we think ── */}
        <section className={styles.principlesSection}>
          <span className={styles.eyebrow}>
            <span className={styles.eyebrowDot} /> How we think
          </span>
          <h2 className={styles.sectionTitle}>Four things that are not negotiable.</h2>

          <div className={styles.principlesGrid}>
            {PRINCIPLES.map((p) => (
              <div
                key={p.icon}
                className={`${styles.principleCard} ${p.accent ? styles['principleCard_' + p.accent] : ''}`}
              >
                <span className={styles.principleNum}>{p.icon}</span>
                <h3 className={styles.principleHeading}>{p.heading}</h3>
                <p className={styles.principleBody}>{p.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* ── CTA strip ── */}
      <div className={styles.ctaStrip}>
        <div className={styles.ctaInner}>
          <h2 className={styles.ctaTitle}>See where your channel actually stands.</h2>
          <p className={styles.ctaDesc}>Score your channel for free. No account required to get your initial result.</p>
          <Link to="/score" className={styles.ctaBtn}>Score my channel &rarr;</Link>
        </div>
      </div>

      <MarketingFooter />
    </div>
  );
}
