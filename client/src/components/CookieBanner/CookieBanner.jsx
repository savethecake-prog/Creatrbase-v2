import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import styles from './CookieBanner.module.css';

const CONSENT_KEY = 'creatrbase_cookie_consent';
const CONSENT_TTL_MS = 365 * 24 * 60 * 60 * 1000; // 12 months

function loadConsent() {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.timestamp) return null;
    if (Date.now() - parsed.timestamp > CONSENT_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveConsent(analytics, marketing) {
  const value = { analytics, marketing, timestamp: Date.now() };
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(value));
  } catch {}
  return value;
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [managing, setManaging] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const existing = loadConsent();
    if (!existing) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  function acceptAll() {
    saveConsent(true, true);
    setVisible(false);
  }

  function rejectAll() {
    saveConsent(false, false);
    setVisible(false);
  }

  function savePreferences() {
    saveConsent(analytics, marketing);
    setVisible(false);
  }

  return (
    <div className={styles.banner} role="dialog" aria-label="Cookie preferences" aria-live="polite">
      <div className={styles.inner}>
        {!managing ? (
          <>
            <div className={styles.text}>
              <p className={styles.heading}>Cookies &amp; privacy</p>
              <p className={styles.body}>
                We use essential cookies to keep you logged in. We also use{' '}
                <a href="https://plausible.io" target="_blank" rel="noopener noreferrer">Plausible Analytics</a>
                {' '}(privacy-friendly, no fingerprinting).{' '}
                <Link to="/cookies">Cookie policy</Link>
              </p>
            </div>
            <div className={styles.actions}>
              <button className={styles.btnManage} onClick={() => setManaging(true)}>
                Manage preferences
              </button>
              <button className={styles.btnReject} onClick={rejectAll}>
                Reject non-essential
              </button>
              <button className={styles.btnAccept} onClick={acceptAll}>
                Accept all
              </button>
            </div>
          </>
        ) : (
          <div className={styles.manage}>
            <p className={styles.heading}>Manage cookie preferences</p>
            <div className={styles.toggles}>
              <label className={styles.toggle}>
                <div className={styles.toggleInfo}>
                  <span className={styles.toggleName}>Essential</span>
                  <span className={styles.toggleDesc}>Login sessions, security. Cannot be disabled.</span>
                </div>
                <input type="checkbox" checked disabled readOnly />
                <span className={styles.toggleTrack + ' ' + styles.toggleTrackLocked} />
              </label>
              <label className={styles.toggle}>
                <div className={styles.toggleInfo}>
                  <span className={styles.toggleName}>Analytics</span>
                  <span className={styles.toggleDesc}>Plausible Analytics: page views only, no personal data, no cross-site tracking.</span>
                </div>
                <input
                  type="checkbox"
                  checked={analytics}
                  onChange={e => setAnalytics(e.target.checked)}
                  className={styles.toggleInput}
                />
                <span className={`${styles.toggleTrack} ${analytics ? styles.toggleTrackOn : ''}`} />
              </label>
              <label className={styles.toggle}>
                <div className={styles.toggleInfo}>
                  <span className={styles.toggleName}>Marketing</span>
                  <span className={styles.toggleDesc}>Used for promotional content. Currently not active.</span>
                </div>
                <input
                  type="checkbox"
                  checked={marketing}
                  onChange={e => setMarketing(e.target.checked)}
                  className={styles.toggleInput}
                />
                <span className={`${styles.toggleTrack} ${marketing ? styles.toggleTrackOn : ''}`} />
              </label>
            </div>
            <div className={styles.manageActions}>
              <button className={styles.btnManage} onClick={() => setManaging(false)}>
                Back
              </button>
              <button className={styles.btnAccept} onClick={savePreferences}>
                Save preferences
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
