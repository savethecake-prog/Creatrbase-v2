import styles from './Input.module.css';

export function Input({ label, error, id, className = '', ...props }) {
  return (
    <div className={styles.group}>
      {label && (
        <label className={styles.label} htmlFor={id}>
          {label}
        </label>
      )}
      <input
        id={id}
        className={[styles.input, error ? styles.error : '', className].filter(Boolean).join(' ')}
        {...props}
      />
      {error && <span className={styles.errorMsg}>{error}</span>}
    </div>
  );
}
