import { useState, useEffect, useRef } from 'react';
import { AppLayout } from '../../layouts/AppLayout/AppLayout';
import { UpgradeGate } from '../../components/UpgradeGate/UpgradeGate';
import { api } from '../../lib/api';
import styles from './Community.module.css';

const SORT_OPTIONS = [
  { key: 'votes', label: 'Top' },
  { key: 'new',   label: 'New' },
  { key: 'controversial', label: 'Controversial' },
];

const STATUS_OPTIONS = [
  { key: 'open',        label: 'Open' },
  { key: 'considering', label: 'Considering' },
  { key: 'declined',    label: 'Declined' },
];

function VoteButton({ value, type, onClick, active, disabled }) {
  const isUp = type === 'up';
  return (
    <button
      type="button"
      className={`${styles.voteBtn} ${isUp ? styles.voteBtnUp : styles.voteBtnDown} ${active ? (isUp ? styles.voteBtnUpActive : styles.voteBtnDownActive) : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={isUp ? 'Upvote' : 'Downvote'}
      title={disabled ? 'Core plan required to vote' : (isUp ? 'Upvote' : 'Downvote')}
    >
      {isUp
        ? <svg width="9" height="7" viewBox="0 0 9 7" fill="none" aria-hidden="true"><path d="M4.5 0L8.5 7H0.5L4.5 0Z" fill="currentColor"/></svg>
        : <svg width="9" height="7" viewBox="0 0 9 7" fill="none" aria-hidden="true"><path d="M4.5 7L0.5 0H8.5L4.5 7Z" fill="currentColor"/></svg>
      }
      <span>{value}</span>
    </button>
  );
}

function SuggestionCard({ suggestion, onVote, canVote }) {
  const [voting, setVoting] = useState(false);
  const net = (suggestion.upvotes || 0) - (suggestion.downvotes || 0);

  async function handleVote(type) {
    if (!canVote || voting) return;
    setVoting(true);
    try { await onVote(suggestion.id, suggestion.user_vote_type === type ? 'remove' : type); }
    finally { setVoting(false); }
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardVotes}>
        <VoteButton
          value={suggestion.upvotes || 0}
          type="up"
          active={suggestion.user_vote_type === 'up'}
          onClick={() => handleVote('up')}
          disabled={!canVote || voting}
        />
        <span className={`${styles.netScore} ${net > 0 ? styles.netPos : net < 0 ? styles.netNeg : ''}`}>
          {net > 0 ? `+${net}` : net}
        </span>
        <VoteButton
          value={suggestion.downvotes || 0}
          type="down"
          active={suggestion.user_vote_type === 'down'}
          onClick={() => handleVote('down')}
          disabled={!canVote || voting}
        />
      </div>
      <div className={styles.cardBody}>
        <p className={styles.cardTitle}>{suggestion.title}</p>
        {suggestion.description && (
          <p className={styles.cardDesc}>{suggestion.description}</p>
        )}
        <div className={styles.cardMeta}>
          {suggestion.category_name && (
            <span className={styles.cardCategory}>{suggestion.category_name}</span>
          )}
          <span className={styles.cardAuthor}>by {suggestion.author_name || 'someone'}</span>
          {suggestion.status !== 'open' && (
            <span className={`${styles.statusBadge} ${styles[`statusBadge_${suggestion.status}`]}`}>
              {suggestion.status}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function SuggestModal({ categories, onClose, onSubmit, weeklyCap, weeklyUsed }) {
  const [title, setTitle]         = useState('');
  const [description, setDesc]    = useState('');
  const [category, setCategory]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState('');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const remaining = weeklyCap - weeklyUsed;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) { setError('Please add a title.'); return; }
    setSubmitting(true);
    setError('');
    try {
      await onSubmit({ title, description, category_id: category || null });
      onClose();
    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle} id="modal-title">New suggestion</h2>
          <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className={styles.modalForm}>
          {remaining <= 1 && remaining > 0 && (
            <p className={styles.capWarning}>
              {remaining} suggestion left this week
            </p>
          )}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="sug-title">Title <span className={styles.charCount}>{title.length}/120</span></label>
            <input
              id="sug-title"
              ref={inputRef}
              className={styles.input}
              type="text"
              maxLength={120}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Describe your idea in one line"
              required
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="sug-desc">Details <span className={styles.optionalLabel}>(optional)</span></label>
            <textarea
              id="sug-desc"
              className={`${styles.input} ${styles.textarea}`}
              value={description}
              onChange={e => setDesc(e.target.value)}
              placeholder="More context, use case, or why this matters"
              rows={4}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="sug-cat">Category <span className={styles.optionalLabel}>(optional)</span></label>
            <select
              id="sug-cat"
              className={`${styles.input} ${styles.select}`}
              value={category}
              onChange={e => setCategory(e.target.value)}
            >
              <option value="">Select a category...</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          {error && <p className={styles.errorMsg}>{error}</p>}
          <div className={styles.modalActions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.submitBtn} disabled={submitting || !title.trim()}>
              {submitting ? 'Submitting...' : 'Submit suggestion'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function Community() {
  const [categories, setCategories]   = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [isFree, setIsFree]           = useState(false);
  const [tier, setTier]               = useState('free');
  const [weeklyUsed, setWeeklyUsed]   = useState(0);
  const [weeklyCap, setWeeklyCap]     = useState(0);
  const [sort, setSort]               = useState('votes');
  const [status, setStatus]           = useState('open');
  const [category, setCategory]       = useState('');
  const [loading, setLoading]         = useState(true);
  const [showModal, setShowModal]     = useState(false);
  const [canVote, setCanVote]         = useState(true);

  useEffect(() => {
    api.get('/community/categories')
      .then(r => setCategories(r.categories || []))
      .catch(err => console.error('[Community]', err));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ sort });
    if (!isFree) {
      params.set('status', status);
      if (category) params.set('category', category);
    }
    api.get(`/community/suggestions?${params}`)
      .then(r => {
        setSuggestions(r.suggestions || []);
        setIsFree(r.isFree ?? false);
        setTier(r.tier ?? 'free');
        setWeeklyUsed(r.weeklyUsed ?? 0);
        setWeeklyCap(r.weeklyCap ?? 0);
      })
      .catch(err => console.error('[Community]', err))
      .finally(() => setLoading(false));
  }, [sort, status, category, isFree]);

  async function handleVote(suggestionId, voteType) {
    // Snapshot before optimistic update for rollback
    const snapshot = suggestions.find(s => s.id === suggestionId);
    // Optimistic update
    setSuggestions(prev => prev.map(s => {
      if (s.id !== suggestionId) return s;
      const prevType = s.user_vote_type;
      let up   = s.upvotes   || 0;
      let down = s.downvotes || 0;
      if (prevType === 'up')   up   = Math.max(0, up   - 1);
      if (prevType === 'down') down = Math.max(0, down - 1);
      const newType = (voteType === 'remove' || prevType === voteType) ? null : voteType;
      if (newType === 'up')   up   += 1;
      if (newType === 'down') down += 1;
      return { ...s, user_vote_type: newType, upvotes: up, downvotes: down };
    }));
    try {
      const res = await api.post(`/community/suggestions/${suggestionId}/vote`, { vote_type: voteType });
      // Sync server response with actual counts
      setSuggestions(prev => prev.map(s =>
        s.id !== suggestionId ? s : { ...s, user_vote_type: res.user_vote_type }
      ));
    } catch (err) {
      // Rollback on error
      if (snapshot) {
        setSuggestions(prev => prev.map(s => s.id !== suggestionId ? s : snapshot));
      }
      if (err?.status === 402) setCanVote(false);
    }
  }

  async function handleSubmit({ title, description, category_id }) {
    const res = await api.post('/community/suggestions', { title, description, category_id });
    setSuggestions(prev => [res.suggestion, ...prev]);
    setWeeklyUsed(w => w + 1);
  }

  const canSuggest = !isFree && weeklyUsed < weeklyCap;

  return (
    <AppLayout>
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <div className={styles.pageHeaderInner}>
            <h1 className={styles.pageTitle}>Community</h1>
            <p className={styles.pageDesc}>
              Vote on what gets built next. Your voice shapes the roadmap.
            </p>
          </div>
          <div className={styles.pageActions}>
            {isFree ? (
              <UpgradeGate feature="suggestions" minTier="core" compact />
            ) : (
              <button
                type="button"
                className={styles.suggestBtn}
                onClick={() => setShowModal(true)}
                disabled={!canSuggest}
                title={!canSuggest ? `Weekly limit reached (${weeklyUsed}/${weeklyCap})` : ''}
              >
                + Suggest
                {weeklyCap > 0 && (
                  <span className={styles.capPill}>{weeklyUsed}/{weeklyCap} this week</span>
                )}
              </button>
            )}
          </div>
        </div>

        {isFree && (
          <div className={styles.freeNotice}>
            <p className={styles.freeNoticeText}>
              Showing the top 10 most voted suggestions. Upgrade to Core to see all, vote, and submit your own.
            </p>
          </div>
        )}

        {!isFree && (
          <div className={styles.filters}>
            <div className={styles.filterTabs}>
              {SORT_OPTIONS.map(o => (
                <button
                  key={o.key}
                  type="button"
                  className={`${styles.filterTab} ${sort === o.key ? styles.filterTabActive : ''}`}
                  onClick={() => setSort(o.key)}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <div className={styles.filterRight}>
              <select
                className={styles.filterSelect}
                value={status}
                onChange={e => setStatus(e.target.value)}
              >
                {STATUS_OPTIONS.map(o => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>
              <select
                className={styles.filterSelect}
                value={category}
                onChange={e => setCategory(e.target.value)}
              >
                <option value="">All categories</option>
                {categories.map(c => (
                  <option key={c.id} value={c.slug}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {loading && <p className={styles.loadingText}>Loading suggestions...</p>}

        {!loading && suggestions.length === 0 && (
          <div className={styles.emptyState}>
            <p>No suggestions here yet.</p>
            {canSuggest && (
              <button type="button" className={styles.suggestBtn} onClick={() => setShowModal(true)}>
                Be the first to suggest
              </button>
            )}
          </div>
        )}

        {!loading && suggestions.length > 0 && (
          <div className={styles.list}>
            {suggestions.map(s => (
              <SuggestionCard
                key={s.id}
                suggestion={s}
                onVote={handleVote}
                canVote={canVote && !isFree}
              />
            ))}
            {isFree && (
              <div className={styles.freeUpgradeCard}>
                <p className={styles.freeUpgradeText}>
                  See all suggestions, vote, and submit your own ideas with a Core plan.
                </p>
                <UpgradeGate feature="full community access" minTier="core" compact />
              </div>
            )}
          </div>
        )}

        {showModal && (
          <SuggestModal
            categories={categories}
            weeklyCap={weeklyCap}
            weeklyUsed={weeklyUsed}
            onClose={() => setShowModal(false)}
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </AppLayout>
  );
}
