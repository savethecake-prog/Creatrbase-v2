import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import styles from './Team.module.css';

function timeAgo(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const days  = Math.floor(diff / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30)  return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function Team() {
  const [admins,    setAdmins]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  // Grant form
  const [grantEmail, setGrantEmail]   = useState('');
  const [grantSearch, setGrantSearch] = useState(null);
  const [searching,   setSearching]   = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [granting,    setGranting]    = useState(false);

  // Confirm revoke
  const [revoking, setRevoking] = useState(null); // userId
  const [actionError, setActionError] = useState(null);

  useEffect(() => { loadAdmins(); }, []);

  async function loadAdmins() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('/admin/team');
      setAdmins(data.admins || []);
    } catch (err) {
      setError(err.message || 'Failed to load team');
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(e) {
    e.preventDefault();
    if (!grantEmail.trim()) return;
    setSearching(true);
    setSearchError(null);
    setGrantSearch(null);
    try {
      const data = await api.get(`/admin/users?search=${encodeURIComponent(grantEmail.trim())}&limit=5`);
      const match = data.users?.find(u => u.email.toLowerCase() === grantEmail.trim().toLowerCase());
      if (!match) {
        setSearchError('No user found with that email address.');
      } else {
        setGrantSearch(match);
      }
    } catch (err) {
      setSearchError(err.message || 'Search failed');
    } finally {
      setSearching(false);
    }
  }

  async function handleGrant() {
    if (!grantSearch) return;
    setGranting(true);
    setActionError(null);
    try {
      await api.post(`/admin/users/${grantSearch.id}/set-access-level`, { level: 100 });
      setGrantEmail('');
      setGrantSearch(null);
      await loadAdmins();
    } catch (err) {
      setActionError(err.message || 'Grant failed');
    } finally {
      setGranting(false);
    }
  }

  async function handleRevoke(userId) {
    setRevoking(userId);
    setActionError(null);
    try {
      await api.post(`/admin/users/${userId}/set-access-level`, { level: 0 });
      await loadAdmins();
    } catch (err) {
      setActionError(err.message || 'Revoke failed');
    } finally {
      setRevoking(null);
    }
  }

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Admin Team</h1>
          <p className={styles.subtitle}>Manage who has admin access to this platform.</p>
        </div>
      </div>

      {/* Grant access */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Grant admin access</h2>
        <p className={styles.sectionDesc}>The user must already have a Creatrbase account. Access level 100 gives full admin privileges.</p>

        <form className={styles.grantForm} onSubmit={handleSearch}>
          <input
            className={styles.input}
            type="email"
            placeholder="User email address"
            value={grantEmail}
            onChange={e => { setGrantEmail(e.target.value); setGrantSearch(null); setSearchError(null); }}
          />
          <button className={styles.btnGhost} type="submit" disabled={searching || !grantEmail.trim()}>
            {searching ? 'Searching...' : 'Find user'}
          </button>
        </form>

        {searchError && <div className={styles.errorBox}>{searchError}</div>}

        {grantSearch && (
          <div className={styles.foundUser}>
            <div className={styles.foundUserInfo}>
              <span className={styles.foundUserEmail}>{grantSearch.email}</span>
              <span className={styles.foundUserMeta}>
                {grantSearch.display_name && `${grantSearch.display_name} · `}
                joined {timeAgo(grantSearch.created_at)}
              </span>
            </div>
            <button className={styles.btnPrimary} onClick={handleGrant} disabled={granting}>
              {granting ? 'Granting...' : 'Grant admin access'}
            </button>
          </div>
        )}

        {actionError && <div className={styles.errorBox} style={{ marginTop: 12 }}>{actionError}</div>}
      </div>

      {/* Current admins */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Current admins</h2>

        {loading && <div className={styles.loadingText}>Loading...</div>}
        {error   && <div className={styles.errorBox}>{error}</div>}

        {!loading && !error && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Display name</th>
                  <th>Access level</th>
                  <th>Member since</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {admins.length === 0 && (
                  <tr><td colSpan={5} className={styles.tdEmpty}>No admins found.</td></tr>
                )}
                {admins.map(a => (
                  <AdminRow
                    key={a.id}
                    admin={a}
                    revoking={revoking === a.id}
                    onRevoke={() => handleRevoke(a.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminRow({ admin, revoking, onRevoke }) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <tr>
      <td className={styles.tdMono}>{admin.email}</td>
      <td>{admin.display_name || <span className={styles.tdDim}>—</span>}</td>
      <td>
        <span className={styles.accessBadge}>{admin.cfo_access_level}</span>
      </td>
      <td className={styles.tdDim}>{timeAgo(admin.created_at)}</td>
      <td>
        {!confirmOpen ? (
          <button className={styles.btnDanger} onClick={() => setConfirmOpen(true)}>Revoke</button>
        ) : (
          <div className={styles.confirmInline}>
            <span className={styles.confirmText}>Remove admin?</span>
            <button
              className={styles.btnDangerSm}
              onClick={() => { setConfirmOpen(false); onRevoke(); }}
              disabled={revoking}
            >
              {revoking ? '...' : 'Yes'}
            </button>
            <button className={styles.btnGhostSm} onClick={() => setConfirmOpen(false)}>Cancel</button>
          </div>
        )}
      </td>
    </tr>
  );
}
