import { useState, useEffect, useCallback, useRef } from 'react';
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

// ── ContactsTab ───────────────────────────────────────────────────────────────

const VERIFIED_LABELS = {
  verified:   { label: 'Verified',   cls: 'verifiedBadge' },
  unknown:    { label: 'Unverified', cls: 'unknownBadge' },
  unverified: { label: 'Invalid',    cls: 'invalidBadge' },
};

function ContactCard({ contact, onUseEmail }) {
  const [copied, setCopied] = useState(false);
  const vd = VERIFIED_LABELS[contact.email_verified] ?? VERIFIED_LABELS.unknown;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(contact.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <div className={styles.contactCard}>
      <div className={styles.contactMeta}>
        {contact.full_name && <p className={styles.contactName}>{contact.full_name}</p>}
        {contact.job_title && <p className={styles.contactTitle}>{contact.job_title}</p>}
      </div>
      <div className={styles.contactEmail}>
        <span className={styles.emailText}>{contact.email}</span>
        <span className={`${styles.verifiedBadge} ${styles[vd.cls]}`}>{vd.label}</span>
      </div>
      <div className={styles.contactActions}>
        <button type="button" className={styles.contactCopyBtn} onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy email'}
        </button>
        {onUseEmail && (
          <button type="button" className={styles.contactUseBtn} onClick={() => onUseEmail(contact.email)}>
            Use in outreach
          </button>
        )}
      </div>
    </div>
  );
}

function ContactsTab({ brand, onUseEmail, tier }) {
  const [contacts,   setContacts]   = useState(null); // null = not loaded yet
  const [jobStatus,  setJobStatus]  = useState(null); // null | { id, status }
  const [error,      setError]      = useState(null);
  const [starting,   setStarting]   = useState(false);
  const pollRef = useRef(null);

  // Load cached contacts on mount
  useEffect(() => {
    api.get(`/contacts/brand/${brand.id}`)
      .then(res => setContacts(res.contacts))
      .catch(() => setContacts([]));
    return () => clearInterval(pollRef.current);
  }, [brand.id]);

  // Poll when a job is running
  useEffect(() => {
    if (!jobStatus || !['queued','running'].includes(jobStatus.status)) {
      clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/contacts/job/${jobStatus.id}`);
        setJobStatus(prev => ({ ...prev, status: res.status }));
        if (res.status === 'complete') {
          setContacts(res.contacts);
          clearInterval(pollRef.current);
        }
        if (res.status === 'failed') {
          setError('Contact search failed. Try again.');
          clearInterval(pollRef.current);
        }
      } catch {}
    }, 3000);
    return () => clearInterval(pollRef.current);
  }, [jobStatus?.id, jobStatus?.status]);

  async function handleDiscover() {
    setStarting(true);
    setError(null);
    try {
      const res = await api.post('/contacts/discover', { brandId: brand.id });
      if (res.status === 'cached') {
        setContacts(res.contacts);
      } else {
        setJobStatus({ id: res.jobId, status: res.status });
      }
    } catch (err) {
      setError(err?.data?.error ?? 'Could not start contact search.');
    } finally {
      setStarting(false);
    }
  }

  const isRunning = jobStatus && ['queued','running'].includes(jobStatus.status);

  // Not loaded yet
  if (contacts === null) {
    return <div className={styles.contactsLoading}>Loading contacts…</div>;
  }

  return (
    <div className={styles.contactsBody}>

      {/* Running state */}
      {isRunning && (
        <div className={styles.contactsRunning}>
          <div className={styles.contactsSpinner} />
          <div>
            <p className={styles.contactsRunningTitle}>Searching {brand.brand_name}&apos;s website</p>
            <p className={styles.contactsRunningDesc}>Finding and verifying influencer marketing contacts. This takes 30-90 seconds.</p>
          </div>
        </div>
      )}

      {/* Results */}
      {!isRunning && contacts.length > 0 && (
        <>
          <div className={styles.contactsList}>
            {contacts.map(c => (
              <ContactCard key={c.id} contact={c} onUseEmail={onUseEmail} />
            ))}
          </div>
          <p className={styles.contactsFootnote}>
            Contacts found on {brand.brand_name}&apos;s public website. Re-search any time to refresh.
          </p>
          {tier === 'pro' && (
            <button type="button" className={styles.rediscoverBtn} onClick={handleDiscover} disabled={starting}>
              Re-search
            </button>
          )}
        </>
      )}

      {/* Empty + not running */}
      {!isRunning && contacts.length === 0 && (
        <div className={styles.contactsEmpty}>
          {!brand.website ? (
            <>
              <p className={styles.contactsEmptyTitle}>No website on file</p>
              <p className={styles.contactsEmptyDesc}>This brand doesn&apos;t have a website recorded yet. Contact discovery is not possible until one is added.</p>
            </>
          ) : tier === 'pro' ? (
            <>
              <p className={styles.contactsEmptyTitle}>No contacts found yet</p>
              <p className={styles.contactsEmptyDesc}>
                Search {brand.brand_name}&apos;s website for influencer marketing contacts. We&apos;ll look for partnership, brand, and social media roles.
              </p>
              {error && <p className={styles.contactsError}>{error}</p>}
              <button type="button" className={styles.discoverBtn} onClick={handleDiscover} disabled={starting}>
                {starting ? 'Starting search…' : `Find contacts at ${brand.brand_name}`}
              </button>
            </>
          ) : (
            <>
              <p className={styles.contactsEmptyTitle}>Pro feature</p>
              <p className={styles.contactsEmptyDesc}>Contact discovery is available on the Pro plan. Upgrade to find verified email addresses for brand marketing contacts.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── BrandModal ────────────────────────────────────────────────────────────────

export function BrandModal({ brand, niche, onClose, onOutreachLogged }) {
  const { user, tier } = useAuth();
  const [tab,         setTab]         = useState('details'); // 'details' | 'contacts' | 'compose' | 'history'
  const [template,    setTemplate]    = useState('');
  const [copied,      setCopied]      = useState(false);
  const [markingDone, setMarkingDone] = useState(false);
  const [marked,      setMarked]      = useState(false);
  const [history,     setHistory]     = useState(null);
  // AI draft state
  const [aiContext,    setAiContext]    = useState('opening_position');
  const [aiDeliverable, setAiDeliverable] = useState('sponsored integration');
  const [aiOfferAmt,   setAiOfferAmt]   = useState('');
  const [aiOfferTerms, setAiOfferTerms] = useState('');
  const [aiLoading,    setAiLoading]    = useState(false);
  const [aiError,      setAiError]      = useState(null);
  const [draftMeta,    setDraftMeta]    = useState(null); // { toneNotes, keyPositions, draftNotes }

  // Send state
  const [sendTo,          setSendTo]          = useState(brand.partnership_email ?? '');
  const [sending,         setSending]         = useState(false);
  const [sendError,       setSendError]       = useState(null);
  const [sendSuccess,     setSendSuccess]     = useState(false);
  const [showWarning,     setShowWarning]     = useState(false);
  const [warningAcked,    setWarningAcked]    = useState(false);
  const [gmailStatus,     setGmailStatus]     = useState(null); // null=loading, {connected}

  useEffect(() => {
    api.get('/gmail/status')
      .then(setGmailStatus)
      .catch(() => setGmailStatus({ connected: false }));
  }, []);

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

  function parseEmailParts(text) {
    const lines = text.split('\n');
    if (lines[0].startsWith('Subject: ')) {
      const subject = lines[0].replace('Subject: ', '').trim();
      const body = lines.slice(lines[1] === '' ? 2 : 1).join('\n').trim();
      return { subject, body };
    }
    return { subject: `Creator Partnership Inquiry — ${brand.brand_name}`, body: text.trim() };
  }

  async function handleSend() {
    const { subject, body } = parseEmailParts(template);
    if (!sendTo.trim()) {
      setSendError('Please enter a recipient email address.');
      return;
    }
    setSending(true);
    setSendError(null);
    try {
      await api.post(`/brands/${brand.id}/send-email`, {
        to:                    sendTo.trim(),
        subject,
        body,
        readinessAcknowledged: true,
      });
      setSendSuccess(true);
      setShowWarning(false);
      onOutreachLogged(brand.id, 'outreach_sent');
    } catch (err) {
      setSendError(err?.data?.error ?? 'Failed to send. Please try again.');
    } finally {
      setSending(false);
    }
  }

  async function handleAiDraft() {
    setAiLoading(true);
    setAiError(null);
    setDraftMeta(null);
    try {
      const payload = {
        negotiationContext: aiContext,
        deliverableType:    aiDeliverable,
      };
      if (aiContext === 'counter_response') {
        payload.brandOfferAmount = aiOfferAmt ? Math.round(parseFloat(aiOfferAmt) * 100) : null;
        payload.brandOfferTerms  = aiOfferTerms;
      }
      const result = await api.post(`/brands/${brand.id}/draft-pitch`, payload);
      setTemplate(`Subject: ${result.subjectLine}\n\n${result.emailBody}`);
      setDraftMeta({
        toneNotes:    result.toneNotes,
        keyPositions: result.keyPositions ?? [],
        draftNotes:   result.draftNotes,
      });
    } catch (err) {
      setAiError(err?.data?.error ?? 'Draft generation failed. Please try again.');
    } finally {
      setAiLoading(false);
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
            className={`${styles.tab} ${tab === 'contacts' ? styles.tabActive : ''}`}
            onClick={() => setTab('contacts')}
          >
            Contacts
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

          {/* ── Contacts tab ── */}
          {tab === 'contacts' && (
            <ContactsTab
              brand={brand}
              tier={tier}
              onUseEmail={(email) => {
                setSendTo(email);
                setTab('compose');
              }}
            />
          )}

          {/* ── Compose tab ── */}
          {tab === 'compose' && (
            <>
              <p className={styles.composeIntro}>
                Edit and send directly from Creatrbase via Gmail, or copy to send manually.
              </p>

              {/* AI draft panel */}
              <div className={styles.aiPanel}>
                <p className={styles.aiPanelTitle}>Draft with AI</p>
                <div className={styles.aiFields}>
                  <div className={styles.aiField}>
                    <label className={styles.aiLabel}>Context</label>
                    <select className={styles.aiSelect} value={aiContext} onChange={e => setAiContext(e.target.value)}>
                      <option value="opening_position">Opening pitch</option>
                      <option value="counter_response">Counter offer</option>
                      <option value="scope_management">Scope change</option>
                    </select>
                  </div>
                  <div className={styles.aiField}>
                    <label className={styles.aiLabel}>Deliverable</label>
                    <input
                      className={styles.aiInput}
                      value={aiDeliverable}
                      onChange={e => setAiDeliverable(e.target.value)}
                      placeholder="e.g. 60s integration"
                    />
                  </div>
                  {aiContext === 'counter_response' && (
                    <>
                      <div className={styles.aiField}>
                        <label className={styles.aiLabel}>Their offer (£)</label>
                        <input
                          className={styles.aiInput}
                          type="number"
                          min="0"
                          value={aiOfferAmt}
                          onChange={e => setAiOfferAmt(e.target.value)}
                          placeholder="e.g. 500"
                        />
                      </div>
                      <div className={styles.aiField}>
                        <label className={styles.aiLabel}>Offer terms</label>
                        <input
                          className={styles.aiInput}
                          value={aiOfferTerms}
                          onChange={e => setAiOfferTerms(e.target.value)}
                          placeholder="e.g. 1 video, 30d exclusivity"
                        />
                      </div>
                    </>
                  )}
                </div>
                {aiError && <p className={styles.aiError}>{aiError}</p>}
                <button className={styles.aiGenerateBtn} onClick={handleAiDraft} disabled={aiLoading}>
                  {aiLoading ? 'Generating…' : 'Generate draft →'}
                </button>
              </div>

              <textarea
                className={styles.templateArea}
                value={template}
                onChange={e => setTemplate(e.target.value)}
                spellCheck
              />

              {draftMeta && (
                <div className={styles.draftNotes}>
                  <p className={styles.draftNotesLabel}>Draft notes</p>
                  {draftMeta.toneNotes && <p className={styles.draftNotesText}>{draftMeta.toneNotes}</p>}
                  {draftMeta.keyPositions.length > 0 && (
                    <div className={styles.draftPositions}>
                      {draftMeta.keyPositions.map((p, i) => (
                        <p key={i} className={styles.draftPosition}>{p}</p>
                      ))}
                    </div>
                  )}
                  {draftMeta.draftNotes && <p className={styles.draftNotesText}>{draftMeta.draftNotes}</p>}
                </div>
              )}

              <div className={styles.composeActions}>
                <button
                  className={`${styles.composeBtn} ${styles.composeBtnPrimary}`}
                  onClick={handleCopy}
                >
                  {copied ? 'Copied!' : 'Copy to clipboard'}
                </button>

                {!marked && !brand.latest_interaction && !sendSuccess && (
                  <button
                    className={styles.composeBtn}
                    onClick={handleMarkSent}
                    disabled={markingDone}
                    title="Use this if you sent the email from your own client"
                  >
                    {markingDone ? 'Logging…' : 'Mark as sent manually'}
                  </button>
                )}
                {(marked || brand.latest_interaction || sendSuccess) && (
                  <span className={styles.copyHint}>Outreach logged</span>
                )}
              </div>

              {/* ── Gmail send section ── */}
              <div className={styles.gmailSend}>
                <p className={styles.gmailSendLabel}>Send via Gmail</p>

                {gmailStatus === null && (
                  <p className={styles.gmailLoading}>Checking Gmail connection…</p>
                )}

                {gmailStatus !== null && !gmailStatus.connected && (
                  <div className={styles.gmailNotConnected}>
                    <p className={styles.gmailNotConnectedMsg}>
                      Connect your Gmail account to send directly from Creatrbase and auto-detect replies.
                    </p>
                    <a href="/connections" className={styles.gmailConnectLink}>
                      Connect Gmail →
                    </a>
                  </div>
                )}

                {gmailStatus?.connected && !sendSuccess && (
                  <>
                    <div className={styles.gmailToRow}>
                      <label className={styles.gmailToLabel}>To</label>
                      <input
                        className={styles.gmailToInput}
                        type="email"
                        value={sendTo}
                        onChange={e => { setSendTo(e.target.value); setSendError(null); }}
                        placeholder="partnerships@brand.com"
                      />
                    </div>
                    <p className={styles.gmailFromHint}>Sending from {gmailStatus.gmailAddress}</p>

                    {sendError && <p className={styles.gmailError}>{sendError}</p>}

                    {!showWarning ? (
                      <button
                        className={styles.gmailSendBtn}
                        onClick={() => setShowWarning(true)}
                        disabled={sending}
                      >
                        Send via Gmail →
                      </button>
                    ) : (
                      <div className={styles.gmailWarning}>
                        <p className={styles.gmailWarningTitle}>Before you send</p>
                        <ul className={styles.gmailWarningList}>
                          <li>This will send a real email from your Gmail account.</li>
                          <li>Make sure you're ready to discuss a partnership — brands may respond quickly.</li>
                          <li>Replies will be automatically detected and surfaced in your History tab.</li>
                          <li>You cannot unsend this email.</li>
                        </ul>
                        <div className={styles.gmailWarningActions}>
                          <button
                            className={styles.gmailConfirmBtn}
                            onClick={handleSend}
                            disabled={sending}
                          >
                            {sending ? 'Sending…' : 'Yes, send it'}
                          </button>
                          <button
                            className={styles.gmailCancelBtn}
                            onClick={() => { setShowWarning(false); setSendError(null); }}
                            disabled={sending}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {sendSuccess && (
                  <div className={styles.gmailSuccess}>
                    <span className={styles.gmailSuccessIcon}>✓</span>
                    <div>
                      <p className={styles.gmailSuccessTitle}>Email sent</p>
                      <p className={styles.gmailSuccessMsg}>
                        Sent from {gmailStatus?.gmailAddress}. Replies will be detected automatically.
                      </p>
                    </div>
                  </div>
                )}
              </div>

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
