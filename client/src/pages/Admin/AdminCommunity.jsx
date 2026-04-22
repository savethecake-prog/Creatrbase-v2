import { useState, useEffect, useRef } from 'react';
import { api } from '../../lib/api';
import styles from './AdminCommunity.module.css';

const STATUS_TABS = [
  { key: '',           label: 'All' },
  { key: 'open',       label: 'Open' },
  { key: 'considering',label: 'Considering' },
  { key: 'declined',   label: 'Declined' },
  { key: 'promoted',   label: 'Promoted' },
  { key: 'archived',   label: 'Archived' },
];

const STATUS_LABELS = {
  open: 'Open', considering: 'Considering',
  declined: 'Declined', archived: 'Archived', promoted: 'Promoted',
};

const STATUS_COLORS = {
  open: 'open', considering: 'considering',
  declined: 'declined', archived: 'archived', promoted: 'promoted',
};

function EmailAuthorModal({ suggestion, onClose }) {
  const [subject, setSubject] = useState(`Re: "${suggestion.title}"`);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState('');

  async function handleSend(e) {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    setSending(true); setError('');
    try {
      await api.post(`/admin/community/suggestions/${suggestion.id}/email-author`, { subject, message });
      setSent(true);
    } catch (err) {
      setError(err?.message || 'Failed to send email.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Email author</h2>
          <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Close">&times;</button>
        </div>
        {sent ? (
          <div className={styles.sentConfirm}>
            <p>Email sent to {suggestion.author_email}.</p>
            <button type="button" className={styles.saveBtn} onClick={onClose}>Close</button>
          </div>
        ) : (
          <form onSubmit={handleSend} className={styles.form}>
            <p className={styles.emailTo}>To: <strong>{suggestion.author_name}</strong> ({suggestion.author_email})</p>
            <div className={styles.field}>
              <label className={styles.label}>Subject</label>
              <input className={styles.input} value={subject} onChange={e => setSubject(e.target.value)} required />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Message</label>
              <textarea className={`${styles.input} ${styles.textarea}`} rows={6} value={message} onChange={e => setMessage(e.target.value)} required />
            </div>
            {error && <p className={styles.error}>{error}</p>}
            <div className={styles.actions}>
              <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
              <button type="submit" className={styles.saveBtn} disabled={sending || !message.trim()}>
                {sending ? 'Sending...' : 'Send email'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function DeclineModal({ suggestion, onClose, onDecline }) {
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError]   = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!reason.trim()) { setError('Please provide a reason.'); return; }
    setSending(true); setError('');
    try {
      await onDecline(suggestion.id, reason);
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to decline.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Decline suggestion</h2>
          <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className={styles.form}>
          <p className={styles.declineContext}>
            <strong>"{suggestion.title}"</strong>
          </p>
          <div className={styles.field}>
            <label className={styles.label}>Reason (sent to author)</label>
            <textarea
              className={`${styles.input} ${styles.textarea}`}
              rows={4}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Explain why this suggestion is being declined..."
              required
            />
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.declineBtn} disabled={sending || !reason.trim()}>
              {sending ? 'Declining...' : 'Decline and notify'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PromoteModal({ suggestion, onClose, onPromote }) {
  const [status, setStatus]         = useState('scoping');
  const [launchDate, setLaunchDate] = useState('');
  const [tag, setTag]               = useState('');
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  const STAGES = ['scoping', 'planning', 'building', 'launching'];

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await onPromote(suggestion.id, { status, launch_date: launchDate || null, tag: tag || null });
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to promote.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Promote to roadmap</h2>
          <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className={styles.form}>
          <p className={styles.declineContext}><strong>"{suggestion.title}"</strong> will be added to the roadmap.</p>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Stage</label>
              <select className={`${styles.input} ${styles.select}`} value={status} onChange={e => setStatus(e.target.value)}>
                {STAGES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Target date</label>
              <input type="date" className={styles.input} value={launchDate} onChange={e => setLaunchDate(e.target.value)} />
            </div>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Tag</label>
            <input className={styles.input} value={tag} onChange={e => setTag(e.target.value)} placeholder="Optional tag" />
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.promoteBtn} disabled={saving}>
              {saving ? 'Promoting...' : 'Add to roadmap'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AdminCommunity() {
  const [suggestions, setSuggestions] = useState([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState('open');
  const [search, setSearch]     = useState('');
  const [modal, setModal]       = useState(null); // { type, suggestion }
  const [toast, setToast]       = useState('');   // brief status-change feedback

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  function load(tab = activeTab, q = search) {
    setLoading(true);
    const params = new URLSearchParams({ limit: '50' });
    if (tab) params.set('status', tab);
    if (q)   params.set('search', q);
    api.get(`/admin/community/suggestions?${params}`)
      .then(r => { setSuggestions(r.suggestions || []); setTotal(r.total || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []); // eslint-disable-line

  function handleTabChange(tab) {
    setActiveTab(tab);
    load(tab, search);
  }

  function handleSearch(e) {
    e.preventDefault();
    load(activeTab, search);
  }

  async function handleStatus(id, status, extra = {}) {
    await api.patch(`/admin/community/suggestions/${id}/status`, { status, ...extra });
    // Reload current tab so the item moves to its correct filtered view
    load(activeTab, search);
    const labels = { considering: 'Considering', declined: 'Declined', archived: 'Archived', open: 'Open' };
    showToast(`Moved to ${labels[status] || status} — switch tabs to see it`);
  }

  async function handleDecline(id, decline_reason) {
    // Capture suggestion before list reloads
    const s = suggestions.find(x => x.id === id);
    await api.patch(`/admin/community/suggestions/${id}/status`, { status: 'declined', decline_reason });
    load(activeTab, search);
    showToast('Declined and moved — check the Declined tab');
    if (s?.author_email) {
      try {
        await api.post(`/admin/community/suggestions/${id}/email-author`, {
          subject: `Your Creatrbase suggestion: "${s.title}"`,
          message: `Hi ${s.author_name || 'there'},\n\nThank you for your suggestion. After review, we are not able to take it forward at this time.\n\nReason: ${decline_reason}\n\nWe appreciate your input and hope to see more ideas from you.\n\nThe Creatrbase team`,
        });
      } catch { /* best-effort */ }
    }
  }

  async function handlePromote(id, opts) {
    await api.post(`/admin/community/suggestions/${id}/promote`, opts);
    load(activeTab, search);
    showToast('Promoted to roadmap — check the Promoted tab');
  }

  return (
    <div className={styles.page}>
      {toast && <div className={styles.toast}>{toast}</div>}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Community Suggestions</h1>
        <form className={styles.searchForm} onSubmit={handleSearch}>
          <input
            className={styles.searchInput}
            type="search"
            placeholder="Search suggestions..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button type="submit" className={styles.searchBtn}>Search</button>
        </form>
      </div>

      <div className={styles.tabs}>
        {STATUS_TABS.map(t => (
          <button
            key={t.key}
            type="button"
            className={`${styles.tab} ${activeTab === t.key ? styles.tabActive : ''}`}
            onClick={() => handleTabChange(t.key)}
          >
            {t.label}
          </button>
        ))}
        <span className={styles.totalCount}>{total} total</span>
      </div>

      {loading && <p className={styles.loadingText}>Loading...</p>}

      {!loading && suggestions.length === 0 && (
        <p className={styles.emptyText}>No suggestions here.</p>
      )}

      {!loading && suggestions.length > 0 && (
        <div className={styles.list}>
          {suggestions.map(s => (
            <div key={s.id} className={styles.row}>
              <div className={styles.rowVotes}>
                <span className={styles.netScore}>+{s.upvotes || 0}</span>
                <span className={styles.netMinus}>-{s.downvotes || 0}</span>
              </div>
              <div className={styles.rowBody}>
                <p className={styles.rowTitle}>{s.title}</p>
                {s.description && <p className={styles.rowDesc}>{s.description}</p>}
                <div className={styles.rowMeta}>
                  {s.category_name && <span className={styles.catBadge}>{s.category_name}</span>}
                  <span className={styles.author}>by {s.author_name || 'unknown'} ({s.author_email || 'no email'})</span>
                  <span className={`${styles.statusBadge} ${styles[`status_${STATUS_COLORS[s.status]}`]}`}>
                    {STATUS_LABELS[s.status] || s.status}
                  </span>
                </div>
                {s.decline_reason && (
                  <p className={styles.declineReason}>Declined: {s.decline_reason}</p>
                )}
              </div>
              <div className={styles.rowActions}>
                {s.status === 'open' && (
                  <button type="button" className={styles.actionBtn} onClick={() => handleStatus(s.id, 'considering')}>
                    Consider
                  </button>
                )}
                {['open', 'considering'].includes(s.status) && (
                  <button type="button" className={styles.promoteBtn} onClick={() => setModal({ type: 'promote', suggestion: s })}>
                    Promote
                  </button>
                )}
                {['open', 'considering'].includes(s.status) && (
                  <button type="button" className={styles.declineBtn} onClick={() => setModal({ type: 'decline', suggestion: s })}>
                    Decline
                  </button>
                )}
                {s.status !== 'archived' && (
                  <button type="button" className={styles.archiveBtn} onClick={() => handleStatus(s.id, 'archived')}>
                    Archive
                  </button>
                )}
                {s.author_email && (
                  <button type="button" className={styles.emailBtn} onClick={() => setModal({ type: 'email', suggestion: s })}>
                    Email
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal?.type === 'email' && (
        <EmailAuthorModal suggestion={modal.suggestion} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'decline' && (
        <DeclineModal
          suggestion={modal.suggestion}
          onClose={() => setModal(null)}
          onDecline={handleDecline}
        />
      )}
      {modal?.type === 'promote' && (
        <PromoteModal
          suggestion={modal.suggestion}
          onClose={() => setModal(null)}
          onPromote={handlePromote}
        />
      )}
    </div>
  );
}
