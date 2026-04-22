import styles from './Table.module.css';

/**
 * Table — data table component.
 * Props:
 *   columns      — [{ key, label, render?(row) → ReactNode, align?: 'left'|'right'|'center' }]
 *   data         — array of row objects
 *   keyField     — field name to use as row key (default 'id')
 *   emptyMessage — displayed when data is empty
 *   loading      — show skeleton rows when true
 *   className    — optional extra class on the outer wrapper
 */
export function Table({
  columns,
  data,
  keyField = 'id',
  emptyMessage = 'No results.',
  loading = false,
  className = '',
}) {
  return (
    <div className={`${styles.wrap} ${className}`}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                className={`${styles.th} ${col.align === 'right' ? styles.right : col.align === 'center' ? styles.center : ''}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <tr key={i} className={styles.skeletonRow}>
                {columns.map(col => (
                  <td key={col.key} className={styles.td}>
                    <div className={styles.skeleton} />
                  </td>
                ))}
              </tr>
            ))
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className={styles.empty}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr key={row[keyField] ?? i} className={styles.row}>
                {columns.map(col => (
                  <td
                    key={col.key}
                    className={`${styles.td} ${col.align === 'right' ? styles.right : col.align === 'center' ? styles.center : ''}`}
                  >
                    {col.render ? col.render(row) : row[col.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
