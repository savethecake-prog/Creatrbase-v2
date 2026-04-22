import styles from './PageLoader.module.css';

export function PageLoader() {
  return (
    <div className={styles.wrap}>
      <div className={styles.spinner} />
    </div>
  );
}
