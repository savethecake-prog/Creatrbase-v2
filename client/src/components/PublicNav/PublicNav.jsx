import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LogoWordmark } from '../ui/LogoWordmark';
import styles from './PublicNav.module.css';

export function PublicNav({ scrollEffect = false, variant = 'v1' }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  useEffect(() => {
    if (!scrollEffect) return;
    function onScroll() { setScrolled(window.scrollY > 50); }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [scrollEffect]);

  if (variant === 'v2') {
    return (
      <>
        {mobileOpen && (
          <div className={styles.mobileMenu}>
            <div className={styles.mobileMenuHeader}>
              <Link to="/" onClick={() => setMobileOpen(false)}>
                <LogoWordmark variant="v2" dark style={{ height: 32 }} />
              </Link>
              <button
                type="button"
                className={styles.mobileMenuClose}
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
              >
                &times;
              </button>
            </div>
            <div className={styles.mobileMenuLinks}>
              <Link to="/scoring-explained" className={styles.mobileMenuLink}>How it works</Link>
              <Link to="/pricing" className={styles.mobileMenuLink}>Pricing</Link>
              <Link to="/blog" className={styles.mobileMenuLink}>Blog</Link>
              <Link to="/honesty" className={styles.mobileMenuLink}>Honesty</Link>
              <Link to="/login" className={styles.mobileMenuLink}>Log in</Link>
            </div>
            <Link to="/score" className={styles.mobileMenuCta} onClick={() => setMobileOpen(false)}>
              Get your score
            </Link>
          </div>
        )}
        <nav className={`${styles.navV2} ${scrolled ? styles.scrolledV2 : ''}`}>
          <div className={styles.navInner}>
            <Link to="/" className={styles.logoV2}>
              <LogoWordmark variant="v2" dark />
            </Link>
            <div className={styles.linksV2}>
              <Link to="/scoring-explained" className={styles.linkV2}>How it works</Link>
              <Link to="/pricing" className={styles.linkV2}>Pricing</Link>
              <Link to="/blog" className={styles.linkV2}>Blog</Link>
              <Link to="/honesty" className={styles.linkV2}>Honesty</Link>
            </div>
            <div className={styles.rightV2}>
              <Link to="/login" className={styles.loginV2}>Log in</Link>
              <Link to="/score" className={styles.ctaV2}>Get your score</Link>
              <button
                type="button"
                className={styles.mobileMenuBtn}
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
              >
                <svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden="true">
                  <rect y="0" width="18" height="2" rx="1" fill="currentColor"/>
                  <rect y="6" width="18" height="2" rx="1" fill="currentColor"/>
                  <rect y="12" width="18" height="2" rx="1" fill="currentColor"/>
                </svg>
              </button>
            </div>
          </div>
        </nav>
      </>
    );
  }

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
