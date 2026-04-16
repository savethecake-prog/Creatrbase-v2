import { useState } from 'react';
import styles from './HintCallout.module.css';

/**
 * Dismissable contextual hint.
 *
 * Props:
 *   storageKey  – localStorage key used to remember "seen" state
 *   eyebrow     – small label above the heading (optional)
 *   heading     – bold heading text
 *   children    – body content (text or JSX)
 */
export function HintCallout({ storageKey, eyebrow, heading, children }) {
  const [visible, setVisible] = useState(() => !localStorage.getItem(storageKey));

  function dismiss() {
    localStorage.setItem(storageKey, '1');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className={styles.callout}>
      <div className={styles.body}>
        {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
        <p className={styles.heading}>{heading}</p>
        <div className={styles.content}>{children}</div>
      </div>
      <button className={styles.dismiss} onClick={dismiss} aria-label="Dismiss">✕</button>
    </div>
  );
}
