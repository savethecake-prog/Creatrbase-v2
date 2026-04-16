import { Link, useNavigate } from 'react-router-dom';
import { LogoWordmark } from '../ui/LogoWordmark';
import styles from './PublicNav.module.css';

export function PublicNav() {
  const navigate = useNavigate();

  return (
    <nav className={styles.nav}>
      <div className={styles.navInner}>
        <Link to="/">
          <LogoWordmark className={styles.logo} />
        </Link>
        <div className={styles.links}>
          <Link to="/scoring-explained" className={styles.link}>How it works</Link>
          <Link to="/blog" className={styles.link}>Blog</Link>
          <Link to="/login" className={styles.link}>Login</Link>
          <Link to="/signup" className={styles.cta}>Get started free</Link>
        </div>
      </div>
    </nav>
  );
}
