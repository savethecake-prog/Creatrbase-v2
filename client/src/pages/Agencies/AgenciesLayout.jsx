import { Link } from 'react-router-dom';
import { LogoWordmark } from '../../components/ui/LogoWordmark';
import { LEGAL_ENTITY_LINE, LEGAL_PENDING_LINE } from './config';
import styles from './Agencies.module.css';

/**
 * The agencies-route shell: its own quiet nav and footer (the agencies route is a
 * distinct front door, CB-KD-05 s.2 — it must not adopt the creator-side nav). Same
 * tokens, same register as the rest of the site (the single rule, CB-KD-05 s.1).
 */
export function AgenciesNav() {
  return (
    <nav className={styles.nav}>
      <div className={styles.navInner}>
        <Link to="/agencies" className={styles.navLogo}>
          <LogoWordmark height={30} />
        </Link>
        <div className={styles.navLinks}>
          <Link to="/agencies/methodology" className={styles.navLink}>Methodology</Link>
          <Link to="/agencies/sample" className={styles.navLink}>Sample dossier</Link>
          <Link to="/agencies/brief" className={styles.navCta}>Start a brief</Link>
        </div>
      </div>
    </nav>
  );
}

export function AgenciesFooter() {
  const entity = LEGAL_ENTITY_LINE || LEGAL_PENDING_LINE;
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerBrand}>
          <LogoWordmark height={30} />
          <p className={styles.footerTag}>
            One engine, two sides of the table. Creators see how they score; agencies get the
            same rigour pointed at a brief.
          </p>
          <p className={styles.footerIndependence}>
            A creator’s purchase of any Creatrbase product never influences an agency-side
            vetting outcome. One engine, two sides of the table, no pay-to-play.
          </p>
        </div>
        <div className={styles.footerCols}>
          <div>
            <h5 className={styles.footerColTitle}>Agencies</h5>
            <ul className={styles.footerLinks}>
              <li><Link to="/agencies">Overview</Link></li>
              <li><Link to="/agencies/methodology">Methodology</Link></li>
              <li><Link to="/agencies/sample">Sample dossier</Link></li>
              <li><Link to="/agencies/brief">Start a brief</Link></li>
            </ul>
          </div>
          <div>
            <h5 className={styles.footerColTitle}>Legal</h5>
            <ul className={styles.footerLinks}>
              <li><Link to="/agencies/privacy">Privacy notice</Link></li>
              <li><Link to="/agencies/terms">Terms of service</Link></li>
              <li><Link to="/">Creators</Link></li>
            </ul>
          </div>
        </div>
      </div>
      <div className={styles.footerBottom}>
        <span>{entity}</span>
        <span>Creatrbase — agencies</span>
      </div>
    </footer>
  );
}
