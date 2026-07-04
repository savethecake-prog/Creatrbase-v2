import { Link } from 'react-router-dom';
import { LogoWordmark } from '../ui/LogoWordmark';
import styles from './MarketingFooter.module.css';

// `disclosure` and `extraLinks` are optional; passing neither reproduces the creator
// footer verbatim (byte-identical). The agencies route passes the independence statement
// (CB-KD-01 s.10) as the disclosure and its legal links (Privacy/Terms) as an extra
// column, reusing this same footer rather than forking one.
export function MarketingFooter({ disclosure = null, extraLinks = null }) {
  return (
    <footer className={styles.footer}>
      <div className={styles.grid}>
        <div className={styles.brand}>
          <Link to="/"><LogoWordmark variant="v2" height={36} className={styles.logo} /></Link>
          <p className={styles.tag}>Commercial intelligence for independent creators on YouTube and Twitch. Built in the UK.</p>
          {disclosure && <p className={styles.disclosure}>{disclosure}</p>}
        </div>
        <div>
          <h5 className={styles.colTitle}>Product</h5>
          <ul className={styles.links}>
            <li><Link to="/score">Get your score</Link></li>
            <li><Link to="/scoring-explained">How it works</Link></li>
            <li><Link to="/pricing">Pricing</Link></li>
            <li><Link to="/honesty">Honesty</Link></li>
          </ul>
        </div>
        <div>
          <h5 className={styles.colTitle}>Learn</h5>
          <ul className={styles.links}>
            <li><Link to="/blog">Blog</Link></li>
            <li><Link to="/scoring-explained">Scoring methodology</Link></li>
            <li><Link to="/niche/gaming">Gaming creator rates</Link></li>
            <li><Link to="/niche/finance">Finance creator rates</Link></li>
          </ul>
        </div>
        <div>
          <h5 className={styles.colTitle}>Compare</h5>
          <ul className={styles.links}>
            <li><Link to="/compare/vidiq">Creatrbase vs VidIQ</Link></li>
            <li><Link to="/compare/tubebuddy">Creatrbase vs TubeBuddy</Link></li>
            <li><Link to="/compare/social-blade">Creatrbase vs Social Blade</Link></li>
          </ul>
        </div>
        <div>
          <h5 className={styles.colTitle}>Company</h5>
          <ul className={styles.links}>
            <li><Link to="/about">About</Link></li>
            <li><Link to="/privacy">Privacy</Link></li>
            <li><Link to="/terms">Terms</Link></li>
            <li><Link to="/cookies">Cookies</Link></li>
          </ul>
        </div>
        {extraLinks && (
          <div>
            <h5 className={styles.colTitle}>{extraLinks.title}</h5>
            <ul className={styles.links}>
              {extraLinks.items.map((l) => (
                <li key={l.to}><Link to={l.to}>{l.label}</Link></li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className={styles.bottom}>
        <span>&copy; 2026 Creatrbase &middot; Built with honesty</span>
        <span>v1.0 &middot; April 2026</span>
      </div>
    </footer>
  );
}
