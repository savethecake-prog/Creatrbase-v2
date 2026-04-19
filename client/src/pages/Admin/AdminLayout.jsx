import { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import { logout } from '../../lib/auth';
import styles from './AdminLayout.module.css';

const NAV = [
  { group: 'Overview', items: [{ label: 'Dashboard', to: '/admin' }] },
  { group: 'Content', items: [
    { label: 'Content Studio', to: '/admin/content' },
    { label: 'Editorial', to: '/admin/editorial' },
    { label: 'Skills', to: '/admin/skills' },
  ] },
  { group: 'People', items: [
    { label: 'Subscribers', to: '/admin/subscribers' },
    { label: 'Creators', to: '/admin/creators', soon: true },
  ] },
  { group: 'Operations', items: [
    { label: 'Agents', to: '/admin/agents', soon: true },
    { label: 'System', to: '/admin/system', soon: true },
    { label: 'Token Cleanup', to: '/admin/token-cleanup' },
  ] },
  { group: 'Business', items: [
    { label: 'Revenue', to: '/admin/revenue', soon: true },
  ] },
];

export function AdminLayout() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const initials = (user?.displayName || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  async function handleLogout() {
    await logout();
    setUser(null);
    navigate('/login');
  }

  function handleTheme(val) {
    if (val === 'system') {
      localStorage.removeItem('cb-theme');
      const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    } else {
      localStorage.setItem('cb-theme', val);
      document.documentElement.setAttribute('data-theme', val);
    }
  }

  return (
    <div className={styles.layout}>
      {drawerOpen && (
        <div className={styles.drawerOverlay} onClick={() => setDrawerOpen(false)} />
      )}
      <nav className={`${styles.drawer} ${drawerOpen ? styles.drawerVisible : ''}`}>
        <div className={styles.drawerHeader}>
          <img src="/brand/wordmark-dark.png" alt="Creatrbase" className={`${styles.logo} ${styles.logoLight}`} />
          <img src="/brand/wordmark-light.png" alt="Creatrbase" className={`${styles.logo} ${styles.logoDark}`} />
          <button className={styles.drawerClose} onClick={() => setDrawerOpen(false)} aria-label="Close menu">&times;</button>
        </div>
        {NAV.map(({ group, items }) => (
          <div key={group} className={styles.navGroup}>
            <p className={styles.navGroupLabel}>{group}</p>
            {items.map(({ label, to, soon }) => (
              <NavLink key={label} to={soon ? '#' : to} end={to === '/admin'}
                onClick={() => setDrawerOpen(false)}
                className={({ isActive }) => `${styles.navItem} ${isActive && !soon ? styles.active : ''}`}>
                {label}
                {soon && <span className={styles.navSoon}>Soon</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <header className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <button
            type="button"
            className={styles.hamburger}
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
          >
            <svg width="16" height="12" viewBox="0 0 16 12" fill="none" aria-hidden="true">
              <rect y="0" width="16" height="2" rx="1" fill="currentColor"/>
              <rect y="5" width="16" height="2" rx="1" fill="currentColor"/>
              <rect y="10" width="16" height="2" rx="1" fill="currentColor"/>
            </svg>
          </button>
          <img src="/brand/wordmark-dark.png" alt="Creatrbase" className={`${styles.logo} ${styles.logoLight}`} />
          <img src="/brand/wordmark-light.png" alt="Creatrbase" className={`${styles.logo} ${styles.logoDark}`} />
          <span className={styles.adminBadge}>Admin</span>
        </div>
        <div className={styles.topbarRight} ref={menuRef}>
          <button className={styles.userBtn} onClick={() => setMenuOpen(!menuOpen)}>
            <div className={styles.avatar}>{initials}</div>
            <span className={styles.userName}>{user?.displayName || 'Admin'}</span>
          </button>
          {menuOpen && (
            <div className={styles.dropdown}>
              <div className={styles.dropdownItem}>
                <span>Theme</span>
                <select className={styles.themeSelect} value={localStorage.getItem('cb-theme') || 'system'} onChange={e => handleTheme(e.target.value)} onClick={e => e.stopPropagation()}>
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>
              <a href="/dashboard" className={styles.dropdownItem}>Back to product</a>
              <button className={styles.dropdownItem} onClick={handleLogout}>Sign out</button>
            </div>
          )}
        </div>
      </header>

      <nav className={styles.sidebar}>
        {NAV.map(({ group, items }) => (
          <div key={group} className={styles.navGroup}>
            <p className={styles.navGroupLabel}>{group}</p>
            {items.map(({ label, to, soon }) => (
              <NavLink key={label} to={soon ? '#' : to} end={to === '/admin'}
                className={({ isActive }) => `${styles.navItem} ${isActive && !soon ? styles.active : ''}`}>
                {label}
                {soon && <span className={styles.navSoon}>Soon</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
