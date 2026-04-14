import { useState, useEffect, useCallback } from 'react';
import { Badge } from '../../components/ui/Badge/Badge';
import { useAuth } from '../../lib/AuthContext';
import { api } from '../../lib/api';
import styles from './BrandModal.module.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORY_LABELS = {
  gaming_hardware:      'Gaming Hardware',
  gaming_software:      'Gaming Software',
  gaming_nutrition:     'Gaming Nutrition',
  gaming_apparel:       'Gaming Apparel',
  d2c_grooming:         'D2C Grooming',
  d2c_wellness:         'D2C Wellness',
  d2c_tech_accessories: 'D2C Tech',
  publisher:            'Publisher',
  other:                'Other',
};

const PROGRAMME_LABELS = {
  direct:           'Direct programme',
  agency_managed:   'Agency managed',
  platform_managed: 'Platform managed',
  unknown:          'Programme unknown',
};

const CONFIDENCE_VARIANT = {
  established: 'mint',
  partial:     'peach',
  minimal:     'lavender',
};

const INTERACTION_LABELS = {
  outreach_sent:        'Outreach sent',
  outreach_responded:   'Responded',
  outreach_declined:    'Declined',
  deal_negotiating:     'Negotiating',
  deal_completed:       'Deal completed',
  relationship_ongoing: 'Ongoing relationship',
};

const INTERACTION_DOT = {
  outreach_sent:        styles.historyDotSent,
  outreach_responded:   styles.historyDotResponse,
  outreach_declined:    styles.historyDotDeclined,
  deal_negotiating:     styles.historyDotDeal,
  deal_completed:       styles.historyDotDeal,
  relationship_ongoing: styles.historyDotDeal,
};

function formatRate(low, high, currency) {
  const sym = currency === 'USD' ? '$' : '£';
  const fmt = n => {
    const v = Math.round(n / 100);
    return v >= 1000 ? `${sym}${(v / 1000).toFixed(1)}k` : `${sym}${v}`;
  };
  if (!low && !high) return null;
  if (low && high) return `${fmt(low)} – ${fmt(high)}`;
  if (high) return `up to ${fmt(high)}`;
  return fmt(low);
}

function fmtDate(dateStr) {
  return new Date(dateStr).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function buildEmailTemplate({ brand, niche, displayName }) {
  const nicheStr = niche ? niche.replace(/_/g, ' ') : 'gaming';
  return `Subject: Creator Partnership Inquiry — ${displayName}

Hi ${brand.brand_name} Partnerships Team,

My name is ${displayName} and I'm a ${nicheStr} content creator on YouTube.

I'm reaching out to explore a potential partnership with ${brand.brand_name}. Your products align closely with the content I create, and I believe there's a genuine fit with my audience.

I'd love to learn more about your current creator programme or discuss what a collaboration could look like.

Would you be open to a quick conversation, or could you point me to the right person?

Best regards,
${displayName}`;
}

// ── BrandModal ────────────────────────────────────────────────────────────────

export function BrandModal({ brand, niche, onClose, onOutreachLogged }) {
  const { user } = useAuth();
  const [tab,         setTab]         = useState('details'); // 'details' | 'compose' | 'history'
  const [template,    setTemplate]    = useState('');
  const [copied,      setCopied]      = useState(false);
  const [markingDone, setMarkingDone] = useState(false);
  const [marked,      setMarked]      = useState(false);
  const [history,     setHistory]     = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Pre-fill template when switching to compose
  useEffect(() => {
    if (tab === 'compose' && !template) {
      setTemplate(buildEmailTemplate({
        brand,
        niche,
        displayName: user?.displayName ?? 'Your Name',
      }));
    }
  }, [tab]);

  // Load history when switching to history tab
  useEffect(() => {
    if (tab === 'history') {
      api.get(`/brands/${brand.id}/outreach`)
        .then(res => setHistory(res.history))
        .catch(() => setHistory([]));
    }
  }, [tab, brand.id]);

  // Close on Escape
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(template);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback: select the textarea
      document.querySelector('textarea')?.select();
    }
  }

  async function handleMarkSent() {
    setMarkingDone(true);
    try {
      await api.post(`/brands/${brand.id}/outreach`, { notes: null });
      setMarked(true);
      onOutreachLogged(brand.id, 'outreach_sent');
    } catch {
      // best-effort
    } finally {
      setMarkingDone(false);
    }
  }

  async function handleStatusUpdate(interactionType) {
    setUpdatingStatus(true);
    try {
      await api.post(`/brands/${brand.id}/outreach/status`, { interactionType });
      onOutreachLogged(brand.id, interactionType);
      // Refresh history
      const res = await api.get(`/brands/${brand.id}/outreach`);
      setHistory(res.history);
    } catch {
      // best-effort
    } finally {
      setUpdatingStatus(false);
    }
  }

  // Check if already contacted (from latest_interaction on brand)
  const alreadyContacted = !!brand.latest_interaction || marked;

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <p className={styles.brandName}>{brand.brand_name}</p>
            <div className={styles.headerMeta}>
              <Badge variant={CONFIDENCE_VARIANT[brand.registry_confidence] ?? 'lavender'}>
                {brand.registry_confidence}
              </Badge>
              <span className={styles.metaDot} />
              <span className={styles.metaText}>
                {CATEGORY_LABELS[brand.category] ?? brand.category}
              </span>
              {brand.creator_programme_type && brand.creator_programme_type !== 'unknown' && (
                <>
                  <span className={styles.metaDot} />
                  <span className={styles.metaText}>
                    {PROGRAMME_LABELS[brand.creator_programme_type]}
                  </span>
                </>
              )}
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === 'details'  ? styles.tabActive : ''}`}
            onClick={() => setTab('details')}
          >
            Details
          </button>
          <button
            className={`${styles.tab} ${tab === 'compose'  ? styles.tabActive : ''}`}
            onClick={() => setTab('compose')}
          >
            Compose outreach
          </button>
          <button
            className={`${styles.tab} ${tab === 'history'  ? styles.tabActive : ''}`}
            onClick={() => setTab('history')}
          >
            History {alreadyContacted && '·'}
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>

          {/* ── Details tab ── */}
          {tab === 'details' && (
            <>
              {brand.notes && (
                <div className={styles.section}>
                  <p className={styles.sectionLabel}>Programme intelligence</p>
                  <p className={styles.notes}>{brand.notes}</p>
                </div>
              )}

              {brand.geo_presence?.length > 0 && (
                <div className={styles.section}>
                  <p className={styles.sectionLabel}>Geographic presence</p>
                  <div className={styles.geoRow}>
                    {brand.geo_presence.map(g => (
                      <span key={g} className={styles.geoChip}>{g}</span>
                    ))}
                  </div>
                </div>
              )}

              {(brand.website || brand.partnership_url || brand.partnership_email) && (
                <div className={styles.section}>
                  <p className={styles.sectionLabel}>Contact & links</p>
                  <div className={styles.linkRow}>
                    {brand.partnership_url && (
                      <a href={brand.partnership_url} target="_blank" rel="noopener noreferrer" className={styles.link}>
                        Programme page ↗
                      </a>
                    )}
                    {brand.website && (
                      <a href={brand.website} target="_blank" rel="noopener noreferrer" className={styles.link}>
                        Website ↗
                      </a>
                    )}
                    {brand.partnership_email && (
                      <a href={`mailto:${brand.partnership_email}`} className={styles.link}>
                        {brand.partnership_email}
                      </a>
                    )}
                  </div>
                </div>
              )}

              {brand.tier_profiles?.length > 0 && (
                <div className={styles.section}>
                  <p className={styles.sectionLabel}>Rate intelligence</p>
                  <div className={styles.rateTable}>
                    {brand.tier_profiles.map((tp, i) => {
                      const rateStr = formatRate(tp.rate_range_low, tp.rate_range_high, tp.rate_currency);
                      const statusClass =
                        tp.buying_window_status === 'active'  ? styles.rateStatusActive :
                        tp.buying_window_status === 'warming' ? styles.rateStatusWarming :
                        styles.rateStatusInactive;
                      return (
                        <div key={i} className={styles.rateRow}>
                          <span className={styles.rateTier}>{tp.creator_tier}</span>
                          <span className={`${styles.rateStatus} ${statusClass}`}>
                            {tp.buying_window_status}
                          </span>
                          <span className={styles.rateRange}>
                            {rateStr
                              ? `${rateStr} · ${(tp.typical_deliverable ?? '').replace(/_/g, ' ')}`
                              : 'Rate data pending'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Compose tab ── */}
          {tab === 'compose' && (
            <>
              <p className={styles.composeIntro}>
                Edit the template below, copy it, then send from your own email client.
                {brand.partnership_email && (
                  <> Sending to: <strong>{brand.partnership_email}</strong></>
                )}
              </p>

              <textarea
                className={styles.templateArea}
                value={template}
                onChange={e => setTemplate(e.target.value)}
                spellCheck
              />

              <div className={styles.composeActions}>
                <button
                  className={`${styles.composeBtn} ${styles.composeBtnPrimary}`}
                  onClick={handleCopy}
                >
                  {copied ? 'Copied!' : 'Copy to clipboard'}
                </button>

                {!marked && !brand.latest_interaction ? (
                  <button
                    className={styles.composeBtn}
                    onClick={handleMarkSent}
                    disabled={markingDone}
                  >
                    {markingDone ? 'Logging…' : 'Mark as sent'}
                  </button>
                ) : (
                  <span className={styles.copyHint}>Outreach logged</span>
                )}
              </div>

              {alreadyContacted && (
                <div className={styles.statusRow}>
                  <p className={styles.statusLabel}>Update status</p>
                  <div className={styles.statusBtns}>
                    {[
                      { type: 'outreach_responded',   label: 'They responded' },
                      { type: 'outreach_declined',     label: 'Declined' },
                      { type: 'deal_negotiating',      label: 'Negotiating' },
                      { type: 'deal_completed',        label: 'Deal done' },
                      { type: 'relationship_ongoing',  label: 'Ongoing' },
                    ].map(({ type, label }) => (
                      <button
                        key={type}
                        className={styles.statusBtn}
                        onClick={() => handleStatusUpdate(type)}
                        disabled={updatingStatus}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── History tab ── */}
          {tab === 'history' && (
            <>
              {history === null && (
                <p className={styles.emptyHistory}>Loading…</p>
              )}
              {history?.length === 0 && (
                <p className={styles.emptyHistory}>
                  No outreach logged yet. Use the Compose tab to draft and track your first message.
                </p>
              )}
              {history?.length > 0 && (
                <div className={styles.historyList}>
                  {history.map(item => (
                    <div key={item.id} className={styles.historyItem}>
                      <div className={`${styles.historyDot} ${INTERACTION_DOT[item.interaction_type] ?? ''}`} />
                      <div className={styles.historyContent}>
                        <p className={styles.historyType}>
                          {INTERACTION_LABELS[item.interaction_type] ?? item.interaction_type.replace(/_/g, ' ')}
                        </p>
                        <p className={styles.historyDate}>{fmtDate(item.interaction_date)}</p>
                        {item.deal_notes && (
                          <p className={styles.historyNotes}>{item.deal_notes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
}
