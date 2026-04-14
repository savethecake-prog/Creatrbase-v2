import { useEffect, useState, useMemo } from 'react';
import { AppLayout } from '../../layouts/AppLayout/AppLayout';
import { Button } from '../../components/ui/Button/Button';
import { Badge } from '../../components/ui/Badge/Badge';
import { useAuth } from '../../lib/AuthContext';
import { api } from '../../lib/api';
import styles from './Dashboard.module.css';

// ─── Score history chart ──────────────────────────────────────────────────────

const W = 560, H = 130;
const PAD = { top: 12, right: 12, bottom: 26, left: 32 };
const PW  = W - PAD.left - PAD.right;
const PH  = H - PAD.top  - PAD.bottom;

const TIER_LINES = [
  { score: 75, label: 'established' },
  { score: 50, label: 'viable' },
  { score: 25, label: 'emerging' },
];

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function ScoreChart({ history }) {
  if (!history || history.length < 2) return null;

  const toX = i  => PAD.left + (i / (history.length - 1)) * PW;
  const toY = sc => PAD.top  + (1 - (sc ?? 0) / 100) * PH;

  const points = history.map((p, i) => `${toX(i)},${toY(p.overall_score)}`).join(' ');

  // Show up to 3 x-axis date labels
  const dateIdxs = history.length <= 3
    ? history.map((_, i) => i)
    : [0, Math.floor((history.length - 1) / 2), history.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
      {/* Tier threshold lines */}
      {TIER_LINES.map(({ score, label }) => {
        const y = toY(score);
        return (
          <g key={score}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y}
              stroke="rgba(255,255,255,0.07)" strokeWidth="1" strokeDasharray="4 3" />
            <text x={W - PAD.right + 4} y={y + 4} fontSize="9" fill="rgba(255,255,255,0.22)">{label}</text>
          </g>
        );
      })}
      {/* Y-axis extremes */}
      <text x={PAD.left - 4} y={PAD.top + 4}  textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.2)">100</text>
      <text x={PAD.left - 4} y={PAD.top + PH + 4} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.2)">0</text>
      {/* Gradient fill under the line */}
      <defs>
        <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="rgba(158,255,216,0.18)" />
          <stop offset="100%" stopColor="rgba(158,255,216,0)" />
        </linearGradient>
      </defs>
      <polygon
        points={`${toX(0)},${PAD.top + PH} ${points} ${toX(history.length - 1)},${PAD.top + PH}`}
        fill="url(#scoreGrad)"
      />
      {/* Score line */}
      <polyline points={points} fill="none" stroke="var(--cb-mint)"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Dots */}
      {history.map((p, i) => (
        <circle key={i} cx={toX(i)} cy={toY(p.overall_score)} r="3" fill="var(--cb-mint)">
          <title>{fmtDate(p.scored_at)} — {p.overall_score ?? '–'}</title>
        </circle>
      ))}
      {/* X-axis labels */}
      {dateIdxs.map((idx, j) => (
        <text key={idx} x={toX(idx)} y={H - 4}
          textAnchor={j === 0 ? 'start' : j === dateIdxs.length - 1 ? 'end' : 'middle'}
          fontSize="10" fill="rgba(255,255,255,0.28)"
        >
          {fmtDate(history[idx].scored_at)}
        </text>
      ))}
    </svg>
  );
}

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

// ─── View momentum helpers ────────────────────────────────────────────────────

function fmtViews(n) {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return Math.round(n).toLocaleString();
}

function MomentumCard({ label, value, compareValue }) {
  // compareValue is the shorter window (30d for 60d card, 60d for 90d card)
  // Trend: positive = value > compareValue (older avg < newer avg means audience growing)
  const trend = compareValue != null && value != null
    ? value > compareValue * 1.05 ? 'up'
    : value < compareValue * 0.95 ? 'down'
    : 'flat'
    : null;

  const trendText = trend === 'up'   ? `↑ trending up`
                  : trend === 'down' ? `↓ softening`
                  : trend === 'flat' ? `→ holding steady`
                  : null;

  const trendClass = trend === 'up'   ? styles.momentumUp
                   : trend === 'down' ? styles.momentumDown
                   : styles.momentumFlat;

  return (
    <div className={styles.momentumCard}>
      <p className={styles.momentumLabel}>{label}</p>
      {value != null
        ? <p className={styles.momentumValue}>{fmtViews(value)}</p>
        : <p className={styles.momentumEmpty}>—</p>}
      {trendText && (
        <p className={`${styles.momentumTrend} ${trendClass}`}>{trendText}</p>
      )}
      {!trendText && (
        <p className={styles.momentumNote}>vs. shorter window</p>
      )}
    </div>
  );
}

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
  const [history, setHistory]           = useState(null);  // { history: [...], status }
  const [dismissedCelebrations, setDismissedCelebrations] = useState(() => {
    const s = new Set();
    for (const t of MILESTONE_ORDER) {
      if (localStorage.getItem(`cb_celebrate_${t}`) === '1') s.add(t);
    }
    return s;
  });

  useEffect(() => {
    api.get('/connect/platforms').then(({ platforms }) => setPlatforms(platforms)).catch(() => {});
    api.get('/creator/niche').then(setNiche).catch(() => {});
    api.get('/creator/score').then(setScoreData).catch(() => {});
    api.get('/creator/recommendation').then(setRecData).catch(() => {});
    api.get('/creator/score/history').then(setHistory).catch(() => {});
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
              ? scoreData.score.tier.replace(/_/g, ' ')
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

          {history?.history?.length >= 2 && (
            <div className={styles.chartSection}>
              <p className={styles.chartLabel}>Score trend</p>
              <ScoreChart history={history.history} />
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
              <div className={styles.recHeader}>
                <div className={styles.recBadges}>
                  <Badge variant="mint">Added to tasks</Badge>
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

    </AppLayout>
  );
}
