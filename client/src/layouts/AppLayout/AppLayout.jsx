import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import { logout } from '../../lib/auth';
import { LogoWordmark } from '../../components/ui/LogoWordmark';
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
        <div className={styles.topbarLeft}>
          <LogoWordmark className={styles.topbarLogo} />
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
