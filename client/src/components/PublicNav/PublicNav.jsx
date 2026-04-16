import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LogoWordmark } from '../ui/LogoWordmark';
import styles from './PublicNav.module.css';

export function PublicNav({ scrollEffect = false }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!scrollEffect) return;
    function onScroll() { setScrolled(window.scrollY > 50); }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [scrollEffect]);

  const navClass = [
    styles.nav,
    scrollEffect ? styles.navTransparent : '',
    scrollEffect && scrolled ? styles.scrolled : '',
  ].filter(Boolean).join(' ');

  return (
    <nav className={navClass}>
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
