import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import { logout } from '../../lib/auth';
import { api } from '../../lib/api';
import { SupportChat } from '../../components/ui/SupportChat/SupportChat';
import { OnboardingWizard } from '../../components/OnboardingWizard/OnboardingWizard';
import styles from './AppLayout.module.css';

async function goToCheckout(plan) {
  const { url } = await api.post('/billing/checkout', { plan });
  window.location.href = url;
}

const NAV = [
  {
    group: 'Overview',
    items: [
      { label: 'Dashboard', to: '/dashboard' },
      { label: 'Gap Tracker', to: '/gap' },
    ],
  },
  {
    group: 'Action',
    items: [
      { label: 'Weekly Tasks', to: '/tasks' },
      { label: 'Brand Outreach', to: '/outreach' },
    ],
  },
  {
    group: 'Toolkit',
    items: [
      { label: 'Negotiations', to: '/negotiations' },
      { label: 'Contract Review', to: '/contracts', soon: true },
    ],
  },
  {
    group: 'Account',
    items: [
      { label: 'Connections', to: '/connections' },
      { label: 'Settings', to: '/settings', soon: true },
    ],
  },
];

export function AppLayout({ children }) {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayName = user?.displayName ?? '';
  const initials = displayName
    ? displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const sub = user?.subscription;
  const isTrialling = sub?.status === 'trialling';
  const trialDaysLeft = sub?.trialDaysLeft ?? null;
  const showTrialBanner = isTrialling && trialDaysLeft !== null;

  async function handleLogout() {
    await logout();
    setUser(null);
    navigate('/login');
  }

  return (
    <div className={styles.layout}>
      {showTrialBanner && (
        <div className={styles.trialStrip}>
          <p className={styles.trialStripText}>
            <span className={styles.trialStripDays}>
              {trialDaysLeft === 0 ? 'Trial ends today' : `${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} left on your free trial`}
            </span>
            {' '}— upgrade now to keep full access.
          </p>
          <div className={styles.trialStripActions}>
            <button className={styles.trialStripBtn} onClick={() => goToCheckout('core')}>
              Core £10/mo
            </button>
            <button className={`${styles.trialStripBtn} ${styles.trialStripBtnPrimary}`} onClick={() => goToCheckout('pro')}>
              Pro £20/mo
            </button>
          </div>
        </div>
      )}
      <header className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <img src="/brand/wordmark-dark.png" alt="Creatrbase" className={`${styles.topbarLogo} ${styles.logoLight}`} />
          <img src="/brand/wordmark-light.png" alt="Creatrbase" className={`${styles.topbarLogo} ${styles.logoDark}`} />
        </div>
        
        <div className={styles.topbarRight}>
          <div className={styles.topbarUserContainer} ref={dropdownRef}>
            <button 
              type="button"
              className={styles.topbarUser} 
              onClick={() => setDropdownOpen(!dropdownOpen)} 
            >
              <div className={styles.avatar}>{initials}</div>
              <span className={styles.userName}>{displayName || 'Account'}</span>
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className={styles.chevron}>
                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

          {dropdownOpen && (
            <div className={styles.dropdown}>
              <div className={styles.dropdownItem}>
                <span className={styles.dropdownLabel}>Theme</span>
                <select
                  className={styles.themeSelect}
                  value={localStorage.getItem('cb-theme') || 'system'}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'system') {
                      localStorage.removeItem('cb-theme');
                      const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
                    } else {
                      localStorage.setItem('cb-theme', val);
                      document.documentElement.setAttribute('data-theme', val);
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>
              <button
                type="button"
                className={styles.dropdownItem}
                onClick={(e) => {
                  e.stopPropagation();
                  handleLogout();
                }}
              >
                Sign out
              </button>
            </div>
          )}
          </div>
        </div>
      </header>

      <nav className={styles.sidebar}>
        {NAV.map(({ group, items }) => (
          <div key={group} className={styles.navGroup}>
            <p className={styles.navGroupLabel}>{group}</p>
            {items.map(({ label, to, soon }) => (
              <NavLink
                key={label}
                to={soon ? '#' : to}
                className={({ isActive }) =>
                  `${styles.navItem} ${isActive && !soon ? styles.active : ''}`
                }
              >
                {label}
                {soon && <span className={styles.navSoon}>Soon</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <main className={styles.main}>
        {children}
      </main>

      <SupportChat />
      <OnboardingWizard />
    </div>
  );
}
