import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import styles from './Acquisition.module.css';

const STAGES = [
  { key: 'identified',  label: 'Identified',  color: 'var(--text-tertiary)' },
  { key: 'contacted',   label: 'Contacted',   color: 'var(--info)' },
  { key: 'responded',   label: 'Responded',   color: 'var(--warning)' },
  { key: 'signed_up',   label: 'Signed up',   color: 'var(--success)' },
  { key: 'active',      label: 'Active',      color: 'var(--neon-mint, #4FB893)' },
  { key: 'rejected',    label: 'Rejected',    color: 'var(--error)' },
];

const PLATFORMS = ['youtube','tiktok','instagram','twitter','podcast','newsletter','other'];

const EVENT_LABELS = {
  note:            'Note',
  stage_change:    'Stage changed',
  outreach_sent:   'Outreach sent',
  reply_received:  'Reply received',
  meeting_booked:  'Meeting booked',
  signed_up:       'Signed up',
};

function fmtNum(n) {
  const v = parseInt(n);
  if (!v) return '—';
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`;
  return v.toString();
}

function timeAgo(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  if (mins < 60)   return `${mins}m ago`;
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 24)  return `${hours}h ago`;
  const days  = Math.floor(diff / 86_400_000);
  if (days < 30)   return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function StagePip({ stage }) {
  const s = STAGES.find(x => x.key === stage) || STAGES[0];
  return <span className={styles.stagePip} style={{ '--pip-color': s.color }}>{s.label}</span>;
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function Acquisition() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [stats,           setStats]           = useState(null);
  const [prospects,       setProspects]        = useState([]);
  const [total,           setTotal]            = useState(0);
  const [loading,         setLoading]          = useState(true);
  const [error,           setError]            = useState(null);
  const [gmailConnected,  setGmailConnected]   = useState(null); // null = loading
  const [gmailAddress,    setGmailAddress]     = useState(null);
  const [gmailBanner,     setGmailBanner]      = useState(null); // 'success' | null

  const [activeStage, setActiveStage] = useState('all');
  const [search,      setSearch]      = useState('');

  const [drawer,  setDrawer]  = useState(null);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get('gmail_connected') === '1') {
      setGmailBanner('success');
      setSearchParams({}, { replace: true });
    }
    checkGmail();
  }, []);

  useEffect(() => { loadAll(); }, [activeStage, search]);

  async function checkGmail() {
    try {
      const data = await api.get('/admin/gmail/status');
      setGmailConnected(data.connected);
      if (data.gmailAddress) setGmailAddress(data.gmailAddress);
    } catch {
      setGmailConnected(false);
    }
  }

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (activeStage !== 'all') params.set('stage', activeStage);
      if (search) params.set('search', search);
      const [data, statsData] = await Promise.all([
        api.get(`/admin/acquisition/prospects?${params}`),
        api.get('/admin/acquisition/stats'),
      ]);
      setProspects(data.prospects || []);
      setTotal(data.total || 0);
      setStats(statsData);
    } catch (err) {
      setError(err.message || 'Failed to load prospects');
    } finally {
      setLoading(false);
    }
  }

  async function openDrawer(prospect) {
    try {
      const data = await api.get(`/admin/acquisition/prospects/${prospect.id}`);
      setDrawer(data);
    } catch {
      setDrawer({ prospect, events: [] });
    }
  }

  function handleDrawerUpdated() {
    loadAll();
    if (drawer) openDrawer(drawer.prospect);
  }

  return (
    <div>
      {/* Gmail banner */}
      {gmailBanner === 'success' && (
        <div className={styles.gmailSuccessBanner}>
          Gmail connected successfully. Outreach will be sent from {gmailAddress}.
          <button className={styles.bannerClose} onClick={() => setGmailBanner(null)}>✕</button>
        </div>
      )}

      {gmailConnected === false && (
        <div className={styles.gmailWarnBanner}>
          <span>Connect Gmail to send outreach directly from Creatrbase.</span>
          <a href="/api/admin/gmail/connect" className={styles.bannerBtn}>Connect Gmail</a>
        </div>
      )}

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Acquisition</h1>
          <p className={styles.subtitle}>Track and manage creator outreach from first contact to active user.</p>
        </div>
        <div className={styles.headerActions}>
          {gmailConnected && (
            <span className={styles.gmailStatus}>
              <span className={styles.gmailDot} /> {gmailAddress}
            </span>
          )}
          <button className={styles.btnPrimary} onClick={() => setAddOpen(true)}>
            + Add prospect
          </button>
        </div>
      </div>

      {/* Stats strip */}
      {stats && (
        <div className={styles.statsStrip}>
          {STAGES.map(s => (
            <button
              key={s.key}
              className={`${styles.statBtn} ${activeStage === s.key ? styles.statBtnActive : ''}`}
              style={{ '--pip-color': s.color }}
              onClick={() => setActiveStage(activeStage === s.key ? 'all' : s.key)}
            >
              <span className={styles.statCount}>{stats.by_stage?.[s.key] || 0}</span>
              <span className={styles.statLabel}>{s.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Filter bar */}
      <div className={styles.filterBar}>
        <input
          className={styles.searchInput}
          type="search"
          placeholder="Search by name or niche..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {activeStage !== 'all' && (
          <button className={styles.clearFilter} onClick={() => setActiveStage('all')}>
            Clear filter
          </button>
        )}
      </div>

      {/* Table */}
      <div className={styles.tableSection}>
        {error   && <div className={styles.errorBox}>{error}</div>}
        {loading && <div className={styles.loadingText}>Loading...</div>}

        {!loading && !error && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Channel</th>
                  <th>Platform</th>
                  <th>Niche</th>
                  <th>Subs</th>
                  <th>Stage</th>
                  <th>Assigned to</th>
                  <th>Activity</th>
                </tr>
              </thead>
              <tbody>
                {prospects.length === 0 && (
                  <tr><td colSpan={7} className={styles.tdEmpty}>
                    {activeStage !== 'all' || search ? 'No prospects match this filter.' : 'No prospects yet. Add your first one.'}
                  </td></tr>
                )}
                {prospects.map(p => (
                  <tr key={p.id} className={styles.row} onClick={() => openDrawer(p)}>
                    <td>
                      <div className={styles.channelName}>
                        {p.channel_name}
                        {p.stage === 'responded' && <span className={styles.replyBadge}>replied</span>}
                      </div>
                      {p.channel_url && (
                        <a
                          href={p.channel_url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className={styles.channelUrl}
                          onClick={e => e.stopPropagation()}
                        >
                          {p.channel_url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 40)}
                        </a>
                      )}
                    </td>
                    <td><span className={styles.platformTag}>{p.platform}</span></td>
                    <td className={styles.tdSecondary}>{p.niche || '—'}</td>
                    <td className={styles.tdMono}>{fmtNum(p.est_subs)}</td>
                    <td><StagePip stage={p.stage} /></td>
                    <td className={styles.tdSecondary}>{p.assigned_admin_email || '—'}</td>
                    <td className={styles.tdSecondary}>{timeAgo(p.last_activity_at || p.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drawer */}
      {drawer && (
        <ProspectDrawer
          data={drawer}
          gmailConnected={gmailConnected}
          onClose={() => setDrawer(null)}
          onUpdate={handleDrawerUpdated}
        />
      )}

      {/* Add modal */}
      {addOpen && (
        <AddProspectModal
          onClose={() => setAddOpen(false)}
          onAdded={() => { setAddOpen(false); loadAll(); }}
        />
      )}
    </div>
  );
}

// ── Prospect detail drawer ────────────────────────────────────────────────────

function ProspectDrawer({ data, gmailConnected, onClose, onUpdate }) {
  const { prospect: p, events } = data;
  const [stage,         setStage]         = useState(p.stage);
  const [note,          setNote]          = useState('');
  const [evtType,       setEvtType]       = useState('note');
  const [channel,       setChannel]       = useState('');
  const [saving,        setSaving]        = useState(false);
  const [deleting,      setDeleting]      = useState(false);
  const [stageUpdating, setStageUpdating] = useState(false);
  const [composeMode,   setComposeMode]   = useState(null); // 'outreach' | 'followup' | null
  const overlayRef = useRef(null);

  const canOutreach  = gmailConnected && p.email && !p.gmail_thread_id;
  const canFollowUp  = gmailConnected && p.email && !!p.gmail_thread_id;

  async function handleStageChange(newStage) {
    if (newStage === stage) return;
    setStageUpdating(true);
    try {
      await api.patch(`/admin/acquisition/prospects/${p.id}`, { stage: newStage });
      setStage(newStage);
      onUpdate();
    } catch (err) {
      alert(err.message || 'Update failed');
    } finally {
      setStageUpdating(false);
    }
  }

  async function handleLogEvent(e) {
    e.preventDefault();
    if (!note.trim()) return;
    setSaving(true);
    try {
      await api.post(`/admin/acquisition/prospects/${p.id}/events`, {
        event_type: evtType,
        channel:    channel || undefined,
        note:       note.trim(),
      });
      setNote('');
      setChannel('');
      onUpdate();
    } catch (err) {
      alert(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete ${p.channel_name}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/acquisition/prospects/${p.id}`);
      onClose();
      onUpdate();
    } catch (err) {
      alert(err.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className={styles.overlay}
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className={styles.drawer}>
        {/* Drawer header */}
        <div className={styles.drawerHeader}>
          <div>
            <h2 className={styles.drawerTitle}>{p.channel_name}</h2>
            <div className={styles.drawerMeta}>
              <span className={styles.platformTag}>{p.platform}</span>
              {p.niche     && <span className={styles.drawerMetaText}>{p.niche}</span>}
              {p.est_subs  && <span className={styles.drawerMetaText}>{fmtNum(p.est_subs)} subs</span>}
              {p.email     && <span className={styles.drawerMetaText}>{p.email}</span>}
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Stage selector */}
        <div className={styles.stageRow}>
          <span className={styles.stageRowLabel}>Stage</span>
          <div className={styles.stageBtns}>
            {STAGES.map(s => (
              <button
                key={s.key}
                className={`${styles.stageBtn} ${stage === s.key ? styles.stageBtnActive : ''}`}
                style={{ '--pip-color': s.color }}
                onClick={() => handleStageChange(s.key)}
                disabled={stageUpdating}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Email outreach actions */}
        {p.email && (
          <div className={styles.outreachRow}>
            {canOutreach && (
              <button className={styles.btnOutreach} onClick={() => setComposeMode('outreach')}>
                Send outreach email
              </button>
            )}
            {canFollowUp && (
              <button className={styles.btnOutreach} onClick={() => setComposeMode('followup')}>
                Send follow-up
              </button>
            )}
            {p.gmail_thread_id && (
              <span className={styles.threadLabel}>Thread active</span>
            )}
            {!gmailConnected && (
              <a href="/api/admin/gmail/connect" className={styles.connectGmailLink}>
                Connect Gmail to send outreach
              </a>
            )}
          </div>
        )}

        {p.channel_url && (
          <a href={p.channel_url} target="_blank" rel="noreferrer noopener" className={styles.channelLink}>
            {p.channel_url}
          </a>
        )}

        {p.notes && (
          <div className={styles.notesBox}>
            <span className={styles.notesLabel}>Notes</span>
            <p className={styles.notesText}>{p.notes}</p>
          </div>
        )}

        {/* Event log */}
        <div className={styles.eventLog}>
          <h3 className={styles.eventLogTitle}>Activity log</h3>
          {(!events || events.length === 0) && (
            <p className={styles.emptyLog}>No activity yet.</p>
          )}
          {events && events.map(ev => (
            <div key={ev.id} className={styles.eventItem}>
              <div className={styles.eventDot} />
              <div className={styles.eventContent}>
                <div className={styles.eventHeader}>
                  <span className={styles.eventType}>{EVENT_LABELS[ev.event_type] || ev.event_type}</span>
                  {ev.channel && <span className={styles.eventChannel}>{ev.channel}</span>}
                  <span className={styles.eventTime}>{timeAgo(ev.created_at)}</span>
                </div>
                {ev.note      && <p className={styles.eventNote}>{ev.note}</p>}
                {ev.admin_email && <span className={styles.eventAdmin}>{ev.admin_email}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Log event form */}
        <form className={styles.logForm} onSubmit={handleLogEvent}>
          <h3 className={styles.logFormTitle}>Log activity</h3>
          <div className={styles.logFormRow}>
            <select className={styles.select} value={evtType} onChange={e => setEvtType(e.target.value)}>
              <option value="note">Note</option>
              <option value="outreach_sent">Outreach sent</option>
              <option value="reply_received">Reply received</option>
              <option value="meeting_booked">Meeting booked</option>
              <option value="signed_up">Signed up</option>
            </select>
            <select className={styles.select} value={channel} onChange={e => setChannel(e.target.value)}>
              <option value="">Channel (optional)</option>
              <option value="email">Email</option>
              <option value="twitter">Twitter / X</option>
              <option value="instagram">Instagram</option>
              <option value="linkedin">LinkedIn</option>
              <option value="direct">Direct message</option>
              <option value="other">Other</option>
            </select>
          </div>
          <textarea
            className={styles.textarea}
            placeholder="Add a note..."
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={2}
          />
          <div className={styles.logFormActions}>
            <button className={styles.btnPrimary} type="submit" disabled={saving || !note.trim()}>
              {saving ? 'Saving...' : 'Log activity'}
            </button>
            <button
              type="button"
              className={styles.btnDangerText}
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete prospect'}
            </button>
          </div>
        </form>
      </div>

      {/* Compose modal — rendered inside overlay so it stacks correctly */}
      {composeMode && (
        <ComposeModal
          prospect={p}
          mode={composeMode}
          onClose={() => setComposeMode(null)}
          onSent={() => { setComposeMode(null); onUpdate(); }}
        />
      )}
    </div>
  );
}

// ── Compose modal ─────────────────────────────────────────────────────────────

function ComposeModal({ prospect, mode, onClose, onSent }) {
  const isFollowUp = mode === 'followup';
  const [subject, setSubject] = useState(
    isFollowUp
      ? (prospect.outreach_subject ? `Re: ${prospect.outreach_subject}` : 'Following up')
      : ''
  );
  const [body,    setBody]    = useState('');
  const [sending, setSending] = useState(false);
  const [error,   setError]   = useState(null);

  async function handleSend(e) {
    e.preventDefault();
    if (!body.trim()) return;
    if (!isFollowUp && !subject.trim()) return;
    setSending(true);
    setError(null);
    try {
      const endpoint = isFollowUp
        ? `/admin/acquisition/prospects/${prospect.id}/follow-up`
        : `/admin/acquisition/prospects/${prospect.id}/send-email`;
      const payload = isFollowUp
        ? { body: body.trim() }
        : { subject: subject.trim(), body: body.trim() };
      await api.post(endpoint, payload);
      onSent();
    } catch (err) {
      setError(err.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={styles.composeOverlay} onClick={e => e.stopPropagation()}>
      <div className={styles.composeModal}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            {isFollowUp ? 'Send follow-up' : 'Send outreach email'}
          </h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSend} className={styles.composeForm}>
          <label className={styles.formLabel}>
            To
            <input className={`${styles.input} ${styles.inputReadonly}`} type="text" value={prospect.email} readOnly />
          </label>

          {!isFollowUp && (
            <label className={styles.formLabel}>
              Subject *
              <input
                className={styles.input}
                type="text"
                required
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="e.g. Collaboration opportunity with Creatrbase"
                autoFocus
              />
            </label>
          )}

          {isFollowUp && (
            <label className={styles.formLabel}>
              Subject
              <input className={`${styles.input} ${styles.inputReadonly}`} type="text" value={subject} readOnly />
            </label>
          )}

          <label className={styles.formLabel}>
            Message *
            <textarea
              className={styles.textarea}
              required
              rows={8}
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Write your message here..."
              autoFocus={isFollowUp}
            />
          </label>

          {error && <div className={styles.errorBox}>{error}</div>}

          <div className={styles.modalActions}>
            <button className={styles.btnPrimary} type="submit" disabled={sending || !body.trim()}>
              {sending ? 'Sending...' : 'Send'}
            </button>
            <button type="button" className={styles.btnGhost} onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Add prospect modal ────────────────────────────────────────────────────────

function AddProspectModal({ onClose, onAdded }) {
  const [form,   setForm]   = useState({ platform: 'youtube', channel_name: '', channel_url: '', email: '', niche: '', est_subs: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);
  const overlayRef = useRef(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.channel_name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        platform:     form.platform,
        channel_name: form.channel_name.trim(),
        channel_url:  form.channel_url.trim()  || undefined,
        email:        form.email.trim()         || undefined,
        niche:        form.niche.trim()         || undefined,
        est_subs:     form.est_subs ? parseInt(form.est_subs) : undefined,
        notes:        form.notes.trim()         || undefined,
      };
      const data = await api.post('/admin/acquisition/prospects', payload);
      onAdded(data.prospect);
    } catch (err) {
      setError(err.message || 'Failed to add prospect');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={styles.overlay}
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Add prospect</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className={styles.addForm}>
          <label className={styles.formLabel}>
            Platform
            <select className={styles.select} value={form.platform} onChange={e => set('platform', e.target.value)}>
              {PLATFORMS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
          </label>

          <label className={styles.formLabel}>
            Channel / creator name *
            <input className={styles.input} type="text" required value={form.channel_name} onChange={e => set('channel_name', e.target.value)} placeholder="e.g. TechWithTim" />
          </label>

          <label className={styles.formLabel}>
            Channel URL
            <input className={styles.input} type="url" value={form.channel_url} onChange={e => set('channel_url', e.target.value)} placeholder="https://..." />
          </label>

          <label className={styles.formLabel}>
            Contact email
            <input className={styles.input} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="creator@example.com" />
          </label>

          <div className={styles.formRow}>
            <label className={styles.formLabel}>
              Niche
              <input className={styles.input} type="text" value={form.niche} onChange={e => set('niche', e.target.value)} placeholder="e.g. personal finance" />
            </label>
            <label className={styles.formLabel}>
              Est. subscribers
              <input className={styles.input} type="number" value={form.est_subs} onChange={e => set('est_subs', e.target.value)} placeholder="e.g. 50000" min="0" />
            </label>
          </div>

          <label className={styles.formLabel}>
            Notes
            <textarea className={styles.textarea} value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder="Any initial context..." />
          </label>

          {error && <div className={styles.errorBox}>{error}</div>}

          <div className={styles.modalActions}>
            <button className={styles.btnPrimary} type="submit" disabled={saving || !form.channel_name.trim()}>
              {saving ? 'Adding...' : 'Add prospect'}
            </button>
            <button type="button" className={styles.btnGhost} onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
