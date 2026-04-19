import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import styles from './Content.module.css';

const TYPES = [
  { key: 'all',        label: 'All' },
  { key: 'blog',       label: 'Blog' },
  { key: 'comparison', label: 'Comparison' },
  { key: 'niche',      label: 'Niche' },
  { key: 'threshold',  label: 'Threshold' },
  { key: 'research',   label: 'Research' },
];

const TYPE_LABELS = {
  blog:       'Blog',
  comparison: 'Comparison',
  niche:      'Niche',
  threshold:  'Threshold',
  research:   'Research',
};

function TypeBadge({ type }) {
  return <span className={`${styles.typeBadge} ${styles[`type_${type}`]}`}>{TYPE_LABELS[type] || type}</span>;
}

function StatusBadge({ status }) {
  return (
    <span className={`${styles.statusBadge} ${status === 'published' ? styles.statusPublished : styles.statusDraft}`}>
      <span className={styles.statusDot} />
      {status === 'published' ? 'Published' : 'Draft'}
    </span>
  );
}

function timeAgo(iso) {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

// ─── New Content Modal ────────────────────────────────────────────────────────

function NewContentModal({ onClose, onStart }) {
  const [selected, setSelected] = useState('blog');
  const [starting, setStarting] = useState(false);

  async function handleStart() {
    setStarting(true);
    await onStart(selected);
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>New Content</h2>
        <p className={styles.modalSub}>Choose a content type to start a drafting session.</p>
        <div className={styles.typeGrid}>
          {TYPES.filter(t => t.key !== 'all').map(t => (
            <button
              key={t.key}
              className={`${styles.typeOption} ${selected === t.key ? styles.typeOptionSelected : ''}`}
              onClick={() => setSelected(t.key)}
            >
              <span className={`${styles.typeOptionDot} ${styles[`type_${t.key}`]}`} />
              <span className={styles.typeOptionLabel}>{t.label}</span>
              <span className={styles.typeOptionDesc}>{TYPE_DESCS[t.key]}</span>
            </button>
          ))}
        </div>
        <div className={styles.modalActions}>
          <button className={styles.btnGhost} onClick={onClose}>Cancel</button>
          <button className={styles.btnPrimary} onClick={handleStart} disabled={starting}>
            {starting ? 'Starting...' : `Start ${TYPE_LABELS[selected]} session`}
          </button>
        </div>
      </div>
    </div>
  );
}

const TYPE_DESCS = {
  blog:       'Article with H2 structure, internal links, SEO metadata',
  comparison: 'Side-by-side competitor comparison with feature table',
  niche:      'CPM data-driven page for a specific creator niche',
  threshold:  'Metric explanation page (e.g. "10k subscribers")',
  research:   'Structured report with key findings and methodology',
};

// ─── Main page ────────────────────────────────────────────────────────────────

export function Content() {
  const navigate = useNavigate();
  const [activeType, setActiveType] = useState('all');
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [offset, setOffset] = useState(0);
  const searchTimer = useRef(null);
  const LIMIT = 50;

  const fetchContent = useCallback(async (type, q, off) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: LIMIT, offset: off });
      if (type !== 'all') params.set('type', type);
      if (q) params.set('search', q);
      const data = await api(`/api/admin/content?${params}`);
      setItems(data.items || []);
      setTotal(data.items?.length || 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContent(activeType, search, offset);
  }, [activeType, offset, fetchContent]);

  function handleSearchChange(e) {
    const val = e.target.value;
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setOffset(0);
      fetchContent(activeType, val, 0);
    }, 300);
  }

  function handleTabChange(key) {
    setActiveType(key);
    setOffset(0);
    setSearch('');
  }

  async function handleNewSession(contentType) {
    try {
      const data = await api('/api/admin/content/session/start', {
        method: 'POST',
        body: JSON.stringify({ content_type: contentType }),
      });
      navigate(`/admin/content/session/${data.sessionId}`, { state: { brief: data.brief, contentType } });
    } catch (err) {
      console.error(err);
    }
  }

  async function handleEditSession(item) {
    try {
      const data = await api('/api/admin/content/session/start', {
        method: 'POST',
        body: JSON.stringify({ content_type: item.type, content_id: item.id }),
      });
      navigate(`/admin/content/session/${data.sessionId}`, {
        state: { brief: data.brief, contentType: item.type, editingTitle: item.title },
      });
    } catch (err) {
      console.error(err);
    }
  }

  const published = items.filter(i => i.status === 'published').length;
  const drafts = items.filter(i => i.status !== 'published').length;

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Content Studio</h1>
          <p className={styles.subtitle}>AI-assisted drafting and publishing for all content types.</p>
        </div>
        <button className={styles.btnPrimary} onClick={() => setShowNew(true)}>New content</button>
      </div>

      {/* Stats strip */}
      <div className={styles.statsStrip}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{published}</span>
          <span className={styles.statLabel}>Published</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.stat}>
          <span className={styles.statValue}>{drafts}</span>
          <span className={styles.statLabel}>Drafts</span>
        </div>
      </div>

      {/* Tabs + toolbar */}
      <div className={styles.tabBar}>
        {TYPES.map(t => (
          <button
            key={t.key}
            className={`${styles.tab} ${activeType === t.key ? styles.tabActive : ''}`}
            onClick={() => handleTabChange(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>⌕</span>
          <input
            type="text"
            placeholder="Search by title..."
            value={search}
            onChange={handleSearchChange}
            className={styles.searchInput}
          />
        </div>
        <span className={styles.countLabel}>
          {loading ? '...' : `${items.length} item${items.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Table */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.thTitle}>Title</th>
              <th className={styles.thType}>Type</th>
              <th className={styles.thStatus}>Status</th>
              <th className={styles.thDate}>Updated</th>
              <th className={styles.thActions}></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className={styles.loadingRow}>Loading...</td></tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={5} className={styles.emptyRow}>
                  <div className={styles.emptyState}>
                    <p className={styles.emptyTitle}>No content yet</p>
                    <p className={styles.emptySub}>
                      {activeType === 'all'
                        ? 'Start a drafting session to create your first piece.'
                        : `No ${TYPE_LABELS[activeType]?.toLowerCase()} content yet.`}
                    </p>
                    <button className={styles.btnPrimary} onClick={() => setShowNew(true)}>
                      New content
                    </button>
                  </div>
                </td>
              </tr>
            )}
            {!loading && items.map(item => (
              <tr key={`${item.type}-${item.id}`} className={styles.row}>
                <td className={styles.tdTitle}>
                  <span className={styles.itemTitle}>{item.title || 'Untitled'}</span>
                  {item.url && item.status === 'published' && (
                    <a href={item.url} target="_blank" rel="noreferrer" className={styles.itemUrl}>
                      {item.url}
                    </a>
                  )}
                </td>
                <td className={styles.tdType}><TypeBadge type={item.type} /></td>
                <td className={styles.tdStatus}><StatusBadge status={item.status} /></td>
                <td className={styles.tdDate}>{timeAgo(item.updatedAt)}</td>
                <td className={styles.tdActions}>
                  <button
                    className={styles.btnRowEdit}
                    onClick={() => handleEditSession(item)}
                    title="Open editing session"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {items.length === LIMIT && (
          <div className={styles.pagination}>
            {offset > 0 && (
              <button className={styles.btnGhost} onClick={() => setOffset(o => o - LIMIT)}>Previous</button>
            )}
            <button className={styles.btnGhost} onClick={() => setOffset(o => o + LIMIT)}>Next</button>
          </div>
        )}
      </div>

      {showNew && (
        <NewContentModal
          onClose={() => setShowNew(false)}
          onStart={async (type) => {
            setShowNew(false);
            await handleNewSession(type);
          }}
        />
      )}
    </div>
  );
}
