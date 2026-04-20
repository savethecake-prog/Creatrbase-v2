import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LogoWordmark } from '../ui/LogoWordmark';
import styles from './PublicNav.module.css';

function NavLink({ hash, to, className, children }) {
  const { pathname } = useLocation();
  if (hash && pathname === '/') {
    return <a href={hash} className={className}>{children}</a>;
  }
  return <Link to={to || `/${hash}`} className={className}>{children}</Link>;
}

export function PublicNav({ scrollEffect = false, variant = 'v1' }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!scrollEffect) return;
    function onScroll() { setScrolled(window.scrollY > 50); }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [scrollEffect]);

  if (variant === 'v2') {
    return (
      <nav className={`${styles.navV2} ${scrolled ? styles.scrolledV2 : ''}`}>
        <div className={styles.navInner}>
          <Link to="/" className={styles.logoV2}>
            <LogoWordmark variant="v2" dark />
          </Link>
          <div className={styles.linksV2}>
            <NavLink hash="#how-it-works" to="/scoring-explained" className={styles.linkV2}>How it works</NavLink>
            <Link to="/pricing" className={styles.linkV2}>Pricing</Link>
            <Link to="/blog" className={styles.linkV2}>Blog</Link>
            <Link to="/about" className={styles.linkV2}>About</Link>
            <Link to="/honesty" className={styles.linkV2}>Honesty</Link>
          </div>
          <div className={styles.rightV2}>
            <Link to="/login" className={styles.loginV2}>Log in</Link>
            <NavLink hash="#score" to="/score" className={styles.ctaV2}>Get your score</NavLink>
          </div>
        </div>
      </nav>
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
