import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../../layouts/AppLayout/AppLayout';
import { UpgradeGate } from '../../components/UpgradeGate/UpgradeGate';
import { api } from '../../lib/api';
import { TIER_GRADE } from '../../lib/tierGrades';
import styles from './AuditPage.module.css';

// ─── Constants ────────────────────────────────────────────────────────────────

const DIM_LABELS = {
  subscriber_momentum:     'Brand recognition trajectory',
  engagement_quality:      'Audience engagement quality',
  niche_commercial_value:  'Niche commercial density',
  audience_geo_alignment:  'Premium market reach',
  content_consistency:     'Publishing consistency',
  content_brand_alignment: 'Sponsorship environment',
};

const DIM_ORDER = [
  'niche_commercial_value',
  'engagement_quality',
  'audience_geo_alignment',
  'subscriber_momentum',
  'content_consistency',
  'content_brand_alignment',
];

const STATE_META = {
  ceiling:      { label: 'Strong',       color: 'var(--cb-mint-deep)' },
  healthy:      { label: 'Good',         color: 'var(--cb-lavender)' },
  constraining: { label: 'Needs work',   color: 'var(--cb-peach)' },
  critical:     { label: 'Critical',     color: 'var(--error)' },
};

const STATE_COPY = {
  ceiling:      (label) => `${label} is performing well. Brands are not held back by this dimension.`,
  healthy:      (label) => `${label} is solid. Minor improvements here won't move the needle much.`,
  constraining: (label) => `${label} is limiting your rate potential and brand deal likelihood.`,
  critical:     (label) => `${label} is a significant barrier. Brands screen negatively on this.`,
};

const TIER_META = {
  established:    { label: `${TIER_GRADE.established} tier`, bg: 'var(--cb-mint)',     text: 'var(--cb-navy)' },
  viable:         { label: `${TIER_GRADE.viable} tier`,      bg: 'var(--cb-lavender)', text: 'var(--cb-navy)' },
  emerging:       { label: `${TIER_GRADE.emerging} tier`,    bg: 'var(--cb-peach)',    text: 'var(--cb-navy)' },
  pre_commercial: { label: `${TIER_GRADE.pre_commercial} tier`, bg: 'var(--error-subtle)', text: 'var(--error)' },
};

const MILESTONE_LABELS = {
  giftable:               'Gifting',
  outreach_ready:         'Outreach Ready',
  paid_integration_viable:'Paid Deals',
  rate_negotiation_power: 'Rate Power',
  portfolio_creator:      'Portfolio Creator',
};

const TIME_LABELS = {
  immediate:   'Act now',
  short_term:  '1-4 weeks',
  medium_term: '1-3 months',
  long_term:   '3+ months',
};

const CONSTRAINT_LABELS = {
  subscriber_momentum:     'brand recognition trajectory',
  engagement_quality:      'audience engagement quality',
  niche_commercial_value:  'niche commercial density',
  audience_geo_alignment:  'premium market reach',
  content_consistency:     'publishing consistency',
  content_brand_alignment: 'sponsorship environment',
};

function verdictCopy(score, tier, constraint) {
  const c = CONSTRAINT_LABELS[constraint] || constraint || 'an unspecified dimension';
  if (!score) return 'Score your channel to generate your commercial audit.';
  if (score >= 75) return 'Your channel is A tier — commercially established and ready for premium brand deals.';
  if (score >= 50) return `Your channel is B tier — ${c} is the main rate limiter right now.`;
  if (score >= 25) return `Your channel is C tier — ${c} is the primary barrier to brand deals.`;
  return `Your channel is D tier — ${c} needs significant work before brands will engage.`;
}

// ─── Components ───────────────────────────────────────────────────────────────

function ScoreBar({ score }) {
  const pct = Math.min(100, Math.max(0, score ?? 0));
  const color = score >= 60 ? 'var(--cb-mint-deep)' : score >= 40 ? 'var(--cb-lavender)' : 'var(--cb-peach)';
  return (
    <div className={styles.barTrack}>
      <div className={styles.barFill} style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function DimensionRow({ dimKey, dim }) {
  const label = DIM_LABELS[dimKey] || dimKey;
  const state = dim?.state ?? 'constraining';
  const score = dim?.score ?? null;
  const meta  = STATE_META[state] || STATE_META.constraining;
  const copy  = (STATE_COPY[state] || STATE_COPY.constraining)(label);

  return (
    <div className={styles.dimRow}>
      <div className={styles.dimTop}>
        <span className={styles.dimLabel}>{label}</span>
        <div className={styles.dimRight}>
          <span className={styles.dimScore}>{score ?? '—'}</span>
          <span className={styles.dimBadge} style={{ background: `${meta.color}22`, color: meta.color }}>{meta.label}</span>
        </div>
      </div>
      <ScoreBar score={score} />
      <p className={styles.dimCopy}>{copy}</p>
    </div>
  );
}

function MilestoneStepper({ milestones }) {
  const crossedCount = milestones.filter(m => m.status === 'crossed').length;
  return (
    <div className={styles.stepper}>
      {milestones.map((m, i) => {
        const isCrossed  = m.status === 'crossed';
        const isCurrent  = !isCrossed && milestones[i - 1]?.status === 'crossed';
        const label = MILESTONE_LABELS[m.type] || m.type;
        return (
          <div key={m.type} className={`${styles.stepItem} ${isCrossed ? styles.stepDone : ''} ${isCurrent ? styles.stepCurrent : ''}`}>
            <div className={styles.stepDot}>
              {isCrossed && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              {isCurrent && <div className={styles.stepDotInner} />}
            </div>
            {i < milestones.length - 1 && (
              <div className={`${styles.stepLine} ${isCrossed ? styles.stepLineDone : ''}`} />
            )}
            <span className={styles.stepLabel}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function PriorityAction({ action }) {
  if (!action) {
    return (
      <div className={styles.noAction}>
        <p>No active recommendation. Re-score your channel to generate your current priority action.</p>
        <Link to="/dashboard" className={styles.noActionLink}>Go to dashboard</Link>
      </div>
    );
  }
  const timeLabel = TIME_LABELS[action.timeHorizon] || action.timeHorizon;
  return (
    <div className={styles.actionCard}>
      <div className={styles.actionHeader}>
        <span className={styles.actionTitle}>{action.title}</span>
        {timeLabel && <span className={styles.actionTime}>{timeLabel}</span>}
      </div>
      <p className={styles.actionWhat}>{action.specificAction}</p>
      {action.reasoning && (
        <div className={styles.actionWhy}>
          <span className={styles.actionWhyLabel}>Why this matters</span>
          <p>{action.reasoning}</p>
        </div>
      )}
      {action.expectedImpact && (
        <p className={styles.actionImpact}>{action.expectedImpact}</p>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function AuditPage() {
  const [audit, setAudit] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    api.get('/audit')
      .then(d => { setAudit(d.audit); setStatus(d.status); })
      .catch(() => setStatus('error'));
  }, []);

  return (
    <AppLayout>
      <UpgradeGate
        requiredTier="core"
        feature="Commercial Audit"
        description="The Commercial Audit is a dimensional breakdown of your channel's brand deal readiness — six dimensions, your primary blocker, and the one action that moves your score fastest."
      >
        <AuditContent audit={audit} status={status} />
      </UpgradeGate>
    </AppLayout>
  );
}

function AuditContent({ audit, status }) {
  if (status === 'loading') return <div className={styles.loading}>Loading your audit...</div>;
  if (status === 'error')   return <div className={styles.loading}>Failed to load audit. Please try again.</div>;
  if (status === 'no_creator') return <div className={styles.loading}>Connect your YouTube channel to generate your audit.</div>;
  if (status === 'no_score' || !audit) {
    return (
      <div className={styles.empty}>
        <h2>No score data yet</h2>
        <p>Score your channel to generate your commercial audit.</p>
        <Link to="/dashboard" className={styles.emptyLink}>Score my channel</Link>
      </div>
    );
  }

  const tierMeta = TIER_META[audit.tier] || TIER_META.emerging;
  const dims     = audit.dimensions || {};
  const constraint = audit.primaryConstraint;
  const constraintDim = constraint ? dims[constraint] : null;

  return (
    <div className={styles.report}>

      {/* ── 1. Verdict ── */}
      <header className={styles.verdict}>
        <div className={styles.verdictLeft}>
          <div className={styles.scoreWrap}>
            <span className={styles.score}>{audit.score ?? '—'}</span>
            <span className={styles.scoreLabel}>Commercial Viability Score</span>
          </div>
          <div className={styles.verdictMeta}>
            <span className={styles.tierBadge} style={{ background: tierMeta.bg, color: tierMeta.text }}>{tierMeta.label}</span>
            {audit.confidence && <span className={styles.conf}>{audit.confidence} confidence</span>}
          </div>
          <p className={styles.verdictCopy}>{verdictCopy(audit.score, audit.tier, constraint)}</p>
        </div>
        {audit.lastCalculated && (
          <span className={styles.lastScored}>
            Last scored: {new Date(audit.lastCalculated).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        )}
      </header>

      {/* ── 2. Dimension teardown ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Commercial dimension breakdown</h2>
        <p className={styles.sectionSub}>vidIQ tells you your video is not getting views. This tells you your channel is not getting paid.</p>
        <div className={styles.dims}>
          {DIM_ORDER.map(key => (
            <DimensionRow key={key} dimKey={key} dim={dims[key]} />
          ))}
        </div>
      </section>

      {/* ── 3. Primary blocker ── */}
      {constraint && constraintDim && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>What's blocking you</h2>
          <div className={styles.blockerCard}>
            <div className={styles.blockerHeader}>
              <span className={styles.blockerDim}>{DIM_LABELS[constraint] || constraint}</span>
              <span className={styles.blockerScore}>{constraintDim.score ?? '—'} / 100</span>
            </div>
            <p className={styles.blockerCopy}>
              {constraintDim.state === 'critical'
                ? `This dimension is your most urgent commercial problem. Brands actively screen out channels where ${CONSTRAINT_LABELS[constraint] || constraint} is this low.`
                : `This dimension is your primary rate limiter. Improving it will have the largest single impact on your brand deal potential.`}
            </p>
            {audit.gapToNextTier && (
              <div className={styles.gapRow}>
                <span className={styles.gapLabel}>Points to next tier</span>
                <span className={styles.gapVal}>{audit.gapToNextTier.pointsNeeded ?? '—'}</span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── 4. Milestones ── */}
      {audit.milestones?.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Commercial milestone progress</h2>
          <MilestoneStepper milestones={audit.milestones} />
        </section>
      )}

      {/* ── 5. Priority action ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Priority action</h2>
        <PriorityAction action={audit.priorityAction} />
      </section>

      {/* ── 6. Rate context ── */}
      {audit.rateEstimate && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Your rate context</h2>
          <div className={styles.rateCard}>
            <div className={styles.rateRange}>
              <span className={styles.rateCurrency}>{audit.rateEstimate.currency === 'USD' ? '$' : '£'}</span>
              <span className={styles.rateNum}>{audit.rateEstimate.low.toLocaleString()}</span>
              <span className={styles.rateSep}>–</span>
              <span className={styles.rateNum}>{audit.rateEstimate.high.toLocaleString()}</span>
            </div>
            <p className={styles.rateLabel}>Estimated rate range for an integrated sponsorship on your channel, based on your tier and niche.</p>
            {audit.rateEstimate.confidence && (
              <span className={styles.rateConf}>{audit.rateEstimate.confidence} confidence</span>
            )}
          </div>
        </section>
      )}

    </div>
  );
}
