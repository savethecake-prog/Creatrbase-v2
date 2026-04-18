import { Link } from 'react-router-dom';
import styles from './AuthLayout.module.css';

export function AuthLayout({ children, title, subtitle, eyebrow }) {
  return (
    <div className={styles.layout}>
      {/* Form Panel */}
      <div className={`${styles.panel} ${styles.formPanel}`}>
        <div className={styles.formWrap}>
          <Link to="/" className={styles.logoLink}>
            <img src="/brand/wordmark-dark.png" alt="Creatrbase" className={styles.logo} />
          </Link>
          {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
          <h1 className={styles.formTitle}>{title}</h1>
          {subtitle && <p className={styles.formSub}>{subtitle}</p>}
          {children}
        </div>
      </div>

      {/* Brand Panel */}
      <div className={`${styles.panel} ${styles.brandPanel}`}>
        <div className={styles.brandGlow} />
        <div className={styles.brandContent}>
          <span className={styles.brandEyebrow}>For independent creators</span>
          <p className={styles.brandTagline}>Know where you stand with brands.</p>
          <p className={styles.brandSub}>
            Your Commercial Viability Score across six dimensions brands actually evaluate. Built for independent creators on YouTube and Twitch.
          </p>
          <div className={styles.brandDivider} />
          <div className={styles.brandStats}>
            <div className={styles.brandStat}>
              <span className={styles.brandStatNum}>2,147</span>
              <span className={styles.brandStatLabel}>Creators scored this month</span>
            </div>
            <div className={styles.brandStat}>
              <span className={styles.brandStatNum}>{'\u00A3'}0</span>
              <span className={styles.brandStatLabel}>Free tier, forever</span>
            </div>
            <div className={styles.brandStat}>
              <span className={styles.brandStatNum}>~45s</span>
              <span className={styles.brandStatLabel}>To score your channel</span>
            </div>
          </div>
          <p className={styles.brandAttribution}>Built in the UK</p>
        </div>
      </div>
    </div>
  );
}
