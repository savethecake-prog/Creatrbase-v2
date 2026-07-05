import { Link } from 'react-router-dom';
import { PageMeta } from '../../components/PageMeta/PageMeta';
import { AgenciesNav, AgenciesFooter } from './AgenciesChrome';
import {
  CATALOGUE, FREE_RUN, SAMPLE_DOSSIER_URL, BRIDGE_STATEMENT, INDEPENDENCE_STATEMENT,
  WHY_THIS_EXISTS, STAT_CALLOUTS,
} from './config';
import styles from './Agencies.module.css';

// JSON-LD for AI discovery / rich results (CB-KD-05 s.6). Organization identifies the
// entity; Service describes the agency-side vetting offering. Plain entity statements,
// no keyword stuffing — the register is the SEO strategy.
const ORG_JSONLD = {
  '@context': 'https://schema.org', '@type': 'Organization',
  name: 'Creatrbase', url: 'https://creatrbase.com',
  logo: 'https://creatrbase.com/brand/og-image.png',
  description: 'Independent creator-vetting service for agencies. A dossier per creator — modelled delivery, brand safety, audience fit, and a verdict, with the working shown, within 48 hours.',
  sameAs: ['https://www.linkedin.com/company/creatrbase/'],
};
const SERVICE_JSONLD = {
  '@context': 'https://schema.org', '@type': 'Service',
  name: 'Creatrbase creator vetting for agencies',
  serviceType: 'Creator vetting and shortlisting',
  provider: { '@type': 'Organization', name: 'Creatrbase', url: 'https://creatrbase.com' },
  areaServed: 'GB',
  url: 'https://creatrbase.com/agencies',
  description: 'You submit a campaign brief; Creatrbase delivers a dossier per creator — modelled delivery against your targets, a brand-safety record, audience fit, and a verdict — with the working shown, within 48 hours. Every dossier is reviewed by a person before release.',
};

/**
 * /agencies — the agency front door, one scroll (CB-KD-05 s.2, s.4): proposition,
 * proof, method, price, door. Copy drafted against the s.4 binding directions; register
 * per CB-KD-01 s.10 (quiet, declarative, no hype, no banned claim language).
 */
export function Agencies() {
  return (
    <div className={styles.page}>
      <PageMeta
        title="Creatrbase for agencies — every creator on the shortlist, checked the same way"
        description="Independent creator vetting for agencies: every creator on the shortlist, checked the same way, on the record. Judgement you can forward."
        canonical="https://creatrbase.com/agencies"
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_JSONLD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SERVICE_JSONLD) }} />
      <AgenciesNav />

      {/* Proposition — the liability truth, no feature list above the fold */}
      <header className={styles.hero}>
        <div className={styles.container}>
          <span className={`${styles.stickerChip} ${styles.stickerMint}`}>For agencies · Creator vetting</span>
          <h1 className={styles.heroTitle}>
            Every creator on the shortlist, checked the same way, <em>on the record.</em>
          </h1>
          <p className={styles.heroSub}>Judgement you can forward.</p>
          <div className={styles.heroActions}>
            <Link to="/agencies/brief" className={styles.ctaPrimary}>Start a brief</Link>
            <a href={SAMPLE_DOSSIER_URL} className={styles.ctaSecondary} target="_blank" rel="noopener noreferrer">
              See a sample dossier
            </a>
          </div>
          {/* Bridge + independence statement (CB-KD-05 s.2): the bridge, followed by the
              CB-KD-01 s.10 independence statement verbatim, on /agencies where the two sides meet. */}
          <p className={styles.bridge}>
            {BRIDGE_STATEMENT}
            <span className={styles.bridgeIndependence}>{INDEPENDENCE_STATEMENT}</span>
          </p>
        </div>
      </header>

      {/* Proof — the sample dossier does the convincing */}
      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.eyebrow}><span className={styles.eyebrowDot} /> The 30-second background check</div>
          <h2 className={styles.sectionTitle}>One object tells you who clears the brief, and <em>why.</em></h2>
          <p className={styles.lede}>
            A dossier reads like a risk document, not a pitch: a figure, its confidence, its source
            and date; the flags with their evidence; a verdict with the reasoning beneath it. Read
            one and you will know whether to book the creator — and be able to forward the reason.
          </p>
          <div className={styles.proofCard}>
            <div>
              <div className={styles.proofLabel}>Sample dossier</div>
              <p className={styles.proofNote}>
                A complete dossier for a fictional creator against a fictional brief, at full
                production quality.
              </p>
            </div>
            <a href={SAMPLE_DOSSIER_URL} className={styles.ctaPrimary} target="_blank" rel="noopener noreferrer">
              Open the sample
            </a>
          </div>
        </div>
      </section>

      {/* Why this exists — owner copy VERBATIM (config.WHY_THIS_EXISTS), with the two
          real numbers we own as stat-callout cards. */}
      <section className={`${styles.section} ${styles.sectionAlt}`}>
        <div className={styles.container}>
          <div className={styles.eyebrow}><span className={styles.eyebrowDot} /> Why this exists</div>
          <h2 className={styles.sectionTitle}>Discovery is still a <em>manual job.</em></h2>
          <div className={styles.whyGrid}>
            {WHY_THIS_EXISTS.map((para, i) => <p key={i}>{para}</p>)}
          </div>
          <div className={styles.statGrid}>
            {STAT_CALLOUTS.map((s) => (
              <div key={s.source} className={styles.statCard}>
                <div className={styles.statNum}>{s.num}<span className={styles.statUnit}>{s.unit}</span></div>
                <p className={styles.statDesc}>{s.desc}</p>
                <div className={styles.statSource}>{s.source}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works — the three-step row (01 Brief / 02 Vet / 03 Decide), mirroring
          the homepage's three-card pattern; the equivalence line once, below. */}
      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.eyebrow}><span className={styles.eyebrowDot} /> How it works</div>
          <h2 className={styles.sectionTitle}>Three steps. One clear <em>decision.</em></h2>
          <div className={styles.howGrid}>
            <div className={styles.howStep}>
              <div className={styles.howStepNum}>01 · Brief</div>
              <h3 className={styles.howStepTitle}>Four minutes, one question at a time.</h3>
              <p>
                A short, conversational brief captures your campaign, targets, platforms and
                sensitivities. Nothing unclear is guessed — it becomes a question back to you.
              </p>
            </div>
            <div className={styles.howStep}>
              <div className={`${styles.howStepNum} ${styles.howStepPeach}`}>02 · Vet</div>
              <h3 className={styles.howStepTitle}>Every creator checked the same way.</h3>
              <p>
                One documented method, applied uniformly: attested metrics with sources, modelled
                delivery, a risk register with evidence. Every dossier is human-reviewed before release.
              </p>
            </div>
            <div className={styles.howStep}>
              <div className={`${styles.howStepNum} ${styles.howStepMint}`}>03 · Decide</div>
              <h3 className={styles.howStepTitle}>Dossiers with verdicts, in 48 hours.</h3>
              <p>
                A dossier per creator — a verdict with the working shown beneath it, ranked by hit
                probability — inside 48 hours of an accepted brief. Judgement you can forward.
              </p>
            </div>
          </div>
          <p className={styles.equivalence}>
            Roughly five working days of internal labour, delivered in 48 hours.{' '}
            <Link to="/agencies/methodology" className={styles.methodLink}>Read the full method →</Link>
          </p>
        </div>
      </section>

      {/* Pricing — plain table, prices visible, no contact-us gating */}
      <section className={`${styles.section} ${styles.sectionAlt}`} id="pricing">
        <div className={styles.container}>
          <div className={styles.eyebrow}><span className={styles.eyebrowDot} /> Pricing</div>
          <h2 className={styles.sectionTitle}>Prices are on the <em>page.</em> All prices exclude VAT.</h2>
          <div className={styles.priceGrid}>
            {CATALOGUE.map((sku) => (
              <div key={sku.id} className={styles.priceCard}>
                <div className={styles.priceHead}>
                  <h3 className={styles.priceName}>{sku.name}</h3>
                  <div className={styles.priceFigure}>
                    {sku.price}
                    {sku.priceAlt && <span className={styles.priceAlt}> / {sku.priceAlt}</span>}
                  </div>
                  <div className={styles.priceUnit}>{sku.unit}</div>
                </div>
                <p className={styles.priceBlurb}>{sku.blurb}</p>
                {sku.stripeLink ? (
                  <a href={sku.stripeLink} className={styles.ctaPrimary} target="_blank" rel="noopener noreferrer">
                    Buy {sku.name}
                  </a>
                ) : (
                  <Link to="/agencies/brief" className={styles.ctaSecondary}>Start a brief</Link>
                )}
              </div>
            ))}
          </div>

          <div className={styles.freeRun}>
            <div>
              <div className={styles.priceName}>{FREE_RUN.name}</div>
              <div className={styles.priceUnit}>{FREE_RUN.price} · {FREE_RUN.unit}</div>
              <p className={styles.priceBlurb}>{FREE_RUN.blurb}</p>
            </div>
            <Link to="/agencies/brief" className={styles.ctaPrimary}>Run your real brief</Link>
          </div>
        </div>
      </section>

      {/* The door */}
      <section className={`${styles.section} ${styles.doorSection}`}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Bring us a <em>brief.</em></h2>
          <p className={styles.lede}>
            About four minutes. Five full dossiers inside 48 hours, and a person reviews every one
            before it reaches you.
          </p>
          <Link to="/agencies/brief" className={styles.ctaPrimary}>Start a brief</Link>
        </div>
      </section>

      <AgenciesFooter />
    </div>
  );
}
