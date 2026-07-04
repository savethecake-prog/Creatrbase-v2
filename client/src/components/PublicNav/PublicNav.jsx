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

// Default v2 nav entries (the creator-side homepage set). Passing `links`/`cta`/`login`
// overrides them while reusing the identical nav shell, v2 logo and styles — the agencies
// route composes this same component rather than forking its own header.
const V2_DEFAULT_LINKS = [
  { hash: 'how-it-works', to: '/scoring-explained', label: 'How it works' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/blog', label: 'Blog' },
  { to: '/about', label: 'About' },
  { to: '/honesty', label: 'Honesty' },
];
const V2_DEFAULT_CTA = { hash: 'score', to: '/score', label: 'Get your score' };

export function PublicNav({
  scrollEffect = false,
  variant = 'v1',
  links = V2_DEFAULT_LINKS,
  cta = V2_DEFAULT_CTA,
  login = { to: '/login', label: 'Log in' },
}) {
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
            {links.map((l) => (
              <NavLink key={l.to} hash={l.hash} to={l.to} className={styles.linkV2}>{l.label}</NavLink>
            ))}
          </div>
          <div className={styles.rightV2}>
            {login && <Link to={login.to} className={styles.loginV2}>{login.label}</Link>}
            <NavLink hash={cta.hash} to={cta.to} className={styles.ctaV2}>{cta.label}</NavLink>
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
