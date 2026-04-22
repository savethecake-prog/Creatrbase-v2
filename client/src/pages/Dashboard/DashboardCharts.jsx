// Sub-components for Dashboard: score chart, momentum cards, weekly progress snapshot
import styles from './Dashboard.module.css';

const W   = 560, H   = 130;
const PAD = { top: 12, right: 12, bottom: 26, left: 32 };
const PW  = W - PAD.left - PAD.right;
const PH  = H - PAD.top  - PAD.bottom;

const TIER_LINES = [
  { score: 75, label: 'established' },
  { score: 50, label: 'viable' },
  { score: 25, label: 'emerging' },
];

function fmtChartDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

// ─── Score history chart ──────────────────────────────────────────────────────

export function ScoreChart({ history }) {
  if (!history || history.length < 2) return null;

  const toX = i  => PAD.left + (i / (history.length - 1)) * PW;
  const toY = sc => PAD.top  + (1 - (sc ?? 0) / 100) * PH;

  const points = history.map((p, i) => `${toX(i)},${toY(p.overall_score)}`).join(' ');

  const dateIdxs = history.length <= 3
    ? history.map((_, i) => i)
    : [0, Math.floor((history.length - 1) / 2), history.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
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
      <text x={PAD.left - 4} y={PAD.top + 4}      textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.2)">100</text>
      <text x={PAD.left - 4} y={PAD.top + PH + 4} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.2)">0</text>
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
      <polyline points={points} fill="none" stroke="var(--cb-mint)"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {history.map((p, i) => (
        <circle key={i} cx={toX(i)} cy={toY(p.overall_score)} r="3" fill="var(--cb-mint)">
          <title>{fmtChartDate(p.scored_at)} — {p.overall_score ?? '–'}</title>
        </circle>
      ))}
      {dateIdxs.map((idx, j) => (
        <text key={idx} x={toX(idx)} y={H - 4}
          textAnchor={j === 0 ? 'start' : j === dateIdxs.length - 1 ? 'end' : 'middle'}
          fontSize="10" fill="rgba(255,255,255,0.28)"
        >
          {fmtChartDate(history[idx].scored_at)}
        </text>
      ))}
    </svg>
  );
}

// ─── View momentum card ───────────────────────────────────────────────────────

export function fmtViews(n) {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return Math.round(n).toLocaleString();
}

export function MomentumCard({ label, value, compareValue }) {
  const trend = compareValue != null && value != null
    ? value > compareValue * 1.05 ? 'up'
    : value < compareValue * 0.95 ? 'down'
    : 'flat'
    : null;

  const trendText  = trend === 'up'   ? '↑ trending up'
                   : trend === 'down' ? '↓ softening'
                   : trend === 'flat' ? '→ holding steady'
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

// ─── Weekly progress snapshot ─────────────────────────────────────────────────

const DIM_LABELS = {
  subscriber_momentum:     'Subscriber momentum',
  engagement_quality:      'Engagement quality',
  niche_commercial_value:  'Niche commercial value',
  audience_geo_alignment:  'Audience geo',
  content_consistency:     'Content consistency',
  content_brand_alignment: 'Brand alignment',
};

export function WeeklyProgressSnapshot({ progress }) {
  if (!progress || progress.status !== 'ok') return null;

  const { delta, current_score, dimension_deltas, compared_to } = progress;
  if (delta === 0 && (!dimension_deltas || dimension_deltas.length === 0)) return null;

  const sign      = delta > 0 ? '+' : '';
  const isUp      = delta > 0;
  const isDown    = delta < 0;
  const topDeltas = (dimension_deltas ?? []).slice(0, 3);
  const comparedDate = compared_to
    ? new Date(compared_to).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
    : null;

  return (
    <div className={styles.progressSnapshot}>
      <div className={styles.progressHeader}>
        <p className={styles.progressEyebrow}>Since last week</p>
        <div className={styles.progressScoreRow}>
          <span className={styles.progressScoreValue}>{current_score}</span>
          <span className={styles.progressScoreMax}>/100</span>
          {delta !== 0 && (
            <span className={`${styles.progressDelta} ${isUp ? styles.progressDeltaUp : isDown ? styles.progressDeltaDown : ''}`}>
              {sign}{delta}
            </span>
          )}
        </div>
        {comparedDate && (
          <p className={styles.progressComparedDate}>vs. {comparedDate}</p>
        )}
      </div>
      {topDeltas.length > 0 && (
        <div className={styles.progressDims}>
          {topDeltas.map(d => (
            <div key={d.dimension} className={styles.progressDimRow}>
              <span className={styles.progressDimLabel}>
                {DIM_LABELS[d.dimension] ?? d.dimension.replace(/_/g, ' ')}
              </span>
              <span className={`${styles.progressDimDelta} ${d.delta > 0 ? styles.progressDimUp : styles.progressDimDown}`}>
                {d.delta > 0 ? '+' : ''}{d.delta}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
