import styles from './Button.module.css';

export function Button({
  children,
  variant = 'primary',
  size,
  full = false,
  as: Tag = 'button',
  className = '',
  ...props
}) {
  const classes = [
    styles.btn,
    styles[variant],
    size ? styles[size] : '',
    full ? styles.full : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <Tag className={classes} {...props}>
      {children}
    </Tag>
  );
}
