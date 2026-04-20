import { useState, useEffect } from 'react';
import { AppLayout } from '../../layouts/AppLayout/AppLayout';
import { api } from '../../lib/api';
import styles from './Toolkit.module.css';

const CONFIDENCE_COLORS = {
  high:   { color: 'var(--neon-mint)',   bg: 'rgba(158,255,216,0.08)',  border: 'rgba(158,255,216,0.2)'  },
  medium: { color: 'var(--neon-purple)', bg: 'rgba(200,170,255,0.08)', border: 'rgba(200,170,255,0.2)' },
  low:    { color: 'var(--text-muted)',  bg: 'rgba(255,255,255,0.04)', border: 'var(--glass-border)'    },
};

function TagsSection() {
  const [tags,        setTags]        = useState([]);
  const [input,       setInput]       = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [adding,      setAdding]      = useState(false);
  const [error,       setError]       = useState(null);

  useEffect(() => {
    api.get('/creator/tags').then(res => setTags(res.tags ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (input.trim().length < 2) { setSuggestions([]); return; }
    const t = setTimeout(() => {
      api.get(`/brands/tag-search?q=${encodeURIComponent(input.trim())}`)
        .then(res => setSuggestions(res.brands ?? []))
        .catch(() => setSuggestions([]));
    }, 250);
    return () => clearTimeout(t);
  }, [input]);

  async function handleAdd(tag, brandId = null) {
    const value = (tag ?? input).trim();
    if (!value) return;
    setAdding(true);
    setError(null);
    try {
      const res = await api.post('/creator/tags', { tag: value, brandId });
      setTags(prev => [res.tag, ...prev]);
      setInput('');
      setSuggestions([]);
    } catch (err) {
      setError(err?.data?.error ?? 'Failed to add tag.');
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(id) {
    try {
      await api.delete(`/creator/tags/${id}`);
      setTags(prev => prev.filter(t => t.id !== id));
    } catch {
      // best-effort
    }
  }

  return (
    <div className={styles.tagsSection}>
      <div className={styles.tagsSectionHeader}>
        <div>
          <p className={styles.tagsSectionTitle}>Brand content tags</p>
          <p className={styles.tagsSectionSub}>
            Add the tags you use on sponsored or brand-aligned videos. Creatrbase will detect them automatically on each sync and track how well tagged content performs.
          </p>
        </div>
      </div>

      <div className={styles.tagInputRow}>
        <div className={styles.tagInputWrap}>
          <input
            className={styles.tagInput}
            value={input}
            onChange={e => { setInput(e.target.value); setError(null); }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
            placeholder="e.g. razer, gfuel, sponsored…"
            maxLength={100}
          />
          {suggestions.length > 0 && (
            <div className={styles.tagSuggestions}>
              {suggestions.map(b => (
                <button
                  key={b.id}
                  className={styles.tagSuggestion}
                  onClick={() => handleAdd(b.brand_slug, b.id)}
                >
                  <span className={styles.tagSuggestionName}>{b.brand_name}</span>
                  <span className={styles.tagSuggestionCat}>{b.category?.replace(/_/g, ' ')}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          className={styles.tagAddBtn}
          onClick={() => handleAdd()}
          disabled={adding || !input.trim()}
        >
          {adding ? '…' : 'Add tag'}
        </button>
      </div>

      {error && <p className={styles.tagError}>{error}</p>}

      {tags.length === 0 && (
        <p className={styles.tagEmpty}>No tags tracked yet. Add your first tag above.</p>
      )}

      {tags.length > 0 && (
        <div className={styles.tagList}>
          {tags.map(t => {
            const conf = CONFIDENCE_COLORS[t.confidence] ?? CONFIDENCE_COLORS.low;
            return (
              <div key={t.id} className={styles.tagChip}>
                <div className={styles.tagChipLeft}>
                  <span className={styles.tagChipName}>{t.tag}</span>
                  {t.brand_name && <span className={styles.tagChipBrand}>{t.brand_name}</span>}
                </div>
                <div className={styles.tagChipRight}>
                  {t.detection_count > 0 && (
                    <>
                      <span className={styles.tagChipCount}>{t.detection_count} {t.detection_count === 1 ? 'video' : 'videos'}</span>
                      {t.effectiveness_score != null && (
                        <span
                          className={styles.tagChipScore}
                          style={{ color: conf.color, background: conf.bg, border: `1px solid ${conf.border}` }}
                        >
                          {Math.round(t.effectiveness_score)}/100 · {t.confidence}
                        </span>
                      )}
                    </>
                  )}
                  {t.detection_count === 0 && (
                    <span className={styles.tagChipPending}>Not detected yet</span>
                  )}
                  <button className={styles.tagChipRemove} onClick={() => handleRemove(t.id)} aria-label="Remove tag">✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Toolkit() {
  return (
    <AppLayout>
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Toolkit</h1>
          <p className={styles.pageDesc}>Tools to support your brand deal workflow.</p>
        </div>
        <TagsSection />
      </div>
    </AppLayout>
  );
}
