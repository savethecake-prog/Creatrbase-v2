import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../../layouts/AppLayout/AppLayout';
import { Button } from '../../components/ui/Button/Button';
import { Badge } from '../../components/ui/Badge/Badge';
import { api } from '../../lib/api';
import styles from './Tasks.module.css';

const FEEDBACK_OPTIONS = [
  { value: 'helpful',       label: 'Helpful' },
  { value: 'already_doing', label: 'Already doing this' },
  { value: 'not_relevant',  label: 'Not relevant' },
  { value: 'not_possible',  label: "Can't do this" },
];

const PRIORITY_VARIANT = { high: 'error', medium: 'peach', low: 'lavender' };
const DIMENSION_LABEL  = d => d?.replace(/_/g, ' ') ?? '';

function TaskCard({ task, onComplete, onDismiss }) {
  const [expanded, setExpanded] = useState(false);
  const [acting, setActing]     = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [showFeedback, setShowFeedback] = useState(null); // 'complete' | 'dismiss'

  const isDone      = task.status === 'completed';
  const isDismissed = task.status === 'dismissed';
  const isInactive  = isDone || isDismissed;

  async function handleAction(action) {
    setActing(true);
    try {
      await (action === 'complete'
        ? onComplete(task.id, feedback)
        : onDismiss(task.id, feedback));
    } finally {
      setActing(false);
      setShowFeedback(null);
      setFeedback(null);
    }
  }

  return (
    <div className={[styles.card, isInactive ? styles.cardInactive : ''].filter(Boolean).join(' ')}>
      <div className={styles.cardTop}>
        <div className={styles.cardBadges}>
          {task.dimension && (
            <Badge variant="peach">{DIMENSION_LABEL(task.dimension)}</Badge>
          )}
          {task.priority && (
            <Badge variant={PRIORITY_VARIANT[task.priority] ?? 'lavender'}>
              {task.priority}
            </Badge>
          )}
          {isDone      && <Badge variant="mint">completed</Badge>}
          {isDismissed && <Badge variant="lavender">dismissed</Badge>}
        </div>
      </div>

      <p className={styles.cardTitle}>{task.title}</p>
      <p className={styles.cardDesc}>{task.description}</p>

      {task.reasoning_summary && (
        <p
          className={styles.cardReasoning}
          style={{ display: expanded ? 'block' : undefined }}
        >
          {task.reasoning_summary}
        </p>
      )}

      {(task.reasoning_summary || task.expected_impact) && !expanded && (
        <button className={styles.expandBtn} onClick={() => setExpanded(true)}>
          Show more
        </button>
      )}

      {expanded && task.expected_impact && (
        <p className={styles.cardImpact}>
          <span className={styles.cardImpactLabel}>Expected impact</span>
          {task.expected_impact}
        </p>
      )}

      {!isInactive && showFeedback && (
        <div className={styles.feedbackRow}>
          <p className={styles.feedbackPrompt}>
            {showFeedback === 'complete' ? 'How was this task?' : 'Why dismiss?'}
            <span className={styles.feedbackOptional}>(optional)</span>
          </p>
          <div className={styles.feedbackOptions}>
            {FEEDBACK_OPTIONS.map(opt => (
              <button
                key={opt.value}
                className={[
                  styles.feedbackBtn,
                  feedback === opt.value ? styles.feedbackBtnActive : '',
                ].filter(Boolean).join(' ')}
                onClick={() => setFeedback(prev => prev === opt.value ? null : opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className={styles.feedbackActions}>
            <Button
              size="sm"
              onClick={() => handleAction(showFeedback)}
              disabled={acting}
            >
              {showFeedback === 'complete' ? 'Mark complete' : 'Dismiss'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setShowFeedback(null); setFeedback(null); }}
              disabled={acting}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {!isInactive && !showFeedback && (
        <div className={styles.cardActions}>
          <Button size="sm" onClick={() => setShowFeedback('complete')}>
            Done
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowFeedback('dismiss')}>
            Dismiss
          </Button>
        </div>
      )}
    </div>
  );
}

export function Tasks() {
  const [data, setData]       = useState(null);  // { tasks, status }
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/creator/tasks')
      .then(setData)
      .catch(() => setData({ tasks: [], status: 'error' }))
      .finally(() => setLoading(false));
  }, []);

  async function handleComplete(taskId, feedback) {
    await api.patch(`/creator/tasks/${taskId}`, { action: 'complete', feedback });
    setData(prev => prev ? {
      ...prev,
      tasks: prev.tasks.map(t =>
        t.id === taskId ? { ...t, status: 'completed', completed_at: new Date().toISOString() } : t
      ),
    } : prev);
  }

  async function handleDismiss(taskId, feedback) {
    await api.patch(`/creator/tasks/${taskId}`, { action: 'dismiss', feedback });
    setData(prev => prev ? {
      ...prev,
      tasks: prev.tasks.map(t =>
        t.id === taskId ? { ...t, status: 'dismissed', dismissed_at: new Date().toISOString() } : t
      ),
    } : prev);
  }

  const active    = data?.tasks.filter(t => t.status === 'active' || t.status === 'snoozed') ?? [];
  const completed = data?.tasks.filter(t => t.status === 'completed' || t.status === 'dismissed') ?? [];

  return (
    <AppLayout>
      <div className={styles.header}>
        <h1 className={styles.title}>Tasks</h1>
        {active.length > 0 && (
          <span className={styles.countBadge}>{active.length} active</span>
        )}
      </div>

      {loading && (
        <p className={styles.loadingHint}>Loading tasks…</p>
      )}

      {!loading && active.length === 0 && completed.length === 0 && (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>No active tasks</p>
          <p className={styles.emptyDesc}>
            When you accept a recommendation from your Dashboard, it appears here as a task.
          </p>
          <Link to="/dashboard">
            <Button variant="secondary" size="sm">Go to Dashboard</Button>
          </Link>
        </div>
      )}

      {!loading && active.length === 0 && completed.length > 0 && (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>All caught up</p>
          <p className={styles.emptyDesc}>
            No active tasks. Your next task will appear after your next sync.
          </p>
        </div>
      )}

      {active.length > 0 && (
        <section className={styles.section}>
          <p className={styles.sectionTitle}>Active</p>
          <div className={styles.taskList}>
            {active.map(t => (
              <TaskCard
                key={t.id}
                task={t}
                onComplete={handleComplete}
                onDismiss={handleDismiss}
              />
            ))}
          </div>
        </section>
      )}

      {completed.length > 0 && (
        <section className={styles.section}>
          <p className={styles.sectionTitle}>Recent</p>
          <div className={styles.taskList}>
            {completed.map(t => (
              <TaskCard
                key={t.id}
                task={t}
                onComplete={handleComplete}
                onDismiss={handleDismiss}
              />
            ))}
          </div>
        </section>
      )}
    </AppLayout>
  );
}
