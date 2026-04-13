import { useEffect, useState } from 'react';
import { AppLayout } from '../../layouts/AppLayout/AppLayout';
import { Button } from '../../components/ui/Button/Button';
import { Badge } from '../../components/ui/Badge/Badge';
import { useAuth } from '../../lib/AuthContext';
import { api } from '../../lib/api';
import styles from './Dashboard.module.css';

const COMING_SOON = [
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

  const [platforms, setPlatforms]       = useState([]);
  const [connectMsg, setConnectMsg]     = useState(null); // { type: 'success'|'error', text }
  const [niche, setNiche]               = useState(null);  // { niche, status }
  const [scoreData, setScoreData]       = useState(null);  // { score, milestones, status }
  const [recData, setRecData]           = useState(null);  // { recommendation, status }
  const [recResponding, setRecResponding] = useState(false);

  useEffect(() => {
    api.get('/connect/platforms').then(({ platforms }) => setPlatforms(platforms)).catch(() => {});
    api.get('/creator/niche').then(setNiche).catch(() => {});
    api.get('/creator/score').then(setScoreData).catch(() => {});
    api.get('/creator/recommendation').then(setRecData).catch(() => {});
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
          {scoreData?.score?.overall != null
            ? <p className={styles.kpiValue}>{scoreData.score.overall}</p>
            : <p className={styles.kpiEmpty}>—</p>}
          <p className={styles.kpiHint}>
            {scoreData?.score?.tier
              ? scoreData.score.tier.replace(/_/g, ' ')
              : 'Calculated after content analysis'}
          </p>
        </div>
      </div>

      {scoreData && scoreData.status === 'ready' && scoreData.score && (
        <div className={styles.scoreSection}>
          <p className={styles.sectionTitle}>Commercial Viability</p>
          <div className={styles.scoreCard}>
            <div className={styles.scoreMain}>
              <div className={styles.scoreCircle}>
                <span className={styles.scoreNumber}>{scoreData.score.overall ?? '—'}</span>
                <span className={styles.scoreLabel}>/ 100</span>
              </div>
              <div className={styles.scoreMeta}>
                <p className={styles.scoreTier}>
                  {scoreData.score.tier
                    ? scoreData.score.tier.replace(/_/g, ' ')
                    : 'Calculating…'}
                </p>
                <Badge
                  variant={
                    scoreData.score.confidence === 'high'   ? 'mint' :
                    scoreData.score.confidence === 'medium' ? 'peach' : 'error'
                  }
                >
                  {scoreData.score.confidence} confidence
                </Badge>
                {scoreData.score.primary_constraint && (
                  <p className={styles.scoreConstraint}>
                    Top constraint: <strong>{scoreData.score.primary_constraint.replace(/_/g, ' ')}</strong>
                  </p>
                )}
              </div>
            </div>

            {scoreData.score.dimensions && (
              <div className={styles.dimensionGrid}>
                {Object.entries(scoreData.score.dimensions).map(([key, dim]) => (
                  <div key={key} className={styles.dimRow}>
                    <span className={styles.dimLabel}>{key.replace(/_/g, ' ')}</span>
                    <div className={styles.dimBar}>
                      <div
                        className={styles.dimFill}
                        style={{
                          width: dim.score != null ? `${dim.score}%` : '0%',
                          opacity: dim.confidence === 'insufficient_data' ? 0.25 : 1,
                        }}
                      />
                    </div>
                    <span className={styles.dimScore}>
                      {dim.score != null ? dim.score : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {scoreData.milestones?.length > 0 && (
            <div className={styles.milestoneStrip}>
              {scoreData.milestones.map(ms => (
                <div
                  key={ms.type}
                  className={[
                    styles.milestone,
                    ms.status === 'crossed'     ? styles.milestoneCrossed     : '',
                    ms.status === 'approaching' ? styles.milestoneApproaching : '',
                    ms.status === 'in_progress' ? styles.milestoneInProgress  : '',
                  ].filter(Boolean).join(' ')}
                >
                  <span className={styles.milestoneDot} />
                  <span className={styles.milestoneLabel}>
                    {ms.type.replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {recData && recData.status !== 'no_creator' && (
        <div className={styles.recSection}>
          <p className={styles.sectionTitle}>This Week's Task</p>

          {recData.status === 'generating' && (
            <div className={styles.recCard}>
              <p className={styles.recPulse}>Generating your task…</p>
              <p className={styles.recHint}>Analysing your top constraint. Ready in under a minute.</p>
            </div>
          )}

          {recData.status === 'no_data' && (
            <div className={styles.recCard}>
              <p className={styles.recEmpty}>No task available yet.</p>
              <p className={styles.recHint}>Tasks are generated after your commercial viability score is calculated.</p>
            </div>
          )}

          {recData.recommendation && recData.status === 'pending' && (
            <div className={styles.recCard}>
              <div className={styles.recHeader}>
                <div className={styles.recBadges}>
                  <Badge variant="peach">{recData.recommendation.constraint_dimension?.replace(/_/g, ' ')}</Badge>
                  {recData.recommendation.constraint_severity && (
                    <Badge variant={recData.recommendation.constraint_severity === 'critical' ? 'error' : 'lavender'}>
                      {recData.recommendation.constraint_severity}
                    </Badge>
                  )}
                  {recData.recommendation.expected_impact_confidence && (
                    <Badge variant={
                      recData.recommendation.expected_impact_confidence === 'high'   ? 'mint' :
                      recData.recommendation.expected_impact_confidence === 'medium' ? 'peach' : 'lavender'
                    }>
                      {recData.recommendation.expected_impact_confidence} confidence
                    </Badge>
                  )}
                </div>
              </div>
              <p className={styles.recTitle}>{recData.recommendation.title}</p>
              <p className={styles.recAction}>{recData.recommendation.specific_action}</p>
              {recData.recommendation.reasoning && (
                <p className={styles.recReasoning}>{recData.recommendation.reasoning}</p>
              )}
              {recData.recommendation.expected_impact_description && (
                <p className={styles.recImpact}>
                  <span className={styles.recImpactLabel}>Expected impact</span>
                  {recData.recommendation.expected_impact_description}
                </p>
              )}
              <div className={styles.recActions}>
                <Button
                  size="sm"
                  onClick={() => respondToRec(recData.recommendation.id, 'accepted')}
                  disabled={recResponding}
                >
                  Add to my tasks
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => respondToRec(recData.recommendation.id, 'deferred')}
                  disabled={recResponding}
                >
                  Not this week
                </Button>
              </div>
            </div>
          )}

          {recData.recommendation && recData.status === 'converted_to_task' && (
            <div className={styles.recCard}>
              <p className={styles.recAccepted}>Task added — check your task list.</p>
              <p className={styles.recTitle}>{recData.recommendation.title}</p>
            </div>
          )}

          {recData.recommendation && (recData.status === 'deferred' || recData.status === 'declined') && (
            <div className={styles.recCard}>
              <p className={styles.recEmpty}>You skipped this task.</p>
              <p className={styles.recHint}>A new task will be generated after your next sync.</p>
            </div>
          )}
        </div>
      )}

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
