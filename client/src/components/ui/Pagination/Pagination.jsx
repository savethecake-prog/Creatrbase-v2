import styles from './Pagination.module.css';

/**
 * Pagination
 * Props:
 *   page       — current page (1-indexed)
 *   totalPages — total number of pages
 *   onChange   — (newPage: number) => void
 *   siblingCount — how many page buttons either side of current (default 1)
 */
export function Pagination({ page, totalPages, onChange, siblingCount = 1 }) {
  if (totalPages <= 1) return null;

  function buildRange(from, to) {
    const range = [];
    for (let i = from; i <= to; i++) range.push(i);
    return range;
  }

  // Build visible page numbers with ellipsis markers
  function getPages() {
    const total  = totalPages;
    const left   = Math.max(2, page - siblingCount);
    const right  = Math.min(total - 1, page + siblingCount);
    const pages  = [];

    pages.push(1);
    if (left > 2)       pages.push('...');
    pages.push(...buildRange(left, right));
    if (right < total - 1) pages.push('...');
    if (total > 1) pages.push(total);

    return pages;
  }

  const pages = getPages();

  return (
    <nav className={styles.nav} aria-label="Pagination">
      <button
        className={`${styles.btn} ${styles.arrow}`}
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
      >
        ←
      </button>

      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`ellipsis-${i}`} className={styles.ellipsis}>…</span>
        ) : (
          <button
            key={p}
            className={`${styles.btn} ${p === page ? styles.active : ''}`}
            onClick={() => p !== page && onChange(p)}
            aria-label={`Page ${p}`}
            aria-current={p === page ? 'page' : undefined}
          >
            {p}
          </button>
        )
      )}

      <button
        className={`${styles.btn} ${styles.arrow}`}
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="Next page"
      >
        →
      </button>
    </nav>
  );
}
