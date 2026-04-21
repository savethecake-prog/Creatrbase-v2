import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../../layouts/AppLayout/AppLayout';
import { useAuth } from '../../lib/AuthContext';
import { api } from '../../lib/api';
import styles from './PowerHub.module.css';

// Swim-lane stage config
const STAGES = [
  { key: 'scoping',   label: 'Scoping',   hint: 'Being scoped',       colorKey: 'lavender', votable: true  },
  { key: 'planning',  label: 'Planning',  hint: 'In planning',        colorKey: 'peach',    votable: true  },
  { key: 'building',  label: 'Building',  hint: 'Being built',        colorKey: 'mint',     votable: true  },
  { key: 'launching', label: 'Launching', hint: 'Imminent launch',    colorKey: 'coral',    votable: true  },
];

// Deterministic colour from userId
const AVATAR_PALETTE = ['#C8AAFF', '#9EFFD8', '#FFBFA3', '#F09870', '#A284E0', '#6EDDB1'];
function avatarBg(colour) {
  return colour || AVATAR_PALETTE[0];
}

function AvatarStack({ voters, total }) {
  if (!voters || voters.length === 0) return null;
  const shown = voters.slice(0, 5);
  const overflow = total - shown.length;
  return (
    <div className={styles.avatarStack} aria-label={`${total} voter${total !== 1 ? 's' : ''}`}>
      {shown.map((v, i) => (
        <div
          key={v.userId || i}
          className={styles.avatar}
          style={{ background: avatarBg(v.colour), zIndex: shown.length - i }}
          title={v.name || 'Voter'}
        >
          {v.initials || '?'}
        </div>
      ))}
      {overflow > 0 && (
        <div className={`${styles.avatar} ${styles.avatarOverflow}`} style={{ zIndex: 0 }}>
          +{overflow}
        </div>
      )}
    </div>
  );
}

function VoteControls({ item, onVote, canVote }) {
  const [voting, setVoting] = useState(false);

  async function handleVote(type) {
    if (!canVote || voting) return;
    setVoting(true);
    try { await onVote(item.id, type); } finally { setVoting(false); }
  }

  const netScore = (item.upvotes || 0) - (item.downvotes || 0);

  return (
    <div className={styles.voteControls}>
      <button
        type="button"
        className={`${styles.voteBtn} ${styles.voteBtnUp} ${item.user_vote_type === 'up' ? styles.voteBtnActive : ''}`}
        onClick={() => handleVote(item.user_vote_type === 'up' ? 'remove' : 'up')}
        disabled={!canVote || voting}
        aria-label="Upvote"
        title={canVote ? 'Upvote' : 'Core plan required to vote'}
      >
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
          <path d="M5 0L9.33 8H0.67L5 0Z" fill="currentColor"/>
        </svg>
      </button>
      <span className={`${styles.voteScore} ${netScore > 0 ? styles.voteScorePos : netScore < 0 ? styles.voteScoreNeg : ''}`}>
        {netScore > 0 ? `+${netScore}` : netScore}
      </span>
      <button
        type="button"
        className={`${styles.voteBtn} ${styles.voteBtnDown} ${item.user_vote_type === 'down' ? styles.voteBtnActiveDown : ''}`}
        onClick={() => handleVote(item.user_vote_type === 'down' ? 'remove' : 'down')}
        disabled={!canVote || voting}
        aria-label="Downvote"
        title={canVote ? 'Downvote' : 'Core plan required to vote'}
      >
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
          <path d="M5 8L0.67 0H9.33L5 8Z" fill="currentColor"/>
        </svg>
      </button>
    </div>
  );
}

function SwimLane({ stage, items, onVote, canVote }) {
  return (
    <div className={`${styles.lane} ${styles[`lane_${stage.colorKey}`]}`}>
      <div className={styles.laneHeader}>
        <span className={`${styles.laneChip} ${styles[`laneChip_${stage.colorKey}`]}`}>
          {stage.label}
        </span>
        <span className={styles.laneCount}>{items.length}</span>
      </div>
      <div className={styles.laneItems}>
        {items.length === 0 && (
          <p className={styles.laneEmpty}>Nothing here yet.</p>
        )}
        {items.map(item => (
          <div key={item.id} className={styles.itemCard}>
            <div className={styles.itemBody}>
              <p className={styles.itemTitle}>{item.title}</p>
              {item.description && <p className={styles.itemDesc}>{item.description}</p>}
              <div className={styles.itemMeta}>
                {item.tag && <span className={styles.itemTag}>{item.tag}</span>}
                {item.launch_date && (
                  <span className={styles.itemLaunchDate}>
                    Target: {new Date(item.launch_date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                  </span>
                )}
              </div>
            </div>
            <div className={styles.itemRight}>
              <AvatarStack
                voters={item.voters || []}
                total={(item.upvotes || 0)}
              />
              {stage.votable && (
                <VoteControls item={item} onVote={onVote} canVote={canVote} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShippedSection({ items }) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  return (
    <div className={styles.shippedSection}>
      <button
        type="button"
        className={styles.shippedToggle}
        onClick={() => setOpen(o => !o)}
      >
        <span className={styles.shippedLabel}>Shipped</span>
        <span className={styles.shippedCount}>{items.length}</span>
        <svg width="12" height="8" viewBox="0 0 12 8" fill="none" className={`${styles.shippedChevron} ${open ? styles.shippedChevronOpen : ''}`}>
          <path d="M1 1L6 7L11 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div className={styles.shippedList}>
          {items.map(item => (
            <div key={item.id} className={styles.shippedItem}>
              <span className={styles.shippedItemDot} />
              <div>
                <p className={styles.shippedItemTitle}>{item.title}</p>
                {item.shipped_at && (
                  <p className={styles.shippedItemDate}>
                    Shipped {new Date(item.shipped_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PowerHub() {
  const { user } = useAuth();
  const [items, setItems]       = useState([]);
  const [canVote, setCanVote]   = useState(false);
  const [loading, setLoading]   = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    api.get('/roadmap')
      .then(r => {
        setItems(r.items || []);
        // Core and above can vote (tier check happens server-side; 402 = not allowed)
        setCanVote(true); // Optimistic; server enforces
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleVote(itemId, voteType) {
    // Snapshot for rollback
    const snapshot = items.find(i => i.id === itemId);
    // Optimistic update
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const prevType = item.user_vote_type;
      let up   = item.upvotes   || 0;
      let down = item.downvotes || 0;
      if (prevType === 'up')   up   = Math.max(0, up   - 1);
      if (prevType === 'down') down = Math.max(0, down - 1);
      const newType = (voteType === 'remove' || prevType === voteType) ? null : voteType;
      if (newType === 'up')   up   += 1;
      if (newType === 'down') down += 1;
      return { ...item, user_vote_type: newType, upvotes: up, downvotes: down };
    }));
    try {
      const res = await api.post(`/roadmap/${itemId}/vote`, { vote_type: voteType });
      setItems(prev => prev.map(item =>
        item.id !== itemId ? item : { ...item, user_vote_type: res.user_vote_type }
      ));
    } catch (err) {
      // Rollback
      if (snapshot) setItems(prev => prev.map(i => i.id !== itemId ? i : snapshot));
      if (err?.status === 402) setCanVote(false);
    }
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await fetch('/api/power/skills-download', { credentials: 'include' });
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = 'creatrbase-prompts.md';
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* silent */ }
    finally { setDownloading(false); }
  }

  const grouped = {};
  for (const s of STAGES) grouped[s.key] = [];
  grouped.shipped = [];
  for (const item of items) {
    if (item.status === 'shipped') grouped.shipped.push(item);
    else if (grouped[item.status]) grouped[item.status].push(item);
  }

  return (
    <AppLayout>
      <div className={styles.page}>

        <div className={styles.hero}>
          <div className={styles.heroInner}>
            <span className={styles.heroBadge}>API Wrangler</span>
            <h1 className={styles.heroTitle}>Engine Room</h1>
            <p className={styles.heroDesc}>
              You are running on your own key. No limits. Here is what is being built,
              what is being considered, and where your vote goes.
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
              Vote on any active item. Core and above can upvote or downvote.
            </p>
          </div>

          {loading && <p className={styles.loadingText}>Loading roadmap...</p>}

          {!loading && (
            <>
              <div className={styles.swimLanes}>
                {STAGES.map(stage => (
                  <SwimLane
                    key={stage.key}
                    stage={stage}
                    items={grouped[stage.key] || []}
                    onVote={handleVote}
                    canVote={canVote}
                  />
                ))}
              </div>
              <ShippedSection items={grouped.shipped || []} />
            </>
          )}

          <div className={styles.promptsCard}>
            <div className={styles.promptsCardBody}>
              <h3 className={styles.promptsTitle}>Our editorial prompts</h3>
              <p className={styles.promptsDesc}>
                Every AI feature in Creatrbase is driven by skill files. Download them to use in Claude.ai or any Claude-compatible tool.
              </p>
            </div>
            <button
              type="button"
              className={`${styles.downloadBtn} ${styles.downloadBtnDark}`}
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
