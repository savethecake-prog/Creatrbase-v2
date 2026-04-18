import { PublicNav } from '../../components/PublicNav/PublicNav';
import { MarketingFooter } from '../../components/MarketingFooter/MarketingFooter';
import { PageMeta } from '../../components/PageMeta/PageMeta';
import styles from './Honesty.module.css';

export function Honesty() {
  return (
    <div className={styles.page}>
      <PageMeta
        title="The Honesty Principle — Creatrbase"
        description="What Creatrbase will and won't do. Our commitment to creators about how we measure, what we publish, and where the limits are."
        canonical="https://creatrbase.com/honesty"
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'WebPage',
        name: 'The Honesty Principle', url: 'https://creatrbase.com/honesty',
        description: 'What Creatrbase will and won\'t do.',
        breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://creatrbase.com' },
          { '@type': 'ListItem', position: 2, name: 'Honesty', item: 'https://creatrbase.com/honesty' },
        ] },
      }) }} />

      <PublicNav variant="v2" />

      <main className={styles.main}>
        <header className={styles.hero}>
          <span className={styles.eyebrow}><span className={styles.eyebrowDot} /> The honesty principle</span>
          <h1 className={styles.heroTitle}>If we don&rsquo;t know, we say&nbsp;so. If we change, we publish what&nbsp;changed.</h1>
        </header>

        <section className={styles.pillar}>
          <h2 className={styles.pillarTitle}>We will</h2>
          <ul className={styles.pillarList}>
            <li>Tell you exactly how your score is calculated — every dimension, every weighting, every calibration.</li>
            <li>Label every estimate as an estimate. Where the data is thin, we say so directly.</li>
            <li>Attach a confidence level to every output. High, medium, or low — never unlabelled.</li>
            <li>Show you what changed when we update the scoring model, and why.</li>
            <li>Let you export your data at any time, in a format you can actually use.</li>
            <li>Cancel your account in one click. No &ldquo;schedule a call&rdquo; nonsense.</li>
          </ul>
        </section>

        <section className={`${styles.pillar} ${styles.pillarPeach}`}>
          <h2 className={styles.pillarTitle}>We won&rsquo;t</h2>
          <ul className={styles.pillarList}>
            <li>Sell your data. Not to brands, not to agencies, not to anyone.</li>
            <li>Fabricate social proof. The numbers on the landing page are real or they&rsquo;re not there.</li>
            <li>Hide bad news. If your score drops, we tell you why and what to do about it.</li>
            <li>Gate features behind dark patterns, upsell modals, or artificial urgency.</li>
            <li>Use your data to train AI models for third parties.</li>
            <li>Pretend we have data we don&rsquo;t have. If a metric is unavailable, the field is empty — not estimated.</li>
          </ul>
        </section>

        <section className={`${styles.pillar} ${styles.pillarLav}`}>
          <h2 className={styles.pillarTitle}>We publish</h2>
          <ul className={styles.pillarList}>
            <li>The full scoring methodology — publicly, at <a href="/scoring-explained">/scoring-explained</a>.</li>
            <li>Every calibration change with the date, the delta, and the reasoning.</li>
            <li>Aggregate benchmarking data so you can see where you sit relative to your niche and tier.</li>
            <li>Our pricing, plainly. No &ldquo;contact us for a quote.&rdquo;</li>
          </ul>
        </section>

        <div className={styles.logPreview}>
          <div className={styles.logTitle}>Calibration log</div>
          <p className={styles.logDesc}>Every scoring model change is published with the date, what changed, and why. See the full log on the <a href="/scoring-explained">methodology page</a>.</p>
        </div>

        <div className={styles.closing}>
          <p>We built Creatrbase because the creator economy runs on asymmetric information — and creators are on the wrong side of it. The least we can do is be honest about what we know and what we don&rsquo;t.</p>
        </div>

        <div className={styles.cta}>
          <h2 className={styles.ctaTitle}>See for yourself.</h2>
          <a href="/#score" className={styles.ctaBtn}>Score my channel &rarr;</a>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
