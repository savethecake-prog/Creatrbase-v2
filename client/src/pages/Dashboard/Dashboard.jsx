import { useEffect, useState, useMemo } from 'react';
import { AppLayout } from '../../layouts/AppLayout/AppLayout';
import { Button } from '../../components/ui/Button/Button';
import { SignalFeed } from '../../components/SignalFeed/SignalFeed';
import { useAuth } from '../../lib/AuthContext';
import { api } from '../../lib/api';
import { tierShort } from '../../lib/tierGrades';
import { MomentumCard, fmtViews } from './DashboardCharts';
import { DashboardScore, DashboardRec } from './DashboardSections';
import styles from './Dashboard.module.css';

// ─── Milestone celebration ────────────────────────────────────────────────────

const MILESTONE_ORDER = [
  'giftable', 'outreach_ready', 'paid_integration_viable',
  'rate_negotiation_power', 'portfolio_creator',
];

const MILESTONE_MESSAGES = {
  giftable:                 'Brands are now open to gifting you products. Your niche is commercially identifiable.',
  outreach_ready:           "You're ready to start reaching out to brands directly. Start warm.",
  paid_integration_viable:  'Brands will now consider paid integrations. You have a viable commercial profile.',
  rate_negotiation_power:   'You have the leverage to negotiate better rates. Use it.',
  portfolio_creator:        "Portfolio creator status. You're in the top tier.",
};

const COMING_SOON = [];

const CONNECT_ERRORS = {
  youtube_denied:         'YouTube access was denied. Please try again.',
  youtube_no_channel:     'No YouTube channel found on that Google account.',
  youtube_already_claimed:'That YouTube channel is already connected to another Creatrbase account.',
  twitch_denied:          'Twitch access was denied. Please try again.',
  twitch_no_profile:      'Could not retrieve your Twitch profile. Please try again.',
  twitch_already_claimed: 'That Twitch account is already connected to another Creatrbase account.',
};

export function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const firstName = user?.displayName?.split(' ')[0] ?? 'there';

  const [platforms, setPlatforms]       = useState([]);
  const [platformsLoaded, setPlatformsLoaded] = useState(false);
  const [connectMsg, setConnectMsg]     = useState(null); // { type: 'success'|'error', text }
  const [niche, setNiche]               = useState(null);  // { niche, status }
  const [scoreData, setScoreData]       = useState(null);  // { score, milestones, status }
  const [recData, setRecData]           = useState(null);  // { recommendation, status }
  const [recResponding, setRecResponding] = useState(false);
  const [history, setHistory]           = useState(null);  // { history: [...], status }
  const [progress, setProgress]         = useState(null);  // weekly progress snapshot
  const [showScoreCard, setShowScoreCard] = useState(false);
  const [showWelcome, setShowWelcome]   = useState(false);
  const [dismissedCelebrations, setDismissedCelebrations] = useState(() => {
    const s = new Set();
    for (const t of MILESTONE_ORDER) {
      if (localStorage.getItem(`cb_celebrate_${t}`) === '1') s.add(t);
    }
    return s;
  });

  useEffect(() => {
    api.get('/connect/platforms')
      .then(({ platforms }) => { setPlatforms(platforms); setPlatformsLoaded(true); })
      .catch((err) => { setPlatformsLoaded(true); setConnectMsg({ type: 'error', text: `Could not load platform status (${err.status ?? 'network error'}). Refresh to retry.` }); });
    api.get('/creator/niche').then(setNiche).catch(err => console.error('[Dashboard]', err));
    api.get('/creator/score').then(setScoreData).catch(err => console.error('[Dashboard]', err));
    api.get('/creator/recommendation').then(setRecData).catch(err => console.error('[Dashboard]', err));
    api.get('/creator/score/history').then(setHistory).catch(err => console.error('[Dashboard]', err));
    api.get('/creator/score/weekly-progress').then(setProgress).catch(err => console.error('[Dashboard]', err));
  }, []);

  // Handle ?welcome=1, ?connected=, ?connect_error= params
  useEffect(() => {
    const params    = new URLSearchParams(window.location.search);
    const welcome   = params.get('welcome');
    const connected = params.get('connected');
    const error     = params.get('connect_error');

    if (welcome === '1') {
      setShowWelcome(true);
      window.history.replaceState({}, '', '/dashboard');
    } else if (connected) {
      const name = connected === 'youtube' ? 'YouTube' : 'Twitch';
      setConnectMsg({ type: 'success', text: `${name} connected successfully.` });
      window.history.replaceState({}, '', '/dashboard');
      api.get('/connect/platforms').then(({ platforms }) => setPlatforms(platforms)).catch((err) => { setConnectMsg({ type: 'error', text: `Could not load platform status (${err.status ?? 'network error'}). Refresh to retry.` }); });
    } else if (error) {
      setConnectMsg({ type: 'error', text: CONNECT_ERRORS[error] ?? 'Connection failed. Please try again.' });
      window.history.replaceState({}, '', '/dashboard');
    }
  }, []);

  const yt     = platforms.find(p => p.platform === 'youtube'  && p.sync_status !== 'disconnected') ?? null;
  const twitch = platforms.find(p => p.platform === 'twitch'   && p.sync_status !== 'disconnected') ?? null;


  const ytSubscribers    = yt?.subscriber_count;
  const ytWatchHours     = yt?.watch_hours_12mo;
  const ytAvgViews30d    = yt?.avg_views_per_video_30d ?? null;
  const ytAvgViews60d    = yt?.avg_views_per_video_60d ?? null;
  const ytAvgViews90d    = yt?.avg_views_per_video_90d ?? null;

  const celebrateMilestone = useMemo(() => {
    if (!scoreData?.milestones) return null;
    for (let i = MILESTONE_ORDER.length - 1; i >= 0; i--) {
      const type = MILESTONE_ORDER[i];
      if (dismissedCelebrations.has(type)) continue;
      const ms = scoreData.milestones.find(m => m.type === type && m.status === 'crossed');
      if (ms) return ms;
    }
    return null;
  }, [scoreData, dismissedCelebrations]);

  function dismissCelebration(type) {
    localStorage.setItem(`cb_celebrate_${type}`, '1');
    setDismissedCelebrations(prev => new Set([...prev, type]));
  }

  async function respondToRec(id, response) {
    setRecResponding(true);
    try {
      const result = await api.post(`/creator/recommendation/${id}/respond`, { response });
      setRecData(prev => prev
        ? { ...prev, recommendation: { ...prev.recommendation, status: result.status, creator_response: response }, status: result.status }
        : prev
      );
    } catch {
      // best-effort
    } finally {
      setRecResponding(false);
    }
  }

  function syncedHint(platform) {
    if (!platform) return 'Connect YouTube to see this';
    if (!platform.last_synced_at) return 'Last synced: pending first sync';
    const d = new Date(platform.last_synced_at);
    return `Last synced: ${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} at ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
  }

  return (
    <AppLayout>
      {showWelcome && scoreData?.score && (
        <div className={styles.welcomeBanner}>
          <div className={styles.welcomeContent}>
            <p className={styles.welcomeEyebrow}>Your profile is ready</p>
            <p className={styles.welcomeTitle}>
              Your commercial viability score is{' '}
              <span className={styles.welcomeScore}>{scoreData.score.overall}</span>
              {' '}— {tierShort(scoreData.score.tier)}.
            </p>
            <p className={styles.welcomeDesc}>
              {scoreData.score.primary_constraint
                ? <>Your top constraint right now is <strong>{scoreData.score.primary_constraint.replace(/_/g, ' ')}</strong>. Your first task is already generated below — it targets exactly this.</>
                : <>Your score is calculated. Your first task is already generated below — check it out.</>}
            </p>
          </div>
          <button className={styles.welcomeDismiss} onClick={() => setShowWelcome(false)}>✕</button>
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
          {yt ? 'Your commercial intelligence dashboard.' : 'Reconnect your platforms to resume tracking.'}
        </p>
      </div>

      {platformsLoaded && (!yt || !twitch) && (
        <div className={styles.connectBanner}>
          <div className={styles.connectText}>
            <p className={styles.connectTitle}>
              {!yt && platforms.length === 0
                ? 'Connect your platforms'
                : !yt && !twitch ? 'Platforms disconnected'
                : !yt ? 'YouTube disconnected'
                : 'Twitch disconnected'}
            </p>
            <p className={styles.connectDesc}>
              {platforms.length === 0
                ? 'Connect YouTube to calculate your commercial viability score, track your gap to brand thresholds, and get a weekly action task.'
                : 'Reconnect to resume syncing your metrics, score updates, and weekly tasks.'}
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
                {platforms.length === 0 ? 'Connect YouTube' : 'Reconnect YouTube'}
              </Button>
            )}
            {twitch ? (
              <div className={styles.connectedPill}>
                <span className={styles.connectedDot} />
                Twitch — {twitch.platform_display_name ?? twitch.platform_username}
              </div>
            ) : (
              <Button variant="ghost" onClick={() => { window.location.href = '/api/connect/twitch'; }}>
                {platforms.length === 0 ? 'Connect Twitch' : 'Reconnect Twitch'}
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
          <p className={styles.kpiLabel}>Avg Views / Video (30d)</p>
          {ytAvgViews30d != null
            ? <p className={styles.kpiValue}>{fmtViews(ytAvgViews30d)}</p>
            : <p className={styles.kpiEmpty}>—</p>}
          <p className={styles.kpiHint}>
            {ytAvgViews30d != null ? 'Recent upload performance' : syncedHint(yt)}
          </p>
        </div>
        <div className={styles.kpiCard}>
          <p className={styles.kpiLabel}>Viability Score</p>
          {scoreData?.score?.overall != null
            ? <p className={styles.kpiValue}>{scoreData.score.overall}</p>
            : <p className={styles.kpiEmpty}>—</p>}
          <p className={styles.kpiHint}>
            {scoreData?.score?.tier
              ? tierShort(scoreData.score.tier)
              : 'Calculated after content analysis'}
          </p>
        </div>
      </div>

      {(ytAvgViews30d != null || ytAvgViews60d != null || ytAvgViews90d != null) && (
        <div className={styles.momentumSection}>
          <p className={styles.sectionTitle}>View Momentum</p>
          <div className={styles.momentumGrid}>
            <MomentumCard label="30-Day Avg" value={ytAvgViews30d} />
            <MomentumCard label="60-Day Avg" value={ytAvgViews60d} compareValue={ytAvgViews30d} />
            <MomentumCard label="90-Day Avg" value={ytAvgViews90d} compareValue={ytAvgViews60d ?? ytAvgViews30d} />
          </div>
        </div>
      )}

      {celebrateMilestone && (
        <div className={styles.celebration}>
          <div className={styles.celebrationContent}>
            <p className={styles.celebrationEyebrow}>Milestone reached</p>
            <p className={styles.celebrationTitle}>{celebrateMilestone.type.replace(/_/g, ' ')}</p>
            <p className={styles.celebrationMsg}>{MILESTONE_MESSAGES[celebrateMilestone.type]}</p>
          </div>
          <button className={styles.celebrationDismiss} onClick={() => dismissCelebration(celebrateMilestone.type)}>✕</button>
        </div>
      )}

      <DashboardScore
        scoreData={scoreData}
        history={history}
        progress={progress}
        showScoreCard={showScoreCard}
        onToggleScoreCard={() => setShowScoreCard(v => !v)}
        platforms={platforms}
        niche={niche}
      />

      <DashboardRec
        recData={recData}
        recResponding={recResponding}
        onRespond={respondToRec}
      />

      <SignalFeed limit={3} />

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

    </AppLayout>
  );
}
