import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import { logout } from '../../lib/auth';
import { LogoMonogram } from '../../components/ui/LogoMonogram';
import styles from './AppLayout.module.css';

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

  async function handleLogout() {
    await logout();
    setUser(null);
    navigate('/login');
  }

  return (
    <div className={styles.layout}>
      <header className={styles.topbar}>
        <LogoMonogram className={styles.topbarLogo} />
        <div className={styles.topbarSpacer} />
        <div className={styles.topbarUserContainer} ref={dropdownRef} style={{ position: 'relative' }}>
          <button 
            type="button"
            className={styles.topbarUser} 
            onClick={() => setDropdownOpen(!dropdownOpen)} 
            title="Account"
            style={{ border: 'none', background: 'transparent', width: '100%' }}
          >
            <div className={styles.avatar}>{initials}</div>
            <span>{displayName || 'Account'}</span>
          </button>

          {dropdownOpen && (
            <div className={styles.dropdown}>
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
      </header>

      <nav className={styles.sidebar}>
        {NAV.map(({ group, items }) => (
          <div key={group} className={styles.navGroup}>
            <p className={styles.navGroupLabel}>{group}</p>
            {items.map(({ label, to, soon }) => (
              <NavLink
                key={to}
                to={soon ? '#' : to}
                className={({ isActive }) =>
                  [styles.navItem, isActive && !soon ? styles.active : ''].filter(Boolean).join(' ')
                }
              >
                {label}
                {soon && <span className={styles.navDot} />}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
}
