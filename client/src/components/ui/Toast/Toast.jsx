import { useEffect } from 'react';
import styles from './Toast.module.css';

/**
 * Toast — ephemeral notification strip.
 * Props:
 *   message   — string to display
 *   type      — 'success' | 'error' | 'info' (default)
 *   onDismiss — required, called when duration elapses or user clicks ✕
 *   duration  — ms before auto-dismiss (default 3500, 0 = no auto-dismiss)
 */
export function Toast({ message, type = 'info', onDismiss, duration = 3500 }) {
  useEffect(() => {
    if (!duration) return;
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [duration, onDismiss]);

  return (
    <div className={`${styles.toast} ${styles[type]}`} role="status" aria-live="polite">
      <span className={styles.message}>{message}</span>
      <button className={styles.dismiss} onClick={onDismiss} aria-label="Dismiss">✕</button>
    </div>
  );
}

/**
 * ToastStack — convenience wrapper that renders multiple toasts.
 * Props:
 *   toasts  — array of { id, message, type, duration }
 *   onDismiss — (id) => void
 */
export function ToastStack({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div className={styles.stack} aria-live="polite">
      {toasts.map(t => (
        <Toast
          key={t.id}
          message={t.message}
          type={t.type}
          duration={t.duration}
          onDismiss={() => onDismiss(t.id)}
        />
      ))}
    </div>
  );
}
