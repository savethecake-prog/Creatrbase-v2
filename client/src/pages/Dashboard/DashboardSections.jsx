// Commercial viability score section and weekly task/recommendation section
import { Badge } from '../../components/ui/Badge/Badge';
import { Button } from '../../components/ui/Button/Button';
import { HintCallout } from '../../components/ui/HintCallout/HintCallout';
import { ScoreCardModal } from '../../components/ScoreCard/ScoreCard';
import { tierMedium } from '../../lib/tierGrades';
import { ScoreChart, WeeklyProgressSnapshot } from './DashboardCharts';
import styles from './Dashboard.module.css';

// ─── Commercial Viability Score section ──────────────────────────────────────

export function DashboardScore({ scoreData, history, progress, showScoreCard, onToggleScoreCard, platforms, niche }) {
  if (!scoreData || scoreData.status !== 'ready' || !scoreData.score) return null;

  return (
    <>
      <div className={styles.scoreSection}>
        <p className={styles.sectionTitle}>Commercial Viability</p>
        <HintCallout
          storageKey="cb_hint_score_v1"
          eyebrow="How your score works"
          heading="Four tiers. Each one unlocks more."
        >
          D tier (0–24) builds the foundation. C tier (25–49) opens gifting and early outreach. B tier (50–74) unlocks paid integrations and rate negotiation. A tier (75+) puts you in front of agencies. Your score updates after every sync.
        </HintCallout>
        <div className={styles.scoreCard}>
          <div className={styles.scoreMain}>
            <div className={styles.scoreCircle}>
              <span className={styles.scoreNumber}>{scoreData.score.overall ?? '—'}</span>
              <span className={styles.scoreLabel}>/ 100</span>
            </div>
            <div className={styles.scoreMeta}>
              <p className={styles.scoreTier}>
                {scoreData.score.tier ? tierMedium(scoreData.score.tier) : 'Calculating…'}
              </p>
              <Badge variant={
                scoreData.score.confidence === 'high'   ? 'mint' :
                scoreData.score.confidence === 'medium' ? 'peach' : 'error'
              }>
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
                        width:   dim.score != null ? `${dim.score}%` : '0%',
                        opacity: dim.confidence === 'insufficient_data' ? 0.25 : 1,
                      }}
                    />
                  </div>
                  <span className={styles.dimScore}>{dim.score != null ? dim.score : '—'}</span>
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
                <span className={styles.milestoneLabel}>{ms.type.replace(/_/g, ' ')}</span>
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

        <WeeklyProgressSnapshot progress={progress} />

        <button className={styles.shareScoreBtn} onClick={onToggleScoreCard}>
          Share your score →
        </button>
      </div>

      {showScoreCard && (
        <ScoreCardModal
          score={scoreData.score}
          niche={niche?.niche}
          platform={platforms.find(p => p.platform === 'youtube')?.platform_display_name}
          onClose={onToggleScoreCard}
        />
      )}
    </>
  );
}

// ─── Weekly task / recommendation section ─────────────────────────────────────

export function DashboardRec({ recData, recResponding, onRespond }) {
  if (!recData || recData.status === 'no_creator') return null;

  function RecBadges({ rec }) {
    return (
      <div className={styles.recBadges}>
        <Badge variant="peach">{rec.constraint_dimension?.replace(/_/g, ' ')}</Badge>
        {rec.constraint_severity && (
          <Badge variant={rec.constraint_severity === 'critical' ? 'error' : 'lavender'}>
            {rec.constraint_severity}
          </Badge>
        )}
        {rec.expected_impact_confidence && (
          <Badge variant={
            rec.expected_impact_confidence === 'high'   ? 'mint' :
            rec.expected_impact_confidence === 'medium' ? 'peach' : 'lavender'
          }>
            {rec.expected_impact_confidence} confidence
          </Badge>
        )}
      </div>
    );
  }

  return (
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
          <div className={styles.recHeader}><RecBadges rec={recData.recommendation} /></div>
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
            <Button size="sm" onClick={() => onRespond(recData.recommendation.id, 'accepted')} disabled={recResponding}>
              Add to my tasks
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onRespond(recData.recommendation.id, 'deferred')} disabled={recResponding}>
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
              <RecBadges rec={recData.recommendation} />
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
  );
}
