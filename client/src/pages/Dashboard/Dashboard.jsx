import { useEffect, useState } from 'react';
import { AppLayout } from '../../layouts/AppLayout/AppLayout';
import { Button } from '../../components/ui/Button/Button';
import { Badge } from '../../components/ui/Badge/Badge';
import { useAuth } from '../../lib/AuthContext';
import { api } from '../../lib/api';
import styles from './Dashboard.module.css';

const COMING_SOON = [
  {
    title: 'Weekly Tasks',
    desc: 'One specific, data-backed action each week targeting your weakest dimension.',
  },
  {
    title: 'Brand Outreach',
    desc: 'Discover brands actively buying in your niche and send approved outreach emails.',
  },
  {
    title: 'Negotiations',
    desc: 'Draft, counter, and track brand deal negotiations with AI-assisted language.',
  },
];

const CONNECT_ERRORS = {
  youtube_denied:         'YouTube access was denied. Please try again.',
  youtube_no_channel:     'No YouTube channel found on that Google account.',
  youtube_already_claimed:'That YouTube channel is already connected to another Creatrbase account.',
  twitch_denied:          'Twitch access was denied. Please try again.',
  twitch_no_profile:      'Could not retrieve your Twitch profile. Please try again.',
  twitch_already_claimed: 'That Twitch account is already connected to another Creatrbase account.',
};

async function goToCheckout(plan) {
  const { url } = await api.post('/billing/checkout', { plan });
  window.location.href = url;
}

async function goToPortal() {
  const { url } = await api.post('/billing/portal', {});
  window.location.href = url;
}

export function Dashboard() {
  const { user } = useAuth();
  const firstName = user?.displayName?.split(' ')[0] ?? 'there';
  const sub = user?.subscription;
  const isTrialling = sub?.status === 'trialling';

  const [platforms, setPlatforms]   = useState([]);
  const [connectMsg, setConnectMsg] = useState(null); // { type: 'success'|'error', text }
  const [niche, setNiche]           = useState(null);  // { niche, status }

  useEffect(() => {
    api.get('/connect/platforms').then(({ platforms }) => setPlatforms(platforms)).catch(() => {});
    api.get('/creator/niche').then(setNiche).catch(() => {});
  }, []);

  // Handle ?connected= and ?connect_error= params on return from OAuth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    const error     = params.get('connect_error');
    if (connected) {
      const name = connected === 'youtube' ? 'YouTube' : 'Twitch';
      setConnectMsg({ type: 'success', text: `${name} connected successfully.` });
      window.history.replaceState({}, '', '/dashboard');
      // Refresh platform list
      api.get('/connect/platforms').then(({ platforms }) => setPlatforms(platforms)).catch(() => {});
    } else if (error) {
      setConnectMsg({ type: 'error', text: CONNECT_ERRORS[error] ?? 'Connection failed. Please try again.' });
      window.history.replaceState({}, '', '/dashboard');
    }
  }, []);

  const yt     = platforms.find(p => p.platform === 'youtube');
  const twitch = platforms.find(p => p.platform === 'twitch');
  const allConnected = yt && twitch;

  const ytSubscribers = yt?.subscriber_count;
  const ytWatchHours  = yt?.watch_hours_12mo;

  function syncedHint(platform) {
    if (!platform) return 'Connect YouTube to see this';
    if (!platform.last_synced_at) return 'Last synced: pending first sync';
    const d = new Date(platform.last_synced_at);
    return `Last synced: ${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} at ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
  }

  return (
    <AppLayout>
      {isTrialling && sub.trialDaysLeft !== null && (
        <div className={styles.trialBanner}>
          <p className={styles.trialText}>
            <strong>{sub.trialDaysLeft} day{sub.trialDaysLeft !== 1 ? 's' : ''} left</strong> on your free trial.
            Upgrade to keep full access after your trial ends.
          </p>
          <div className={styles.trialActions}>
            <Button size="sm" variant="secondary" onClick={() => goToCheckout('core')}>
              Core — £10/mo
            </Button>
            <Button size="sm" onClick={() => goToCheckout('pro')}>
              Pro — £20/mo
            </Button>
          </div>
        </div>
      )}

      {connectMsg && (
        <div className={connectMsg.type === 'success' ? styles.msgSuccess : styles.msgError}>
          {connectMsg.text}
          <button className={styles.msgDismiss} onClick={() => setConnectMsg(null)}>✕</button>
        </div>
      )}

      <div className={styles.header}>
        <h1 className={styles.greeting}>
          Hey, <span>{firstName}</span>.
        </h1>
        <p className={styles.sub}>
          {allConnected ? 'Your platforms are connected.' : 'Connect your platforms to get started.'}
        </p>
      </div>

      {!allConnected && (
        <div className={styles.connectBanner}>
          <div className={styles.connectText}>
            <p className={styles.connectTitle}>Connect YouTube or Twitch</p>
            <p className={styles.connectDesc}>
              Creatrbase needs access to your channel metrics to calculate your commercial viability score,
              track your gap to monetisation thresholds, and generate your weekly tasks.
            </p>
          </div>
          <div className={styles.connectActions}>
            {yt ? (
              <div className={styles.connectedPill}>
                <span className={styles.connectedDot} />
                YouTube — {yt.platform_display_name ?? yt.platform_username}
              </div>
            ) : (
              <Button variant="primary" onClick={() => { window.location.href = '/api/connect/youtube'; }}>
                Connect YouTube
              </Button>
            )}
            {twitch ? (
              <div className={styles.connectedPill}>
                <span className={styles.connectedDot} />
                Twitch — {twitch.platform_display_name ?? twitch.platform_username}
              </div>
            ) : (
              <Button variant="ghost" onClick={() => { window.location.href = '/api/connect/twitch'; }}>
                Connect Twitch
              </Button>
            )}
          </div>
        </div>
      )}

      <p className={styles.sectionTitle}>Your Metrics</p>
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <p className={styles.kpiLabel}>Subscribers</p>
          {ytSubscribers != null
            ? <p className={styles.kpiValue}>{ytSubscribers.toLocaleString()}</p>
            : <p className={styles.kpiEmpty}>—</p>}
          <p className={styles.kpiHint}>{syncedHint(yt)}</p>
        </div>
        <div className={styles.kpiCard}>
          <p className={styles.kpiLabel}>Watch Hours (12m)</p>
          {ytWatchHours != null
            ? <p className={styles.kpiValue}>{Math.round(ytWatchHours).toLocaleString()}</p>
            : <p className={styles.kpiEmpty}>—</p>}
          <p className={styles.kpiHint}>{syncedHint(yt)}</p>
        </div>
        <div className={styles.kpiCard}>
          <p className={styles.kpiLabel}>Viability Score</p>
          <p className={styles.kpiEmpty}>—</p>
          <p className={styles.kpiHint}>Calculated after first sync</p>
        </div>
      </div>

      {niche && niche.status !== 'no_youtube' && niche.status !== 'no_creator' && (
        <div className={styles.nicheSection}>
          <p className={styles.sectionTitle}>Content Profile</p>
          {niche.status === 'analysing' && (
            <div className={styles.nicheCard}>
              <p className={styles.nichePulse}>Analysing your content…</p>
              <p className={styles.nicheHint}>This usually takes under a minute.</p>
            </div>
          )}
          {niche.status === 'ready' && niche.niche && (
            <div className={styles.nicheCard}>
              <div className={styles.nicheHeader}>
                <div>
                  <p className={styles.nicheCategory}>{niche.niche.primary_niche_category}</p>
                  <p className={styles.nicheSpecific}>{niche.niche.primary_niche_specific.replace(/_/g, ' ')}</p>
                </div>
                <Badge
                  variant={
                    niche.niche.classification_confidence === 'high'   ? 'mint' :
                    niche.niche.classification_confidence === 'medium' ? 'peach' : 'error'
                  }
                >
                  {niche.niche.classification_confidence} confidence
                </Badge>
              </div>
              {niche.niche.content_format_primary && (
                <p className={styles.nicheFormat}>
                  Primary format: <strong>{niche.niche.content_format_primary.replace(/_/g, ' ')}</strong>
                  {niche.niche.content_format_secondary && (
                    <span> · {niche.niche.content_format_secondary.replace(/_/g, ' ')}</span>
                  )}
                </p>
              )}
              <p className={styles.nicheNotes}>{niche.niche.niche_commercial_notes}</p>
              {niche.niche.existing_partnerships_likely && (
                <p className={styles.nichePartnerships}>Existing brand partnerships detected</p>
              )}
            </div>
          )}
        </div>
      )}

      <p className={styles.sectionTitle}>
        Coming Next <Badge variant="lavender">In Development</Badge>
      </p>
      <div className={styles.comingGrid}>
        {COMING_SOON.map(({ title, desc }) => (
          <div key={title} className={styles.comingCard}>
            <p className={styles.comingCardTitle}>{title}</p>
            <p className={styles.comingCardDesc}>{desc}</p>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
