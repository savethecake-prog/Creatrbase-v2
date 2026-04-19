import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import styles from './SignalFeed.module.css';

function qualityLabel(score) {
  if (score == null) return null;
  if (score >= 0.8) return { text: 'High confidence', variant: 'high' };
  if (score >= 0.5) return { text: 'Medium confidence', variant: 'medium' };
  return { text: 'Low confidence', variant: 'low' };
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1)  return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)   return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function SignalPill({ signal }) {
  const q = qualityLabel(signal.quality_score);

  return (
    <div className={styles.pill}>
      <div className={styles.pillMain}>
        <p className={styles.pillDesc}>{signal.description}</p>
        <span className={styles.pillTime}>{timeAgo(signal.created_at)}</span>
      </div>
      {q && (
        <div className={styles.pillMeta}>
          <div className={`${styles.qualityBar} ${styles[`qualityBar_${q.variant}`]}`}>
            <div
              className={styles.qualityFill}
              style={{ width: `${Math.round((signal.quality_score ?? 0) * 100)}%` }}
            />
          </div>
          <span className={`${styles.qualityLabel} ${styles[`qualityLabel_${q.variant}`]}`}>
            {q.text}
          </span>
        </div>
      )}
    </div>
  );
}

export function SignalFeed({ limit = 3 }) {
  const [signals, setSignals] = useState(null);
  const [error, setError]     = useState(false);

  useEffect(() => {
    api.get('/signals/recent')
      .then(({ signals }) => setSignals(signals ?? []))
      .catch(() => setError(true));
  }, []);

  if (error || signals === null) return null;
  if (signals.length === 0) return null;

  const visible = signals.slice(0, limit);

  return (
    <div className={styles.feed}>
      <div className={styles.feedHeader}>
        <p className={styles.feedTitle}>What the model learned</p>
        {signals.length > limit && (
          <Link to="/honesty" className={styles.feedMore}>View all</Link>
        )}
      </div>
      <div className={styles.pillList}>
        {visible.map((s) => (
          <SignalPill key={s.id} signal={s} />
        ))}
      </div>
    </div>
  );
}
