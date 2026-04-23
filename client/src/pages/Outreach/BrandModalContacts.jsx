import { useState, useEffect, useRef } from 'react';
import { api } from '../../lib/api';
import styles from './BrandModal.module.css';

// ── ContactCard ───────────────────────────────────────────────────────────────

// New email_status field (from migration 046)
const EMAIL_STATUS_LABELS = {
  verified:  { label: 'Verified',   cls: 'verifiedBadge' },
  catch_all: { label: 'Catch-all',  cls: 'catchAllBadge' },
  invalid:   { label: 'Invalid',    cls: 'invalidBadge' },
  bounced:   { label: 'Bounced',    cls: 'invalidBadge' },
  no_mx:     { label: 'No email',   cls: 'invalidBadge' },
  unknown:   { label: 'Unverified', cls: 'unknownBadge' },
};

// Legacy email_verified field fallback (pre-migration values)
const LEGACY_LABELS = {
  yes: { label: 'Verified', cls: 'verifiedBadge' },
  no:  { label: 'Invalid',  cls: 'invalidBadge' },
};

function ContactCard({ contact, onUseEmail }) {
  const [copied, setCopied] = useState(false);
  const badge = EMAIL_STATUS_LABELS[contact.email_status]
    ?? LEGACY_LABELS[contact.email_verified]
    ?? EMAIL_STATUS_LABELS.unknown;
  // keep vd alias for the JSX below
  const vd = badge;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(contact.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('[ContactCard]', err);
    }
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

// ── ContactsTab ───────────────────────────────────────────────────────────────

export function BrandModalContacts({ brand, tier, onUseEmail }) {
  const [contacts,  setContacts]  = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [error,     setError]     = useState(null);
  const [starting,  setStarting]  = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    api.get(`/contacts/brand/${brand.id}`)
      .then(res => setContacts(res.contacts))
      .catch(() => setContacts([]));
    return () => clearInterval(pollRef.current);
  }, [brand.id]);

  useEffect(() => {
    if (!jobStatus || !['queued', 'running'].includes(jobStatus.status)) {
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
      } catch (err) {
        console.error('[BrandModalContacts]', err);
      }
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

  const isRunning = jobStatus && ['queued', 'running'].includes(jobStatus.status);

  if (contacts === null) {
    return <div className={styles.contactsLoading}>Loading contacts…</div>;
  }

  return (
    <div className={styles.contactsBody}>

      {isRunning && (
        <div className={styles.contactsRunning}>
          <div className={styles.contactsSpinner} />
          <div>
            <p className={styles.contactsRunningTitle}>Searching {brand.brand_name}&apos;s website</p>
            <p className={styles.contactsRunningDesc}>Finding and verifying influencer marketing contacts. This takes 30-90 seconds.</p>
          </div>
        </div>
      )}

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
