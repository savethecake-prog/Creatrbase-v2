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

function factorLines(factors) {
  if (!factors) return [];
  const lines = [];

  if (factors.corroboration != null) {
    const c = factors.corroboration;
    if (c >= 0.7)      lines.push('Well supported by prior tracked activity');
    else if (c >= 0.4) lines.push('Partially corroborated by prior signals');
    else               lines.push('First signal of this type — no corroboration yet');
  }

  if (factors.recency != null) {
    const r = factors.recency;
    if (r >= 1.0)      lines.push('Very recent (less than 7 days old)');
    else if (r >= 0.8) lines.push('Recent (within the last month)');
    else if (r >= 0.6) lines.push('Moderate age (1-3 months)');
    else if (r >= 0.4) lines.push('Getting older (3-6 months)');
    else               lines.push('Old signal (over 6 months)');
  }

  if (factors.completeness != null) {
    const pct = Math.round(factors.completeness * 100);
    lines.push(`${pct}% of expected data fields were present`);
  }

  if (factors.sourceType != null) {
    const s = factors.sourceType;
    if (s >= 0.8)      lines.push('Source: user-recorded (most reliable)');
    else if (s >= 0.5) lines.push('Source: auto-detected from email');
    else               lines.push('Source: inferred');
  }

  if (Array.isArray(factors.notes)) {
    factors.notes.forEach((n) => n && lines.push(n));
  }

  return lines;
}

function SignalPill({ signal }) {
  const [expanded, setExpanded] = useState(false);
  const q = qualityLabel(signal.quality_score);
  const factorText = factorLines(signal.quality_factors ?? null);

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
          {factorText.length > 0 && (
            <button
              className={styles.expandBtn}
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
            >
              {expanded ? '▲' : '▼'}
            </button>
          )}
        </div>
      )}
      {expanded && factorText.length > 0 && (
        <ul className={styles.factorList}>
          {factorText.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SignalFeed({ limit = 3 }) {
  const [signals, setSignals] = useState(null);
  const [error, setError]     = useState(false);
  const [total, setTotal]     = useState(0);

  useEffect(() => {
    api.get('/signals/recent')
      .then(({ signals: rows, total: t }) => {
        setSignals(rows ?? []);
        setTotal(t ?? 0);
      })
      .catch(() => setError(true));
  }, []);

  if (error || signals === null) return null;
  if (signals.length === 0) return null;

  const visible = signals.slice(0, limit);

  return (
    <div className={styles.feed}>
      <div className={styles.feedHeader}>
        <p className={styles.feedTitle}>What the model learned</p>
        {total > limit && (
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
