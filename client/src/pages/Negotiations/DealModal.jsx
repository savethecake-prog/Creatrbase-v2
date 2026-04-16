import { useState, useEffect } from 'react';
import { Badge } from '../../components/ui/Badge/Badge';
import { api } from '../../lib/api';
import styles from './DealModal.module.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

const STAGE_META = {
  outreach_sent:        { label: 'Outreach sent',    dot: styles.dotSent },
  outreach_responded:   { label: 'Responded',        dot: styles.dotResponded },
  deal_negotiating:     { label: 'Negotiating',      dot: styles.dotNegotiating },
  deal_completed:       { label: 'Deal completed',   dot: styles.dotCompleted },
  relationship_ongoing: { label: 'Ongoing',          dot: styles.dotOngoing },
  outreach_declined:    { label: 'Declined',         dot: styles.dotDeclined },
};

const STAGE_OPTIONS = [
  { value: 'deal_negotiating',     label: 'Negotiating' },
  { value: 'deal_completed',       label: 'Deal completed' },
  { value: 'relationship_ongoing', label: 'Ongoing' },
  { value: 'outreach_declined',    label: 'Declined' },
];

const DELIVERABLE_OPTIONS = [
  { value: '',                label: 'Deliverable (optional)' },
  { value: 'dedicated_video', label: 'Dedicated video' },
  { value: 'integrated_60s',  label: '60s integration' },
  { value: 'integrated_30s',  label: '30s integration' },
  { value: 'shorts_only',     label: 'Shorts only' },
  { value: 'multi_platform',  label: 'Multi-platform' },
  { value: 'gifting_only',    label: 'Gifting only' },
];

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

function fmtRate(pence, currency) {
  if (pence == null) return null;
  const sym = currency === 'USD' ? '$' : '£';
  const v   = Math.round(pence / 100);
  return v >= 1000 ? `${sym}${(v / 1000).toFixed(1)}k` : `${sym}${v}`;
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── DealModal ─────────────────────────────────────────────────────────────────

export function DealModal({ deal, onClose, onUpdated }) {
  const [tab,      setTab]      = useState('timeline');
  const [history,  setHistory]  = useState(null);
  const [stage,    setStage]    = useState('');
  const [offered,  setOffered]  = useState('');
  const [agreed,   setAgreed]   = useState('');
  const [currency, setCurrency] = useState('GBP');
  const [deliv,    setDeliv]    = useState('');
  const [notes,    setNotes]    = useState('');
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    if (tab === 'timeline') {
      setHistory(null);
      api.get(`/negotiations/${deal.brand_id}/history`)
        .then(res => setHistory(res.history))
        .catch(() => setHistory([]));
    }
  }, [tab, deal.brand_id]);

  const showRates = ['deal_negotiating', 'deal_completed', 'relationship_ongoing'].includes(stage);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!stage) return;
    setSaving(true);
    try {
      await api.post(`/negotiations/${deal.brand_id}/update`, {
        interactionType: stage,
        offeredRate:     offered  ? Number(offered)  : undefined,
        agreedRate:      agreed   ? Number(agreed)   : undefined,
        rateCurrency:    showRates ? currency : undefined,
        deliverableType: deliv    || undefined,
        notes:           notes    || undefined,
      });
      setSaved(true);
      onUpdated(deal.brand_id, stage);
      // Refresh timeline
      const res = await api.get(`/negotiations/${deal.brand_id}/history`);
      setHistory(res.history);
      // Reset form
      setStage(''); setOffered(''); setAgreed(''); setDeliv(''); setNotes('');
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // best-effort
    } finally {
      setSaving(false);
    }
  }

  const currentMeta = STAGE_META[deal.interaction_type] ?? { label: deal.interaction_type, dot: '' };

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <p className={styles.brandName}>{deal.brand_name}</p>
            <div className={styles.headerMeta}>
              <Badge variant={
                deal.interaction_type === 'deal_completed'   ? 'mint' :
                deal.interaction_type === 'outreach_declined'? 'error' :
                deal.interaction_type === 'deal_negotiating' ? 'lavender' : 'peach'
              }>
                {currentMeta.label}
              </Badge>
              {deal.category && (
                <>
                  <span className={styles.metaDot} />
                  <span className={styles.metaText}>{CATEGORY_LABELS[deal.category] ?? deal.category}</span>
                </>
              )}
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === 'timeline' ? styles.tabActive : ''}`}
            onClick={() => setTab('timeline')}
          >
            Timeline
          </button>
          <button
            className={`${styles.tab} ${tab === 'update' ? styles.tabActive : ''}`}
            onClick={() => setTab('update')}
          >
            Log update
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>

          {/* ── Timeline ── */}
          {tab === 'timeline' && (
            <>
              <p className={styles.timelineHint}>
                Outreach sent and brand replies are tracked automatically. Log negotiation progress and deal terms below.
              </p>
              {history === null && (
                <p className={styles.emptyTimeline}>Loading…</p>
              )}
              {history?.length === 0 && (
                <p className={styles.emptyTimeline}>No history yet.</p>
              )}
              {history?.length > 0 && (
                <div className={styles.timeline}>
                  {history.map((item, idx) => {
                    const meta = STAGE_META[item.interaction_type] ?? { label: item.interaction_type, dot: '' };
                    return (
                      <div key={item.id} className={styles.timelineItem}>
                        <div className={`${styles.timelineDot} ${meta.dot}`} />
                        <div className={styles.timelineContent}>
                          <p className={styles.timelineType}>{meta.label}</p>
                          <p className={styles.timelineDate}>{fmtDate(item.interaction_date)}</p>

                          {(item.offered_rate || item.agreed_rate) && (
                            <div className={styles.timelineRates}>
                              {item.offered_rate != null && (
                                <div className={styles.timelineRate}>
                                  <span className={styles.timelineRateLabel}>Offered</span>
                                  <span className={styles.timelineRateVal}>
                                    {fmtRate(item.offered_rate, item.rate_currency)}
                                  </span>
                                </div>
                              )}
                              {item.agreed_rate != null && (
                                <div className={styles.timelineRate}>
                                  <span className={styles.timelineRateLabel}>Agreed</span>
                                  <span className={styles.timelineRateVal}>
                                    {fmtRate(item.agreed_rate, item.rate_currency)}
                                  </span>
                                </div>
                              )}
                              {item.negotiation_delta != null && item.agreed_rate && item.offered_rate && (
                                <div className={styles.timelineRate}>
                                  <span className={styles.timelineRateLabel}>Delta</span>
                                  <span className={styles.timelineRateVal}>
                                    {item.negotiation_delta >= 0 ? '+' : ''}
                                    {fmtRate(item.negotiation_delta, item.rate_currency)}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {item.deliverable_type && (
                            <p className={styles.timelineDeliverable}>
                              {item.deliverable_type.replace(/_/g, ' ')}
                            </p>
                          )}

                          {item.deal_notes && (
                            <p className={styles.timelineNotes}>{item.deal_notes}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ── Update form ── */}
          {tab === 'update' && (
            <form onSubmit={handleSubmit} className={styles.formSection}>

              <div className={styles.stageGuide}>
                <p className={styles.stageGuideTitle}>What stage are you at?</p>
                <div className={styles.stageGuideItems}>
                  <div className={styles.stageGuideItem}>
                    <span className={styles.stageGuideLabel}>Negotiating</span>
                    <span className={styles.stageGuideDesc}>You're in active back-and-forth about rates, deliverables, or timeline.</span>
                  </div>
                  <div className={styles.stageGuideItem}>
                    <span className={styles.stageGuideLabel}>Deal completed</span>
                    <span className={styles.stageGuideDesc}>You've agreed terms and the partnership is confirmed. Log the rate here.</span>
                  </div>
                  <div className={styles.stageGuideItem}>
                    <span className={styles.stageGuideLabel}>Ongoing</span>
                    <span className={styles.stageGuideDesc}>This brand is a recurring partner — you work together regularly.</span>
                  </div>
                  <div className={styles.stageGuideItem}>
                    <span className={`${styles.stageGuideLabel} ${styles.stageGuideLabelDeclined}`}>Declined</span>
                    <span className={styles.stageGuideDesc}>They said no, or the conversation went cold. Keeps your pipeline clean.</span>
                  </div>
                </div>
              </div>

              <div>
                <label className={styles.formLabel}>Update stage</label>
                <div className={styles.stageGrid}>
                  {STAGE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      className={[
                        styles.stageBtn,
                        stage === opt.value ? styles.stageBtnActive : '',
                        opt.value === 'outreach_declined' ? styles.stageBtnDecline : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => setStage(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {showRates && (
                <div>
                  <label className={styles.formLabel}>Rate terms (optional)</label>
                  <div className={styles.rateGrid}>
                    <div className={styles.fieldGroup}>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="Offered rate"
                        value={offered}
                        onChange={e => setOffered(e.target.value)}
                        className={styles.input}
                      />
                    </div>
                    <div className={styles.fieldGroup}>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="Agreed rate"
                        value={agreed}
                        onChange={e => setAgreed(e.target.value)}
                        className={styles.input}
                      />
                    </div>
                    <select
                      value={currency}
                      onChange={e => setCurrency(e.target.value)}
                      className={styles.select}
                    >
                      <option value="GBP">£ GBP</option>
                      <option value="USD">$ USD</option>
                    </select>
                  </div>
                  <select
                    value={deliv}
                    onChange={e => setDeliv(e.target.value)}
                    className={`${styles.select} ${styles.deliverableSelect}`}
                    style={{ marginTop: 'var(--space-3)', width: '100%' }}
                  >
                    {DELIVERABLE_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className={styles.formLabel}>Notes (optional)</label>
                <textarea
                  className={styles.textarea}
                  placeholder="What happened, what was discussed, next steps…"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>

              <div className={styles.formActions}>
                <button
                  type="submit"
                  className={styles.submitBtn}
                  disabled={!stage || saving}
                >
                  {saving ? 'Saving…' : 'Log update'}
                </button>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => { setStage(''); setOffered(''); setAgreed(''); setNotes(''); }}
                >
                  Clear
                </button>
                {saved && <span className={styles.successMsg}>Saved</span>}
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
