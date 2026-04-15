import { LogoWordmark } from '../../components/ui/LogoWordmark';
import styles from './AuthLayout.module.css';

export function AuthLayout({ children, title, subtitle }) {
  return (
    <div className={styles.layout}>
      <div className={`${styles.panel} ${styles.formPanel}`}>
        <div className={styles.formWrap}>
          <LogoWordmark className={styles.logoWordmark} />
          <h1 className={styles.formTitle}>{title}</h1>
          {subtitle && <p className={styles.formSub}>{subtitle}</p>}
          {children}
        </div>
      </div>

      <div className={`${styles.panel} ${styles.brandPanel}`}>
        <div className={styles.brandContent}>
          <p className={styles.brandTagline}>
            Know exactly<br />where you <span>stand.</span>
          </p>
          <p className={styles.brandSub}>
            The gap between you and commercial viability isn't a mystery.
            Creatrbase shows you the number, the path, and the brands waiting on the other side.
          </p>
        </div>
      </div>
    </div>
  );
}
