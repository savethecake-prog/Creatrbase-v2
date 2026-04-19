import { useState } from 'react';
import { api } from '../../lib/api';
import styles from './NewsletterSignup.module.css';

/**
 * Newsletter signup component with 4 variants:
 * - block: full marketing card (landing page, blog footer)
 * - inline: narrower mid-article card
 * - compact: single-row (score result pages)
 * - checkbox: just a checkbox + label (product signup)
 *
 * @param {string} source - attribution source (landing, blog, score_result, product_signup)
 * @param {string} sourceDetail - additional context (slug, public_id)
 * @param {string} variant - block|inline|compact|checkbox
 * @param {object} copy - { eyebrow, title, body, cta }
 * @param {function} onSubscribe - callback for checkbox variant (called with boolean)
 */
export function NewsletterSignup({ source, sourceDetail, variant = 'block', copy = {}, onSubscribe }) {
  const [email, setEmail] = useState('');
  const [checked, setChecked] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, loading, success, error
  const [errorMsg, setErrorMsg] = useState('');

  const eyebrow = copy.eyebrow || 'Newsletter';
  const title = copy.title || 'The creator economy and AI, explained.';
  const body = copy.body || 'Three sends a week. Monday: creator economy. Thursday: AI tools. Sunday: editorial. Free, opt out anytime, segment-by-segment.';
  const cta = copy.cta || 'Subscribe';

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim() || status === 'loading') return;
    if (!consentGiven) {
      setErrorMsg('Please tick the consent box to subscribe.');
      return;
    }

    setStatus('loading');
    setErrorMsg('');

    try {
      await api.post('/newsletter/subscribe', {
        email: email.trim(),
        source,
        source_detail: sourceDetail,
        segments: ['creator-economy', 'ai-for-creators', 'editorial'],
        marketing_consent: true,
      });
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.data?.message || err.message || 'Something went wrong.');
    }
  }

  // Checkbox variant for product signup
  if (variant === 'checkbox') {
    return (
      <label className={styles.checkboxWrap}>
        <input
          type="checkbox"
          checked={checked}
          onChange={e => {
            setChecked(e.target.checked);
            onSubscribe?.(e.target.checked);
          }}
          className={styles.checkbox}
        />
        <span className={styles.checkboxLabel}>
          I agree to receive the Creatrbase newsletter (creator economy, AI tips, weekly editorial). Three sends per week. Unsubscribe any time.
        </span>
      </label>
    );
  }

  // Success state
  if (status === 'success') {
    return (
      <div className={`${styles.container} ${styles[variant]}`}>
        <div className={styles.success}>
          <span className={styles.successIcon}>&#10003;</span>
          <div>
            <strong>Check your inbox.</strong>
            <p className={styles.successNote}>Click the confirmation link to subscribe. You can opt out of any segment anytime.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${styles[variant]}`}>
      <span className={styles.eyebrow}>{eyebrow.toUpperCase()}</span>
      <h3 className={styles.title}>{title}</h3>
      {variant !== 'compact' && <p className={styles.body}>{body}</p>}
      <form onSubmit={handleSubmit} className={styles.form}>
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className={styles.input}
          required
          disabled={status === 'loading'}
        />
        <button type="submit" className={styles.btn} disabled={status === 'loading' || !email.trim() || !consentGiven}>
          {status === 'loading' ? 'Subscribing...' : cta}
        </button>
      </form>
      <label className={styles.consentRow}>
        <input
          type="checkbox"
          checked={consentGiven}
          onChange={e => {
            setConsentGiven(e.target.checked);
            if (e.target.checked) setErrorMsg('');
          }}
          className={styles.consentCheckbox}
          disabled={status === 'loading'}
        />
        <span className={styles.consentLabel}>
          I agree to receive the Creatrbase newsletter. Unsubscribe any time.
        </span>
      </label>
      {status === 'error' && <p className={styles.error}>{errorMsg}</p>}
      {variant !== 'compact' && (
        <p className={styles.meta}>Three sends per week. Segment-by-segment opt down. Opt out anytime.</p>
      )}
    </div>
  );
}
