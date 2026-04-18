import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import styles from './UpgradeGate.module.css';

const TIER_ORDER = { free: 0, core: 1, pro: 2 };

const TIER_DETAILS = {
  core: { label: 'Core', price: '9.99' },
  pro:  { label: 'Pro',  price: '19.99' },
};

/**
 * Wraps a paid feature. If user's tier is below requiredTier,
 * shows an upgrade prompt instead of children.
 *
 * Usage: <UpgradeGate requiredTier="core" feature="Task engine" description="...">
 *          <TaskList />
 *        </UpgradeGate>
 */
export function UpgradeGate({ requiredTier, feature, description, children }) {
  const { user } = useAuth();
  const currentTier = user?.tier || 'free';

  if ((TIER_ORDER[currentTier] || 0) >= (TIER_ORDER[requiredTier] || 0)) {
    return children;
  }

  const details = TIER_DETAILS[requiredTier] || TIER_DETAILS.core;

  return (
    <div className={styles.gate}>
      <div className={styles.icon}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <h3 className={styles.feature}>{feature}</h3>
      <p className={styles.desc}>{description}</p>
      <Link to="/pricing" className={styles.btn}>
        Upgrade to {details.label} ({'\u00A3'}{details.price}/mo)
      </Link>
    </div>
  );
}
