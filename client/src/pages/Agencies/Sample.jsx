import { Link } from 'react-router-dom';
import { PageMeta } from '../../components/PageMeta/PageMeta';
import { AgenciesNav, AgenciesFooter } from './AgenciesLayout';
import { SAMPLE_DOSSIER_URL } from './config';
import styles from './Agencies.module.css';

/**
 * /agencies/sample — one complete dossier for a fictional creator against a fictional
 * brief, at full production quality (CB-KD-05 s.2). The object sells itself; the page
 * frames it in two sentences and gets out of the way. The dossier is the real rendered
 * object, hosted at its slug URL and embedded here; it carries its own fictional marking.
 */
export function Sample() {
  return (
    <div className={styles.page}>
      <PageMeta
        title="Sample dossier — Creatrbase for agencies"
        description="A complete Creatrbase dossier for a fictional creator against a fictional brief, at full production quality. The object sells itself."
        canonical="https://creatrbase.com/agencies/sample"
      />
      <AgenciesNav />

      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.eyebrow}>Sample dossier</div>
          <h1 className={styles.sectionTitle}>This is exactly what you receive, per creator.</h1>
          <p className={styles.lede}>
            The dossier below is for a fictional creator against a fictional brief, rendered at full
            production quality — figures with their confidence and source, one caution with its
            quantified effect, and a verdict with the reasoning beneath it.{' '}
            <a href={SAMPLE_DOSSIER_URL} target="_blank" rel="noopener noreferrer">
              Open it in its own tab
            </a>{' '}
            to read it full-width or print it to PDF.
          </p>

          <div className={styles.sampleFrame}>
            <iframe
              src={SAMPLE_DOSSIER_URL}
              title="Sample dossier — fictional creator, illustrative data"
              className={styles.sampleIframe}
              loading="lazy"
            />
          </div>

          <div className={styles.sampleActions}>
            <a href={SAMPLE_DOSSIER_URL} className={styles.ctaSecondary} target="_blank" rel="noopener noreferrer">
              Open the dossier
            </a>
            <Link to="/agencies/brief" className={styles.ctaPrimary}>Run your real brief</Link>
          </div>
        </div>
      </section>

      <AgenciesFooter />
    </div>
  );
}
