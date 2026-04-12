import { AppLayout } from '../../layouts/AppLayout/AppLayout';
import { Button } from '../../components/ui/Button/Button';
import { Badge } from '../../components/ui/Badge/Badge';
import { useAuth } from '../../lib/AuthContext';
import { api } from '../../lib/api';
import styles from './Dashboard.module.css';

const COMING_SOON = [
  {
    title: 'Gap Tracker',
    desc: 'See exactly how far you are from each monetisation threshold, with velocity and projection.',
  },
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
  const isActive    = sub?.status === 'active';

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

      <div className={styles.header}>
        <h1 className={styles.greeting}>
          Hey, <span>{firstName}</span>.
        </h1>
        <p className={styles.sub}>Connect your platforms to get started.</p>
      </div>

      <div className={styles.connectBanner}>
        <div className={styles.connectText}>
          <p className={styles.connectTitle}>Connect YouTube or Twitch</p>
          <p className={styles.connectDesc}>
            Creatrbase needs access to your channel metrics to calculate your commercial viability score,
            track your gap to monetisation thresholds, and generate your weekly tasks.
          </p>
        </div>
        <div className={styles.connectActions}>
          <Button variant="primary">Connect YouTube</Button>
          <Button variant="ghost">Connect Twitch</Button>
        </div>
      </div>

      <p className={styles.sectionTitle}>Your Metrics</p>
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <p className={styles.kpiLabel}>Subscribers</p>
          <p className={styles.kpiEmpty}>—</p>
          <p className={styles.kpiHint}>Connect YouTube to see this</p>
        </div>
        <div className={styles.kpiCard}>
          <p className={styles.kpiLabel}>Watch Hours (12m)</p>
          <p className={styles.kpiEmpty}>—</p>
          <p className={styles.kpiHint}>Connect YouTube to see this</p>
        </div>
        <div className={styles.kpiCard}>
          <p className={styles.kpiLabel}>Viability Score</p>
          <p className={styles.kpiEmpty}>—</p>
          <p className={styles.kpiHint}>Calculated after first sync</p>
        </div>
      </div>

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
