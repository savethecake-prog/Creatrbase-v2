import styles from './Badge.module.css';

export function Badge({ children, variant = 'mint', dot = false, className = '' }) {
  const classes = [
    styles.badge,
    styles[variant],
    dot ? styles.dot : '',
    className,
  ].filter(Boolean).join(' ');

  return <span className={classes}>{children}</span>;
}
