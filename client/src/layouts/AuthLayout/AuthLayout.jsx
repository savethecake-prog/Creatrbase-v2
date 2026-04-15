import { Link } from 'react-router-dom';
import { LogoWordmark } from '../../components/ui/LogoWordmark';
import styles from './AuthLayout.module.css';

export function AuthLayout({ children, title, subtitle }) {
  return (
    <div className={styles.layout}>
      {/* Form Panel */}
      <div className={`${styles.panel} ${styles.formPanel}`}>
        <div className={styles.formWrap}>
          <Link to="/">
            <LogoWordmark className={styles.logoWordmark} />
          </Link>
          <h1 className={styles.formTitle}>{title}</h1>
          {subtitle && <p className={styles.formSub}>{subtitle}</p>}
          {children}
        </div>
      </div>

      {/* Brand Panel */}
      <div className={`${styles.panel} ${styles.brandPanel}`}>
        <div className={styles.brandContent}>
          <p className={styles.brandTagline}>
            Know your<br />worth.<br /><em>Bag the brand.</em>
          </p>
          <p className={styles.brandSub}>
            The gap between you and your first brand deal isn't a mystery. Creatrbase shows you the exact number, the path, and the brands waiting on the other side.
          </p>
          <div className={styles.brandStats}>
            <div className={styles.brandStat}>
              <span className={styles.brandStatNum}>2k+</span>
              <span className={styles.brandStatLabel}>Creators</span>
            </div>
            <div className={styles.brandStat}>
              <span className={styles.brandStatNum}>£0</span>
              <span className={styles.brandStatLabel}>Commission</span>
            </div>
            <div className={styles.brandStat}>
              <span className={styles.brandStatNum}>14d</span>
              <span className={styles.brandStatLabel}>Free Trial</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
