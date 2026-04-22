import { useEffect } from 'react';
import styles from './Modal.module.css';

/**
 * Modal
 * Props:
 *   onClose   — required, called on Escape or overlay click
 *   title     — optional header text
 *   size      — 'sm' | 'md' (default) | 'lg' | 'xl'
 *   children  — modal body content
 */
export function Modal({ children, onClose, title, size = 'md' }) {
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className={styles.overlay}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      role="presentation"
    >
      <div
        className={`${styles.modal} ${styles[size]}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {title && (
          <div className={styles.header}>
            <p className={styles.title}>{title}</p>
            <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
          </div>
        )}
        <div className={styles.body}>
          {children}
        </div>
      </div>
    </div>
  );
}
