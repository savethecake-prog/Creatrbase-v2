import { useEffect, useState } from 'react';
import { AppLayout } from '../../layouts/AppLayout/AppLayout';
import { Button } from '../../components/ui/Button/Button';
import { api } from '../../lib/api';
import styles from './GapTracker.module.css';

function formatNum(n) {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatVelocity(v, metric) {
  if (v == null) return null;
  const abs = Math.abs(v);
  const sign = v < 0 ? '−' : '+';
  const label = metric === 'watch_hours_12mo' ? 'hrs/day' : '/day';
  if (abs < 1) return `${sign}${(abs * 7).toFixed(1)}/wk`;
  return `${sign}${abs.toFixed(1)} ${label}`;
}

function formatProjection(days, date) {
  if (days == null) return null;
  if (days === 0)   return 'Already met';
  if (days > 3650)  return `${Math.round(days / 365)} yrs at current pace`;
  if (days > 365)   return `~${(days / 365).toFixed(1)} years (${date})`;
  if (days > 30)    return `~${Math.round(days / 30)} months (${date})`;
  return `~${days} days (${date})`;
}

function DimensionRow({ dim, hasVelocity }) {
  const pct      = dim.pct ?? 0;
  const barColor = dim.reached ? 'var(--cb-mint)' : pct >= 75 ? 'var(--cb-peach)' : 'var(--cb-lavender)';
  const velocity = formatVelocity(dim.velocityPerDay, dim.metric);
  const proj     = formatProjection(dim.daysToReach, dim.projectedDate);

  return (
    <div className={styles.dimension}>
      <div className={styles.dimHeader}>
        <span className={styles.dimLabel}>{dim.label}</span>
        <span className={styles.dimValues}>
          <strong>{formatNum(dim.current)}</strong>
          <span className={styles.dimSep}>/</span>
          {formatNum(dim.required)}
        </span>
      </div>

      <div className={styles.progressTrack}>
        <div
          className={styles.progressBar}
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>

      <div className={styles.dimMeta}>
        {dim.reached ? (
          <span className={styles.metBadge}>Met</span>
        ) : (
          <span className={styles.dimGap}>{formatNum(dim.gap)} to go</span>
        )}
        {velocity && (
          <span className={styles.dimVelocity}>{velocity}</span>
        )}
        {proj && !dim.reached && (
          <span className={styles.dimProj}>{proj}</span>
        )}
        {!hasVelocity && !dim.reached && (
          <span className={styles.dimNoData}>Projection available after 2nd sync</span>
        )}
      </div>
    </div>
  );
}

function ThresholdCard({ threshold, hasVelocity }) {
  return (
    <div className={[styles.card, threshold.met ? styles.cardMet : ''].filter(Boolean).join(' ')}>
      <div className={styles.cardHeader}>
        <div>
          <p className={styles.cardTitle}>{threshold.name}</p>
          <p className={styles.cardDesc}>{threshold.description}</p>
        </div>
        {threshold.met && <span className={styles.metPill}>Eligible</span>}
      </div>

      <div className={styles.dimensions}>
        {threshold.dimensions.map(dim => (
          <DimensionRow key={dim.metric} dim={dim} hasVelocity={hasVelocity} />
        ))}
      </div>
    </div>
  );
}

export function GapTracker() {
  const [data, setData]       = useState(undefined); // undefined = loading
  const [error, setError]     = useState(null);

  useEffect(() => {
    api.get('/gap-tracker')
      .then(res => setData(res.data))
      .catch(() => setError('Failed to load gap data.'));
  }, []);

  const loading = data === undefined && !error;

  return (
    <AppLayout>
      <div className={styles.header}>
        <h1 className={styles.title}>Gap Tracker</h1>
        <p className={styles.sub}>Your distance from each monetisation threshold, with velocity and projections.</p>
      </div>

      {loading && <p className={styles.empty}>Loading…</p>}
      {error   && <p className={styles.emptyError}>{error}</p>}

      {!loading && !error && !data && (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>No YouTube data yet</p>
          <p className={styles.emptySub}>Connect your YouTube channel to see your gap analysis.</p>
          <Button onClick={() => { window.location.href = '/api/connect/youtube'; }}>
            Connect YouTube
          </Button>
        </div>
      )}

      {data && (
        <>
          {data.syncStatus === 'error' && (
            <div className={styles.syncError}>
              Last sync failed — data may be stale. We'll retry automatically.
            </div>
          )}

          <div className={styles.grid}>
            {data.thresholds.map(t => (
              <ThresholdCard key={t.id} threshold={t} hasVelocity={data.hasVelocity} />
            ))}
          </div>

          {data.lastSyncedAt && (
            <p className={styles.syncNote}>
              Data from {new Date(data.lastSyncedAt).toLocaleDateString(undefined, {
                day: 'numeric', month: 'short', year: 'numeric',
              })} at {new Date(data.lastSyncedAt).toLocaleTimeString(undefined, {
                hour: '2-digit', minute: '2-digit',
              })}
            </p>
          )}
        </>
      )}
    </AppLayout>
  );
}
