import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import styles from './AdminDashboard.module.css';

const CARDS = [
  { key: 'newsletter', label: 'Newsletter', icon: '📧' },
  { key: 'creators',   label: 'Creators',   icon: '👤' },
  { key: 'scores',     label: 'Scores',     icon: '📊' },
  { key: 'agents',     label: 'Agents',     icon: '🤖' },
  { key: 'system',     label: 'System',     icon: '⚡' },
  { key: 'revenue',    label: 'Revenue',    icon: '💰' },
];

export function AdminDashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/admin/stats').then(setStats).catch(err => console.error('[AdminDashboard]', err));
  }, []);

  return (
    <div>
      <h1 className={styles.title}>Admin Dashboard</h1>
      <p className={styles.subtitle}>Operational overview for Creatrbase</p>

      <div className={styles.grid}>
        {CARDS.map(card => {
          const data = stats?.[card.key];
          return (
            <div key={card.key} className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.cardIcon}>{card.icon}</span>
                <span className={styles.cardLabel}>{card.label}</span>
              </div>
              <div className={styles.cardBody}>
                {!data ? (
                  <span className={styles.loading}>Loading...</span>
                ) : data.total != null ? (
                  <>
                    <span className={styles.cardValue}>{data.total.toLocaleString()}</span>
                    {data.recentSignups != null && (
                      <span className={styles.cardDelta}>+{data.recentSignups} this week</span>
                    )}
                  </>
                ) : data.status === 'healthy' ? (
                  <>
                    <span className={styles.cardValue}>Healthy</span>
                    <span className={styles.cardDelta}>Uptime: {Math.floor(data.uptime / 3600)}h</span>
                  </>
                ) : (
                  <>
                    <span className={styles.cardPending}>{data.status || 'Pending'}</span>
                    {data.note && <span className={styles.cardNote}>{data.note}</span>}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
