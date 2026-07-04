import { Link } from 'react-router-dom';
import { PageMeta } from '../../components/PageMeta/PageMeta';
import { AgenciesNav, AgenciesFooter } from './AgenciesChrome';
import { CATALOGUE, FREE_RUN, SAMPLE_DOSSIER_URL } from './config';
import styles from './Agencies.module.css';

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
      <AgenciesNav />

      {/* Proposition — the liability truth, no feature list above the fold */}
      <header className={styles.hero}>
        <div className={styles.container}>
          <h1 className={styles.heroTitle}>
            Every creator on the shortlist, checked the same way, on the record.
          </h1>
          <p className={styles.heroSub}>Judgement you can forward.</p>
          <div className={styles.heroActions}>
            <Link to="/agencies/brief" className={styles.ctaPrimary}>Start a brief</Link>
            <a href={SAMPLE_DOSSIER_URL} className={styles.ctaSecondary} target="_blank" rel="noopener noreferrer">
              See a sample dossier
            </a>
          </div>
          <p className={styles.bridge}>
            One engine, two sides of the table. Creators see how they score; agencies get the same
            rigour pointed at a brief.
          </p>
        </div>
      </header>

      {/* Proof — the sample dossier does the convincing */}
      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.eyebrow}>The 30-second background check</div>
          <h2 className={styles.sectionTitle}>One object tells you who clears the brief, and why.</h2>
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

      {/* Method summary — three short blocks, the equivalence line once */}
      <section className={`${styles.section} ${styles.sectionAlt}`}>
        <div className={styles.container}>
          <div className={styles.eyebrow}>How it works</div>
          <div className={styles.methodGrid}>
            <div className={styles.methodBlock}>
              <h3>What we check</h3>
              <p>
                Attested figures with their sources, engagement quality, audience composition, and a
                content-history risk scan against your stated sensitivities. Each figure carries its
                confidence tier.
              </p>
              <Link to="/agencies/methodology" className={styles.methodLink}>Read the method →</Link>
            </div>
            <div className={styles.methodBlock}>
              <h3>How scoring works</h3>
              <p>
                Delivery is modelled against your stated targets and expressed as a range with a
                central estimate. Hit probability carries an error band; it is a modelled estimate,
                never a promise.
              </p>
              <Link to="/agencies/methodology" className={styles.methodLink}>Read the method →</Link>
            </div>
            <div className={styles.methodBlock}>
              <h3>What the verdict means</h3>
              <p>
                One of three verdicts — proceed, proceed with cautions, do not proceed — with the
                reasoning immediately beneath it. The acceptance line is drawn across the shortlist;
                shortfalls are stated in words.
              </p>
              <Link to="/agencies/methodology" className={styles.methodLink}>Read the method →</Link>
            </div>
          </div>
          <p className={styles.equivalence}>
            Roughly five working days of internal labour, delivered in 48 hours.
          </p>
        </div>
      </section>

      {/* Pricing — plain table, prices visible, no contact-us gating */}
      <section className={styles.section} id="pricing">
        <div className={styles.container}>
          <div className={styles.eyebrow}>Pricing</div>
          <h2 className={styles.sectionTitle}>Prices are on the page. All prices exclude VAT.</h2>
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
      <section className={`${styles.section} ${styles.sectionAlt} ${styles.doorSection}`}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Bring us a brief.</h2>
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
