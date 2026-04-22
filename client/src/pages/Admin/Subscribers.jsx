import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../lib/api';
import styles from './Subscribers.module.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function effectiveTier(user) {
  if (user.admin_override_plan) return user.admin_override_plan;
  if (user.sub_status === 'active' && user.plan_name !== 'free') return user.plan_name;
  if (user.sub_status === 'trialling') return user.plan_name;
  return 'free';
}

function formatCurrency(amount, currency = 'gbp') {
  const symbol = currency.toLowerCase() === 'usd' ? '$' : '£';
  return `${symbol}${(amount / 100).toFixed(2)}`;
}

function timeAgo(iso) {
  const diff  = Date.now() - new Date(iso).getTime();
  const days  = Math.floor(diff / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30)  return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function initials(name, email) {
  if (name) return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

// ─── Tier badge ───────────────────────────────────────────────────────────────

function TierBadge({ tier, isOverride }) {
  return (
    <span className={`${styles.tier} ${styles[`tier_${tier}`]}`}>
      {isOverride && <span className={styles.tierDot} title="Admin override" />}
      {tier}
    </span>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const label = status === 'suspended' ? 'Suspended' : 'Active';
  const cls   = status === 'suspended' ? styles.status_suspended : styles.status_active;
  return (
    <span className={`${styles.status} ${cls}`}>
      <span className={styles.statusDot} />
      {label}
    </span>
  );
}

// ─── User drawer ──────────────────────────────────────────────────────────────

function UserDrawer({ userId, onClose, onUpdate }) {
  const [detail, setDetail]           = useState(null);
  const [loading, setLoading]         = useState(true);

  // Tier override state
  const [pickedTier, setPickedTier]   = useState(null);
  const [tierBusy, setTierBusy]       = useState(false);
  const [tierFeedback, setTierFeedback] = useState(null);

  // Suspend state
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [suspendBusy, setSuspendBusy] = useState(false);
  const [suspendFeedback, setSuspendFeedback] = useState(null);

  // Refund state
  const [refundOpen, setRefundOpen]   = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [refundBusy, setRefundBusy]   = useState(false);
  const [refundFeedback, setRefundFeedback] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/admin/users/${userId}`)
      .then(d => { setDetail(d); setPickedTier(null); })
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  async function applyTierOverride() {
    if (!pickedTier) return;
    setTierBusy(true);
    setTierFeedback(null);
    try {
      await api.post(`/admin/users/${userId}/override-tier`, { plan: pickedTier });
      setTierFeedback({ ok: true, msg: `Tier set to ${pickedTier.toUpperCase()}` });
      load();
      onUpdate();
    } catch (err) {
      setTierFeedback({ ok: false, msg: err.message || 'Failed' });
    } finally {
      setTierBusy(false);
    }
  }

  async function handleSuspend() {
    setSuspendBusy(true);
    setSuspendFeedback(null);
    try {
      await api.post(`/admin/users/${userId}/suspend`, { reason: suspendReason });
      setSuspendFeedback({ ok: true, msg: 'Account suspended' });
      setSuspendOpen(false);
      setSuspendReason('');
      load();
      onUpdate();
    } catch (err) {
      setSuspendFeedback({ ok: false, msg: err.message || 'Failed' });
    } finally {
      setSuspendBusy(false);
    }
  }

  async function handleUnsuspend() {
    setSuspendBusy(true);
    setSuspendFeedback(null);
    try {
      await api.post(`/admin/users/${userId}/unsuspend`);
      setSuspendFeedback({ ok: true, msg: 'Account restored' });
      load();
      onUpdate();
    } catch (err) {
      setSuspendFeedback({ ok: false, msg: err.message || 'Failed' });
    } finally {
      setSuspendBusy(false);
    }
  }

  async function handleRefund() {
    setRefundBusy(true);
    setRefundFeedback(null);
    try {
      const res = await api.post(`/admin/users/${userId}/refund`, { reason: refundReason });
      setRefundFeedback({
        ok:  true,
        msg: `Refund of ${formatCurrency(res.amount, res.currency)} issued`,
      });
      setRefundOpen(false);
      setRefundReason('');
      load();
    } catch (err) {
      setRefundFeedback({ ok: false, msg: err.message || 'Failed' });
    } finally {
      setRefundBusy(false);
    }
  }

  const isSuspended = detail?.tenant_status === 'suspended';
  const tier        = detail ? effectiveTier(detail) : 'free';
  const initStr     = detail ? initials(detail.display_name, detail.email) : '?';

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <aside className={styles.drawer}>

        {/* ── Header ── */}
        <div className={styles.drawerHeader}>
          <div className={styles.drawerAvatar}>{initStr}</div>
          <div className={styles.drawerIdentity}>
            <p className={styles.drawerName}>
              {detail?.display_name || detail?.email || 'Loading...'}
            </p>
            {detail?.display_name && (
              <p className={styles.drawerEmail}>{detail.email}</p>
            )}
          </div>
          <button className={styles.drawerClose} onClick={onClose} aria-label="Close">✕</button>
        </div>

        {loading && <div className={styles.drawerLoading}>Loading...</div>}

        {!loading && detail && (
          <div className={styles.drawerBody}>

            {/* ── Account overview ── */}
            <div className={styles.section}>
              <p className={styles.sectionLabel}>Overview</p>
              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <p className={styles.infoKey}>Tier</p>
                  <TierBadge tier={tier} isOverride={!!detail.admin_override_plan} />
                </div>
                <div className={styles.infoItem}>
                  <p className={styles.infoKey}>Status</p>
                  <StatusBadge status={detail.tenant_status} />
                </div>
                <div className={styles.infoItem}>
                  <p className={styles.infoKey}>Joined</p>
                  <p className={styles.infoVal}>{timeAgo(detail.created_at)}</p>
                </div>
                <div className={styles.infoItem}>
                  <p className={styles.infoKey}>Subscription</p>
                  <p className={styles.infoValMuted}>
                    {detail.sub_status === 'trialling' ? 'On trial'
                      : detail.sub_status === 'active' ? 'Active'
                      : detail.sub_status === 'admin_override' ? 'Admin grant'
                      : detail.sub_status || 'None'}
                  </p>
                </div>
              </div>
              {detail.admin_override_plan && (
                <p style={{ marginTop: 8, fontSize: 11, color: 'var(--warning)' }}>
                  Tier overridden by {detail.admin_override_by || 'admin'}.
                  Set to Free below to remove override.
                </p>
              )}
            </div>

            {/* ── Override tier ── */}
            <div className={styles.section}>
              <p className={styles.sectionLabel}>Override Tier</p>
              <div className={styles.actionCard}>
                <p className={styles.actionCardTitle}>Grant access without payment</p>
                <p className={styles.actionCardDesc}>
                  Sets the effective tier immediately, bypassing Stripe. Use Free to remove a previous override and restore natural subscription state.
                </p>
                <div className={styles.tierPicker}>
                  {['free', 'core', 'pro'].map(t => (
                    <button
                      key={t}
                      className={`${styles.tierPickBtn} ${styles[`tierPickBtn_${t}`]} ${pickedTier === t ? styles.tierPickBtnActive : ''}`}
                      onClick={() => setPickedTier(pickedTier === t ? null : t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                {pickedTier && (
                  <div className={styles.confirmStrip}>
                    <button
                      className={styles.btnPrimary}
                      onClick={applyTierOverride}
                      disabled={tierBusy}
                    >
                      {tierBusy ? 'Saving...' : `Confirm — Set ${pickedTier.toUpperCase()}`}
                    </button>
                    <button className={styles.btnGhost} onClick={() => setPickedTier(null)}>
                      Cancel
                    </button>
                    {tierFeedback && (
                      <span className={tierFeedback.ok ? styles.feedbackOk : styles.feedbackErr}>
                        {tierFeedback.msg}
                      </span>
                    )}
                  </div>
                )}
                {!pickedTier && tierFeedback && (
                  <span className={tierFeedback.ok ? styles.feedbackOk : styles.feedbackErr}>
                    {tierFeedback.msg}
                  </span>
                )}
              </div>
            </div>

            {/* ── Suspend / Unsuspend ── */}
            <div className={styles.section}>
              <p className={styles.sectionLabel}>Account Access</p>
              <div className={styles.actionCard}>
                {isSuspended ? (
                  <>
                    <p className={styles.actionCardTitle}>Account is suspended</p>
                    <p className={styles.actionCardDesc}>
                      This user cannot log in. Unsuspend to restore their access immediately.
                    </p>
                    <div className={styles.actionRow}>
                      <button
                        className={styles.btnSuccess}
                        onClick={handleUnsuspend}
                        disabled={suspendBusy}
                      >
                        {suspendBusy ? 'Restoring...' : 'Unsuspend account'}
                      </button>
                      {suspendFeedback && (
                        <span className={suspendFeedback.ok ? styles.feedbackOk : styles.feedbackErr}>
                          {suspendFeedback.msg}
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <p className={styles.actionCardTitle}>Suspend account</p>
                    <p className={styles.actionCardDesc}>
                      Blocks all API access immediately. The user will receive a 403 on their next request. Reversible at any time.
                    </p>
                    {!suspendOpen ? (
                      <div className={styles.actionRow}>
                        <button
                          className={styles.btnDanger}
                          onClick={() => setSuspendOpen(true)}
                        >
                          Suspend account
                        </button>
                        {suspendFeedback && (
                          <span className={suspendFeedback.ok ? styles.feedbackOk : styles.feedbackErr}>
                            {suspendFeedback.msg}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className={styles.confirmStrip}>
                        <input
                          className={styles.reasonInput}
                          placeholder="Reason (optional)"
                          value={suspendReason}
                          onChange={e => setSuspendReason(e.target.value)}
                          autoFocus
                        />
                        <button
                          className={styles.btnConfirmDanger}
                          onClick={handleSuspend}
                          disabled={suspendBusy}
                        >
                          {suspendBusy ? 'Suspending...' : 'Confirm'}
                        </button>
                        <button
                          className={styles.btnGhost}
                          onClick={() => { setSuspendOpen(false); setSuspendReason(''); }}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* ── Refund ── */}
            <div className={styles.section}>
              <p className={styles.sectionLabel}>Billing</p>
              <div className={styles.actionCard}>
                <p className={styles.actionCardTitle}>Issue refund</p>
                {detail.latest_payment ? (
                  <>
                    <p className={styles.paymentLine}>
                      {formatCurrency(detail.latest_payment.amount, detail.latest_payment.currency)}
                    </p>
                    <p className={styles.paymentSub}>
                      Last payment — {timeAgo(detail.latest_payment.date)}
                    </p>
                  </>
                ) : (
                  <p className={styles.noPayment}>No payment on record for this user.</p>
                )}
                {!refundOpen ? (
                  <div className={styles.actionRow}>
                    <button
                      className={styles.btnDanger}
                      onClick={() => setRefundOpen(true)}
                      disabled={!detail.latest_payment}
                    >
                      Issue full refund
                    </button>
                    {refundFeedback && (
                      <span className={refundFeedback.ok ? styles.feedbackOk : styles.feedbackErr}>
                        {refundFeedback.msg}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className={styles.confirmStrip}>
                    <input
                      className={styles.reasonInput}
                      placeholder="Reason (optional)"
                      value={refundReason}
                      onChange={e => setRefundReason(e.target.value)}
                      autoFocus
                    />
                    <button
                      className={styles.btnConfirmDanger}
                      onClick={handleRefund}
                      disabled={refundBusy}
                    >
                      {refundBusy ? 'Processing...' : 'Confirm refund'}
                    </button>
                    <button
                      className={styles.btnGhost}
                      onClick={() => { setRefundOpen(false); setRefundReason(''); }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </aside>
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

export function Subscribers() {
  const [users, setUsers]         = useState([]);
  const [total, setTotal]         = useState(0);
  const [search, setSearch]       = useState('');
  const [offset, setOffset]       = useState(0);
  const [loading, setLoading]     = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const searchRef                 = useRef(null);
  const debounceRef               = useRef(null);

  const load = useCallback((q, off) => {
    setLoading(true);
    api.get(`/admin/users?search=${encodeURIComponent(q)}&offset=${off}&limit=${PAGE_SIZE}`)
      .then(({ users: rows, total: t }) => {
        setUsers(rows ?? []);
        setTotal(t ?? 0);
      })
      .catch(err => console.error('[Subscribers]', err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(search, offset);
  }, [load, offset]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSearchChange(e) {
    const val = e.target.value;
    setSearch(val);
    setOffset(0);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(val, 0), 300);
  }

  const totalPages   = Math.ceil(total / PAGE_SIZE);
  const currentPage  = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div>
      <h1 className={styles.title}>Subscribers</h1>
      <p className={styles.subtitle}>Manage user accounts, tier access, and billing.</p>

      {/* ── Toolbar ── */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>⌕</span>
          <input
            ref={searchRef}
            className={styles.searchInput}
            type="search"
            placeholder="Search by email..."
            value={search}
            onChange={handleSearchChange}
          />
        </div>
        <span className={styles.userCount}>
          {loading ? 'Loading...' : `${total.toLocaleString()} user${total !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* ── Table ── */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Tier</th>
              <th>Status</th>
              <th>Joined</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && users.length === 0 ? (
              <tr className={styles.emptyRow}>
                <td colSpan={6}>Loading...</td>
              </tr>
            ) : users.length === 0 ? (
              <tr className={styles.emptyRow}>
                <td colSpan={6}>No users found.</td>
              </tr>
            ) : users.map(u => {
              const tier     = effectiveTier(u);
              const selected = u.id === selectedId;
              return (
                <tr
                  key={u.id}
                  className={selected ? styles.rowSelected : ''}
                  onClick={() => setSelectedId(selected ? null : u.id)}
                >
                  <td className={styles.emailCell}>{u.email}</td>
                  <td className={styles.nameCell}>{u.display_name || '—'}</td>
                  <td>
                    <TierBadge tier={tier} isOverride={!!u.admin_override_plan} />
                  </td>
                  <td>
                    <StatusBadge status={u.tenant_status} />
                  </td>
                  <td className={styles.joinedCell}>{timeAgo(u.created_at)}</td>
                  <td>
                    <button
                      className={styles.manageBtn}
                      onClick={e => { e.stopPropagation(); setSelectedId(u.id); }}
                    >
                      Manage →
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className={styles.pagination}>
            <button
              className={styles.pageBtn}
              disabled={offset === 0}
              onClick={() => setOffset(o => Math.max(0, o - PAGE_SIZE))}
            >
              ← Prev
            </button>
            <span className={styles.pageInfo}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              className={styles.pageBtn}
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset(o => o + PAGE_SIZE)}
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* ── Drawer ── */}
      {selectedId && (
        <UserDrawer
          key={selectedId}
          userId={selectedId}
          onClose={() => setSelectedId(null)}
          onUpdate={() => load(search, offset)}
        />
      )}
    </div>
  );
}
