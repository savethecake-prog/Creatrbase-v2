import { useEffect, useState } from 'react';
import { AppLayout } from '../../layouts/AppLayout/AppLayout';
import { Button } from '../../components/ui/Button/Button';
import { Badge } from '../../components/ui/Badge/Badge';
import { api } from '../../lib/api';
import styles from './Connections.module.css';

const PLATFORMS = [
  {
    key:        'youtube',
    label:      'YouTube',
    connectUrl: '/api/connect/youtube',
    metrics: p => [
      p.subscriber_count != null && { label: 'Subscribers', value: p.subscriber_count.toLocaleString() },
      p.watch_hours_12mo  != null && { label: 'Watch hours (12m)', value: Math.round(p.watch_hours_12mo).toLocaleString() },
    ].filter(Boolean),
  },
  {
    key:        'twitch',
    label:      'Twitch',
    connectUrl: '/api/connect/twitch',
    metrics: p => [
      p.avg_concurrent_viewers_30d != null && { label: 'Avg viewers (30d)', value: p.avg_concurrent_viewers_30d.toFixed(0) },
    ].filter(Boolean),
  },
];

function fmtDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} at ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
}

function SyncStatusBadge({ status }) {
  if (status === 'active')       return <Badge variant="mint">active</Badge>;
  if (status === 'error')        return <Badge variant="error">sync error</Badge>;
  if (status === 'disconnected') return <Badge variant="lavender">disconnected</Badge>;
  return <Badge variant="lavender">{status}</Badge>;
}

function PlatformCard({ platform, data, onSync, onDisconnect }) {
  const [syncing, setSyncing]         = useState(false);
  const [confirming, setConfirming]   = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncMsg, setSyncMsg]         = useState(null);

  const isConnected = data && data.sync_status !== 'disconnected';

  async function handleSync() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      await api.post(`/connect/${platform.key}/sync`, {});
      setSyncMsg('Sync queued — metrics will update in a moment.');
      onSync?.();
    } catch {
      setSyncMsg('Sync failed. Try again shortly.');
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await api.delete(`/connect/${platform.key}`);
      onDisconnect?.(platform.key);
    } catch {
      setDisconnecting(false);
      setConfirming(false);
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <p className={styles.platformName}>{platform.label}</p>
          {isConnected && (
            <p className={styles.platformHandle}>
              {data.platform_display_name ?? data.platform_username ?? '—'}
              {data.platform_url && (
                <a href={data.platform_url} target="_blank" rel="noopener noreferrer" className={styles.platformLink}>
                  ↗
                </a>
              )}
            </p>
          )}
        </div>
        <SyncStatusBadge status={data?.sync_status ?? 'disconnected'} />
      </div>

      {isConnected && (
        <>
          <div className={styles.metaRow}>
            {data.last_synced_at && (
              <p className={styles.metaItem}>
                <span className={styles.metaLabel}>Last synced</span>
                {fmtDate(data.last_synced_at)}
              </p>
            )}
            {data.analytics_last_synced_at && platform.key === 'youtube' && (
              <p className={styles.metaItem}>
                <span className={styles.metaLabel}>Analytics synced</span>
                {fmtDate(data.analytics_last_synced_at)}
              </p>
            )}
            {data.connected_at && (
              <p className={styles.metaItem}>
                <span className={styles.metaLabel}>Connected</span>
                {fmtDate(data.connected_at)}
              </p>
            )}
          </div>

          {platform.metrics(data).length > 0 && (
            <div className={styles.metricsRow}>
              {platform.metrics(data).map(m => (
                <div key={m.label} className={styles.metric}>
                  <p className={styles.metricValue}>{m.value}</p>
                  <p className={styles.metricLabel}>{m.label}</p>
                </div>
              ))}
            </div>
          )}

          {syncMsg && <p className={styles.syncMsg}>{syncMsg}</p>}

          <div className={styles.cardActions}>
            <Button size="sm" variant="secondary" onClick={handleSync} disabled={syncing}>
              {syncing ? 'Syncing…' : 'Sync now'}
            </Button>
            {confirming ? (
              <div className={styles.confirmRow}>
                <p className={styles.confirmText}>Disconnect {platform.label}?</p>
                <Button size="sm" variant="ghost" onClick={handleDisconnect} disabled={disconnecting}>
                  {disconnecting ? 'Disconnecting…' : 'Yes, disconnect'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={disconnecting}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
                Disconnect
              </Button>
            )}
          </div>
        </>
      )}

      {!isConnected && (
        <div className={styles.disconnectedState}>
          <p className={styles.disconnectedMsg}>
            {platform.label} is not connected. Connect to sync your channel metrics.
          </p>
          <Button size="sm" onClick={() => { window.location.href = platform.connectUrl; }}>
            Connect {platform.label}
          </Button>
        </div>
      )}
    </div>
  );
}

export function Connections() {
  const [platforms, setPlatforms] = useState([]);

  useEffect(() => {
    api.get('/connect/platforms').then(({ platforms }) => setPlatforms(platforms)).catch(() => {});
  }, []);

  function handleDisconnect(platformKey) {
    setPlatforms(prev => prev.map(p =>
      p.platform === platformKey ? { ...p, sync_status: 'disconnected' } : p
    ));
  }

  return (
    <AppLayout>
      <div className={styles.header}>
        <h1 className={styles.title}>Connections</h1>
        <p className={styles.sub}>Manage your connected platforms and sync settings.</p>
      </div>

      <div className={styles.grid}>
        {PLATFORMS.map(platform => (
          <PlatformCard
            key={platform.key}
            platform={platform}
            data={platforms.find(p => p.platform === platform.key) ?? null}
            onDisconnect={handleDisconnect}
          />
        ))}
      </div>
    </AppLayout>
  );
}
