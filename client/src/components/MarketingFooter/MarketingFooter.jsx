import { Link } from 'react-router-dom';
import styles from './MarketingFooter.module.css';

export function MarketingFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.grid}>
        <div className={styles.brand}>
          <Link to="/"><img src="/brand/wordmark-light.png" alt="Creatrbase" className={styles.logo} /></Link>
          <p className={styles.tag}>Commercial intelligence for independent creators on YouTube and Twitch. Built in the UK.</p>
        </div>
        <div>
          <h5 className={styles.colTitle}>Product</h5>
          <ul className={styles.links}>
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
          </ul>
        </div>
        <div>
          <h5 className={styles.colTitle}>Company</h5>
          <ul className={styles.links}>
            <li><Link to="/privacy">Privacy</Link></li>
            <li><Link to="/terms">Terms</Link></li>
          </ul>
        </div>
      </div>
      <div className={styles.bottom}>
        <span>&copy; 2026 Creatrbase &middot; Built with honesty</span>
        <span>v1.0 &middot; April 2026</span>
      </div>
    </footer>
  );
}
