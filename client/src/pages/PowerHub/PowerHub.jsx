import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../../layouts/AppLayout/AppLayout';
import { useAuth } from '../../lib/AuthContext';
import { api } from '../../lib/api';
import styles from './PowerHub.module.css';

const STATUS_META = {
  building: { label: 'Currently building',  color: 'mint',   votable: true  },
  thinking: { label: 'On the thinking list', color: 'lavender', votable: true  },
  testing:  { label: 'In testing',           color: 'peach',  votable: false },
  shipped:  { label: 'Shipped',              color: 'grey',   votable: false },
};

const STATUS_ORDER = ['building', 'thinking', 'testing', 'shipped'];

function VoteButton({ item, onVote }) {
  const meta = STATUS_META[item.status];
  if (!meta.votable) return null;

  return (
    <button
      type="button"
      className={`${styles.voteBtn} ${item.user_voted ? styles.voteBtnActive : ''}`}
      onClick={() => onVote(item.id)}
      aria-label={item.user_voted ? 'Remove vote' : 'Vote for this'}
    >
      <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
        <path d="M5 0L9.33 8H0.67L5 0Z" fill="currentColor"/>
      </svg>
      <span>{item.vote_count}</span>
    </button>
  );
}

function RoadmapSection({ status, items, onVote }) {
  if (!items.length) return null;
  const meta = STATUS_META[status];

  return (
    <div className={styles.statusGroup}>
      <h3 className={`${styles.statusLabel} ${styles[`statusLabel_${meta.color}`]}`}>
        {meta.label}
      </h3>
      <div className={styles.itemList}>
        {items.map(item => (
          <div key={item.id} className={styles.itemCard}>
            <div className={styles.itemBody}>
              <p className={styles.itemTitle}>{item.title}</p>
              {item.description && <p className={styles.itemDesc}>{item.description}</p>}
            </div>
            <VoteButton item={item} onVote={onVote} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PowerHub() {
  const { user } = useAuth();
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    api.get('/roadmap')
      .then(r => setItems(r.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleVote(itemId) {
    const res = await api.post(`/roadmap/${itemId}/vote`);
    setItems(prev => prev.map(item =>
      item.id !== itemId ? item : {
        ...item,
        user_voted: res.voted,
        vote_count: res.voted ? item.vote_count + 1 : item.vote_count - 1,
      }
    ));
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await fetch('/api/power/skills-download', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('cb_token') || ''}` },
        credentials: 'include',
      });
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = 'creatrbase-prompts.md';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silent — cookies handle auth anyway
    } finally {
      setDownloading(false);
    }
  }

  const grouped = STATUS_ORDER.reduce((acc, s) => {
    acc[s] = items.filter(i => i.status === s);
    return acc;
  }, {});

  const hasAnyItems = items.length > 0;

  return (
    <AppLayout>
      <div className={styles.page}>

        <div className={styles.hero}>
          <div className={styles.heroInner}>
            <span className={styles.heroBadge}>API Wrangler</span>
            <h1 className={styles.heroTitle}>Engine Room</h1>
            <p className={styles.heroDesc}>
              You are running on your own key. No limits. Here is what is being built, what is being considered, and where your vote goes.
            </p>
          </div>
          <div className={styles.heroActions}>
            <Link to="/settings" className={styles.heroLinkBtn}>Key settings</Link>
            <button
              type="button"
              className={styles.downloadBtn}
              onClick={handleDownload}
              disabled={downloading}
            >
              {downloading ? 'Preparing...' : 'Download prompts'}
            </button>
          </div>
        </div>

        <div className={styles.body}>
          <div className={styles.roadmapHeader}>
            <h2 className={styles.roadmapTitle}>Live roadmap</h2>
            <p className={styles.roadmapHint}>
              Vote on thinking-stage items. Building and shipped items are for visibility.
            </p>
          </div>

          {loading && <p className={styles.loadingText}>Loading roadmap...</p>}

          {!loading && !hasAnyItems && (
            <div className={styles.emptyState}>
              <p>Nothing on the roadmap yet. Check back soon.</p>
            </div>
          )}

          {!loading && hasAnyItems && (
            <div className={styles.roadmap}>
              {STATUS_ORDER.map(status => (
                <RoadmapSection
                  key={status}
                  status={status}
                  items={grouped[status]}
                  onVote={handleVote}
                />
              ))}
            </div>
          )}

          <div className={styles.promptsCard}>
            <div className={styles.promptsCardBody}>
              <h3 className={styles.promptsTitle}>Our editorial prompts</h3>
              <p className={styles.promptsDesc}>
                Every AI feature in Creatrbase is driven by skill files — structured prompts that encode voice, rules, and methodology. Download them to use in Claude.ai or any Claude-compatible tool.
              </p>
            </div>
            <button
              type="button"
              className={styles.downloadBtn}
              onClick={handleDownload}
              disabled={downloading}
            >
              {downloading ? 'Preparing...' : 'Download prompts (.md)'}
            </button>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
