import styles from './Card.module.css';

export function Card({ children, hover = false, className = '', ...props }) {
  const classes = [
    styles.card,
    hover ? styles.hover : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}
