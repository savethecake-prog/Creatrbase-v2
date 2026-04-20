import { useEffect, useState } from 'react';
import { AppLayout } from '../../layouts/AppLayout/AppLayout';
import { Button } from '../../components/ui/Button/Button';
import { Badge } from '../../components/ui/Badge/Badge';
import { api } from '../../lib/api';
import styles from './Connections.module.css';

const COMING_SOON = [
  {
    key: 'meta',
    label: 'Instagram',
    description: 'Connect Instagram to track reach, follower growth, and brand partnership eligibility.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="igGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#fd5949" />
            <stop offset="50%" stopColor="#d6249f" />
            <stop offset="100%" stopColor="#285AEB" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="20" height="20" rx="6" fill="url(#igGrad)" />
        <circle cx="12" cy="12" r="4" stroke="white" strokeWidth="2" fill="none" />
        <circle cx="17.5" cy="6.5" r="1.25" fill="white" />
      </svg>
    ),
  },
];

function ComingSoonCard({ platform }) {
  return (
    <div className={styles.card} style={{ opacity: 0.7 }}>
      <div className={styles.cardHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ flexShrink: 0 }}>{platform.icon}</div>
          <div>
            <p className={styles.platformName}>{platform.label}</p>
            <p className={styles.platformHandle} style={{ fontStyle: 'italic' }}>Coming Soon</p>
          </div>
        </div>
        <span style={{
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--neon-mint)',
          background: 'rgba(164, 255, 219, 0.08)',
          border: '1px solid rgba(164, 255, 219, 0.2)',
          padding: '3px 10px',
          borderRadius: '999px',
        }}>Soon</span>
      </div>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '1.25rem' }}>
        {platform.description}
      </p>
      <button
        disabled
        style={{
          padding: '8px 16px',
          borderRadius: '999px',
          border: '1px solid var(--glass-border)',
          background: 'transparent',
          color: 'var(--text-muted)',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'not-allowed',
          fontFamily: 'var(--font-body)',
        }}
      >
        Connect {platform.label}
      </button>
    </div>
  );
}


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
    key:        'tiktok',
    label:      'TikTok',
    connectUrl: '/api/connect/tiktok',
    metrics: p => [
      p.subscriber_count      != null && { label: 'Followers',  value: p.subscriber_count.toLocaleString() },
      p.tiktok_like_count     != null && { label: 'Total likes', value: p.tiktok_like_count.toLocaleString() },
      p.tiktok_video_count    != null && { label: 'Videos',      value: p.tiktok_video_count.toLocaleString() },
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

function GmailCard() {
  const [status, setStatus]         = useState(null); // null = loading
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    api.get('/gmail/status')
      .then(setStatus)
      .catch(() => setStatus({ connected: false }));
  }, []);

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await api.delete('/gmail/disconnect');
      setStatus({ connected: false });
    } catch {
      setDisconnecting(false);
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <p className={styles.platformName}>Gmail</p>
          {status?.connected && (
            <p className={styles.platformHandle}>{status.gmailAddress}</p>
          )}
        </div>
        {status === null ? (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading…</span>
        ) : status.connected ? (
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--neon-mint)', background: 'rgba(158,255,216,0.08)', border: '1px solid rgba(158,255,216,0.2)', padding: '3px 10px', borderRadius: 999 }}>Connected</span>
        ) : (
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)', padding: '3px 10px', borderRadius: 999 }}>Not connected</span>
        )}
      </div>

      {status?.connected ? (
        <div className={styles.disconnectedState}>
          <p className={styles.disconnectedMsg}>
            Outreach emails will be sent directly from your Gmail account and tracked automatically in Creatrbase. Replies are detected hourly.
          </p>
          <Button size="sm" variant="ghost" onClick={handleDisconnect} disabled={disconnecting}>
            {disconnecting ? 'Disconnecting…' : 'Disconnect Gmail'}
          </Button>
        </div>
      ) : (
        <div className={styles.disconnectedState}>
          <p className={styles.disconnectedMsg}>
            Connect Gmail to send outreach directly from Creatrbase and automatically detect when brands reply.
          </p>
          <Button size="sm" onClick={() => { window.location.href = '/api/gmail/connect'; }}>
            Connect Gmail
          </Button>
        </div>
      )}
    </div>
  );
}

export function Connections() {
  const [platforms, setPlatforms] = useState([]);
  const [connectMsg, setConnectMsg] = useState(null);
  const [showTwitchModal, setShowTwitchModal] = useState(false);

  function loadPlatforms() {
    api.get('/connect/platforms')
      .then(({ platforms }) => setPlatforms(platforms))
      .catch((err) => {
        setConnectMsg({ type: 'error', text: `Failed to load platform status (${err.status ?? 'network error'}). Refresh to retry.` });
      });
  }

  useEffect(() => {
    // Handle ?connected= and ?connect_error= params on return from OAuth
    const params    = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    const error     = params.get('connect_error');
    if (params.get('gmail_connected')) {
      setConnectMsg({ type: 'success', text: 'Gmail connected. Outreach emails will now be sent directly from your account.' });
      window.history.replaceState({}, '', '/connections');
    } else if (params.get('gmail_error')) {
      setConnectMsg({ type: 'error', text: 'Gmail connection failed. Please try again.' });
      window.history.replaceState({}, '', '/connections');
    }
    if (connected) {
      const name = connected === 'youtube' ? 'YouTube' : connected === 'tiktok' ? 'TikTok' : connected === 'instagram' ? 'Instagram' : 'Twitch';
      setConnectMsg({ type: 'success', text: `${name} connected successfully.` });
      if (connected === 'twitch') setShowTwitchModal(true);
      window.history.replaceState({}, '', '/connections');
    } else if (error) {
      const ERRORS = {
        youtube_already_claimed: 'That YouTube channel is already connected to another Creatrbase account.',
        twitch_already_claimed:  'That Twitch account is already connected to another Creatrbase account.',
      };
      setConnectMsg({ type: 'error', text: ERRORS[error] ?? 'Connection failed. Please try again.' });
      window.history.replaceState({}, '', '/connections');
    }
    loadPlatforms();
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

      {connectMsg && (
        <div className={connectMsg.type === 'success' ? styles.msgSuccess : styles.msgError}>
          {connectMsg.text}
          <button className={styles.msgDismiss} onClick={() => setConnectMsg(null)}>✕</button>
        </div>
      )}

      <div className={styles.grid}>
        {PLATFORMS.map(platform => (
          <PlatformCard
            key={platform.key}
            platform={platform}
            data={platforms.find(p => p.platform === platform.key) ?? null}
            onDisconnect={handleDisconnect}
          />
        ))}
        <GmailCard />
        {COMING_SOON.map(platform => (
          <ComingSoonCard key={platform.key} platform={platform} />
        ))}
      </div>

      {showTwitchModal && (
        <div className={styles.modalOverlay} onClick={() => setShowTwitchModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <button className={styles.modalClose} onClick={() => setShowTwitchModal(false)} aria-label="Close">✕</button>
            <p className={styles.modalEyebrow}>Twitch connected</p>
            <h2 className={styles.modalTitle}>One thing to know about your live data</h2>
            <p className={styles.modalBody}>
              Your follower count, stream hours, and broadcast days will sync automatically every day. However, Twitch's API only exposes your live concurrent viewer count <strong>while you're actively streaming</strong> — historical averages aren't available via the public API.
            </p>
            <div className={styles.modalNote}>
              Next time you go live, hit <strong>Sync now</strong> on this page and we'll capture your viewer count in real time. The more syncs we have during streams, the more accurate your viability score becomes.
            </div>
            <button className={styles.modalAction} onClick={() => setShowTwitchModal(false)}>
              Got it
            </button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
