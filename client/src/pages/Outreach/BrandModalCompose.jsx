import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { buildEmailTemplate } from './brandModalUtils';
import styles from './BrandModal.module.css';

export function BrandModalCompose({ brand, niche, displayName, initialSendTo, alreadyContacted, onOutreachLogged, onMarkSent }) {
  const [template,      setTemplate]      = useState('');
  const [copied,        setCopied]        = useState(false);
  const [markingDone,   setMarkingDone]   = useState(false);

  // AI draft state
  const [aiContext,     setAiContext]     = useState('opening_position');
  const [aiDeliverable, setAiDeliverable] = useState('sponsored integration');
  const [aiOfferAmt,    setAiOfferAmt]    = useState('');
  const [aiOfferTerms,  setAiOfferTerms]  = useState('');
  const [aiLoading,     setAiLoading]     = useState(false);
  const [aiError,       setAiError]       = useState(null);
  const [draftMeta,     setDraftMeta]     = useState(null);

  // Send state
  const [sendTo,      setSendTo]      = useState(initialSendTo ?? '');
  const [sending,     setSending]     = useState(false);
  const [sendError,   setSendError]   = useState(null);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [gmailStatus, setGmailStatus] = useState(null);

  useEffect(() => {
    api.get('/gmail/status')
      .then(setGmailStatus)
      .catch(() => setGmailStatus({ connected: false }));
  }, []);

  // Pre-fill template on first render
  useEffect(() => {
    if (!template) {
      setTemplate(buildEmailTemplate({ brand, niche, displayName }));
    }
  }, []); // eslint-disable-line

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(template);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      document.querySelector('textarea')?.select();
    }
  }

  async function handleMarkSentClick() {
    setMarkingDone(true);
    try {
      await api.post(`/brands/${brand.id}/outreach`, { notes: null });
      onMarkSent();
      onOutreachLogged(brand.id, 'outreach_sent');
    } catch (err) {
      console.error('[BrandModalCompose]', err);
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

  return (
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

        {!alreadyContacted && !sendSuccess && (
          <button
            className={styles.composeBtn}
            onClick={handleMarkSentClick}
            disabled={markingDone}
            title="Use this if you sent the email from your own client"
          >
            {markingDone ? 'Logging…' : 'Mark as sent manually'}
          </button>
        )}
        {(alreadyContacted || sendSuccess) && (
          <span className={styles.copyHint}>Outreach logged</span>
        )}
      </div>

      {/* Gmail send section */}
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
  );
}
