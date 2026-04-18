import styles from './AdminDashboard.module.css';

export function AdminPlaceholder({ title }) {
  return (
    <div>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.subtitle}>This module is coming soon.</p>
      <div className={styles.card} style={{ maxWidth: 400, textAlign: 'center', padding: 40 }}>
        <p className={styles.cardPending}>Under construction</p>
        <p className={styles.cardNote}>This module will be available in a future update.</p>
      </div>
    </div>
  );
}
