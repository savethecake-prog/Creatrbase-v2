import { useState, useMemo } from 'react';
import { api } from '../../lib/api';
import styles from './BrandSearchModal.module.css';

// ── Category options ──────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'gaming_hardware',      label: 'Gaming Hardware' },
  { value: 'gaming_software',      label: 'Gaming Software' },
  { value: 'gaming_nutrition',     label: 'Gaming Nutrition' },
  { value: 'gaming_apparel',       label: 'Gaming Apparel' },
  { value: 'd2c_grooming',         label: 'D2C Grooming' },
  { value: 'd2c_wellness',         label: 'D2C Wellness' },
  { value: 'd2c_tech_accessories', label: 'D2C Tech' },
  { value: 'publisher',            label: 'Publisher' },
  { value: 'other',                label: 'Other' },
];

// ── Niche fit helpers (mirrors Outreach.jsx) ──────────────────────────────────

const NICHE_MAPS = {
  gaming:        { core: ['gaming_hardware','gaming_software','gaming_nutrition','gaming_apparel','publisher'], adjacent: ['d2c_tech_accessories'], broad: ['d2c_wellness','d2c_grooming','other'] },
  tech:          { core: ['d2c_tech_accessories','gaming_hardware','gaming_software'], adjacent: ['publisher','gaming_nutrition'], broad: ['gaming_apparel','d2c_wellness','d2c_grooming','other'] },
  fitness:       { core: ['d2c_wellness','gaming_nutrition'], adjacent: ['d2c_grooming','d2c_tech_accessories'], broad: ['gaming_apparel','gaming_hardware','publisher','other'] },
  beauty:        { core: ['d2c_grooming','d2c_wellness'], adjacent: ['d2c_tech_accessories','gaming_apparel'], broad: ['gaming_nutrition','publisher','other'] },
  lifestyle:     { core: ['d2c_grooming','d2c_wellness','d2c_tech_accessories'], adjacent: ['gaming_nutrition','gaming_apparel','publisher'], broad: ['gaming_hardware','gaming_software','other'] },
  food:          { core: ['gaming_nutrition','d2c_wellness'], adjacent: ['d2c_grooming','d2c_tech_accessories'], broad: ['gaming_hardware','gaming_software','gaming_apparel','publisher','other'] },
  entertainment: { core: ['publisher','gaming_software'], adjacent: ['gaming_hardware','gaming_nutrition','gaming_apparel'], broad: ['d2c_grooming','d2c_wellness','d2c_tech_accessories','other'] },
  education:     { core: ['publisher','d2c_tech_accessories'], adjacent: ['gaming_software','gaming_hardware'], broad: ['d2c_wellness','d2c_grooming','gaming_nutrition','gaming_apparel','other'] },
};
const FALLBACK_MAP = { core: [], adjacent: ['publisher','d2c_tech_accessories','d2c_wellness'], broad: ['gaming_hardware','gaming_software','gaming_nutrition','gaming_apparel','d2c_grooming','other'] };

function getBrandFit(creatorNiche, brandCategory) {
  const key = (creatorNiche || '').toLowerCase().trim();
  const map  = NICHE_MAPS[key] || FALLBACK_MAP;
  if (map.core.includes(brandCategory))     return { band: 'core',     label: 'Your niche' };
  if (map.adjacent.includes(brandCategory)) return { band: 'adjacent', label: 'Adjacent' };
  if (map.broad.includes(brandCategory))    return { band: 'broad',    label: 'Wider reach' };
  return                                           { band: 'outside',  label: 'Long shot' };
}

// ── Confidence display ────────────────────────────────────────────────────────

const CONFIDENCE_META = {
  high:   { label: 'Active programme', cls: 'confHigh' },
  medium: { label: 'Likely programme', cls: 'confMedium' },
  low:    { label: 'Inferred',         cls: 'confLow' },
};

// ── ResultCard ────────────────────────────────────────────────────────────────

function ResultCard({ brand, creatorNiche, selected, onToggle }) {
  const fit    = getBrandFit(creatorNiche, brand.category);
  const conf   = CONFIDENCE_META[brand.confidence] ?? CONFIDENCE_META.medium;
  const domain = (() => { try { return new URL(brand.website).hostname.replace(/^www\./, ''); } catch { return brand.website; } })();

  return (
    <div
      className={`${styles.resultCard} ${selected ? styles.resultCardSelected : ''} ${brand.is_watchlisted ? styles.resultCardTracked : ''}`}
      onClick={() => !brand.is_watchlisted && onToggle(brand)}
      role="checkbox"
      aria-checked={selected}
      tabIndex={0}
      onKeyDown={e => e.key === ' ' && !brand.is_watchlisted && onToggle(brand)}
    >
      <div className={`${styles.resultCheck} ${selected ? styles.resultCheckActive : ''}`}>
        {selected && <span className={styles.resultCheckMark}>✓</span>}
      </div>

      <div className={styles.resultBody}>
        <div className={styles.resultHead}>
          <span className={styles.resultName}>{brand.name}</span>
          <div className={styles.resultBadges}>
            {brand.is_watchlisted && <span className={styles.trackedBadge}>Already added</span>}
            <span className={`${styles.fitBadge} ${styles[`fit_${fit.band}`]}`}>{fit.label}</span>
            <span className={`${styles.confBadge} ${styles[conf.cls]}`}>{conf.label}</span>
          </div>
        </div>
        {domain && <p className={styles.resultDomain}>{domain}</p>}
        {brand.programme_notes && <p className={styles.resultNotes}>{brand.programme_notes}</p>}
      </div>
    </div>
  );
}

// ── BrandSearchModal ──────────────────────────────────────────────────────────

export function BrandSearchModal({ onClose, creatorNiche, onBrandsAdded }) {
  const [category,    setCategory]    = useState(null);
  const [query,       setQuery]       = useState('');
  const [searching,   setSearching]   = useState(false);
  const [results,     setResults]     = useState(null);
  const [selectedSet, setSelectedSet] = useState(new Set());
  const [adding,      setAdding]      = useState(false);
  const [doneCount,   setDoneCount]   = useState(null);
  const [error,       setError]       = useState(null);

  // ── Group results by fit band ─────────────────────────────────────────────

  const grouped = useMemo(() => {
    if (!results) return null;
    const core     = results.filter(b => getBrandFit(creatorNiche, b.category).band === 'core');
    const adjacent = results.filter(b => getBrandFit(creatorNiche, b.category).band === 'adjacent');
    const broad    = results.filter(b => ['broad','outside'].includes(getBrandFit(creatorNiche, b.category).band));
    return { core, adjacent, broad };
  }, [results, creatorNiche]);

  async function handleSearch() {
    if (!category) return;
    setSearching(true);
    setResults(null);
    setSelectedSet(new Set());
    setError(null);
    setDoneCount(null);

    try {
      const { results: r } = await api.post('/brands/discover-search', {
        category,
        query: query.trim() || undefined,
      });
      setResults(r ?? []);
    } catch {
      setError('Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  }

  function handleToggle(brand) {
    setSelectedSet(prev => {
      const next = new Set(prev);
      next.has(brand.name) ? next.delete(brand.name) : next.add(brand.name);
      return next;
    });
  }

  async function handleAdd() {
    if (selectedSet.size === 0 || !results) return;
    setAdding(true);
    setError(null);

    const toAdd = results.filter(b => selectedSet.has(b.name) && !b.is_watchlisted);
    try {
      const { added } = await api.post('/brands/watchlist', { brands: toAdd });
      setDoneCount(added);
      setSelectedSet(new Set());
      if (onBrandsAdded) onBrandsAdded(added);
    } catch {
      setError('Failed to add brands. Please try again.');
    } finally {
      setAdding(false);
    }
  }

  const selectableCount = results ? results.filter(b => !b.is_watchlisted).length : 0;
  const selectedCount   = selectedSet.size;
  const allSelected     = selectableCount > 0 && selectedCount === selectableCount;

  function toggleAll() {
    if (!results) return;
    if (allSelected) {
      setSelectedSet(new Set());
    } else {
      setSelectedSet(new Set(results.filter(b => !b.is_watchlisted).map(b => b.name)));
    }
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>

        {/* Header */}
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>Discover brands</h2>
            <p className={styles.subtitle}>Search by category and keyword. Select brands to add to your outreach list — email enrichment runs automatically.</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Controls */}
        <div className={styles.controls}>
          <div className={styles.categoryRow}>
            {CATEGORIES.map(c => (
              <button
                key={c.value}
                type="button"
                className={`${styles.catChip} ${category === c.value ? styles.catChipActive : ''}`}
                onClick={() => setCategory(c.value)}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className={styles.searchRow}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Optional: narrow results (e.g. protein, VPN, keyboards...)"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !searching && category && handleSearch()}
            />
            <button
              type="button"
              className={styles.searchBtn}
              onClick={handleSearch}
              disabled={!category || searching}
            >
              {searching ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>

        {/* Body */}
        <div className={styles.body}>

          {!results && !searching && (
            <div className={styles.emptyState}>
              <p className={styles.emptyTitle}>Pick a category above to start</p>
              <p className={styles.emptyDesc}>Creatrbase uses AI to find real brands with active creator programmes. Select the ones you want and they'll appear in your Outreach page — with email enrichment queued automatically.</p>
            </div>
          )}

          {searching && (
            <div className={styles.loadingState}>
              <div className={styles.spinner} />
              <p className={styles.loadingText}>Finding brands with creator programmes...</p>
            </div>
          )}

          {error && (
            <div className={styles.errorState}>{error}</div>
          )}

          {doneCount !== null && (
            <div className={styles.successState}>
              <span className={styles.successIcon}>✓</span>
              <div>
                <p className={styles.successTitle}>{doneCount} brand{doneCount !== 1 ? 's' : ''} added to your Outreach page</p>
                <p className={styles.successDesc}>Email enrichment is running in the background — contacts will appear in each brand's Contacts tab within a minute.</p>
              </div>
            </div>
          )}

          {results && !searching && results.length === 0 && (
            <div className={styles.emptyState}>
              <p className={styles.emptyTitle}>No results found</p>
              <p className={styles.emptyDesc}>Try a broader keyword or different category.</p>
            </div>
          )}

          {results && !searching && results.length > 0 && (
            <>
              <div className={styles.resultsHeader}>
                <span className={styles.resultsCount}>{results.length} brands found</span>
                {selectableCount > 0 && (
                  <button type="button" className={styles.selectAllBtn} onClick={toggleAll}>
                    {allSelected ? 'Deselect all' : 'Select all'}
                  </button>
                )}
              </div>

              <div className={styles.results}>
                {/* Core / Your niche */}
                {grouped.core.length > 0 && (
                  <div className={styles.resultGroup}>
                    <p className={styles.groupLabel}>Your niche <span className={styles.groupCount}>{grouped.core.length}</span></p>
                    {grouped.core.map(b => (
                      <ResultCard key={b.name} brand={b} creatorNiche={creatorNiche} selected={selectedSet.has(b.name)} onToggle={handleToggle} />
                    ))}
                  </div>
                )}

                {/* Adjacent */}
                {grouped.adjacent.length > 0 && (
                  <div className={styles.resultGroup}>
                    <p className={styles.groupLabel}>Adjacent categories <span className={styles.groupCount}>{grouped.adjacent.length}</span></p>
                    {grouped.adjacent.map(b => (
                      <ResultCard key={b.name} brand={b} creatorNiche={creatorNiche} selected={selectedSet.has(b.name)} onToggle={handleToggle} />
                    ))}
                  </div>
                )}

                {/* Broad / wider reach */}
                {grouped.broad.length > 0 && (
                  <div className={styles.resultGroup}>
                    <p className={styles.groupLabel}>Wider reach <span className={styles.groupCount}>{grouped.broad.length}</span></p>
                    {grouped.broad.map(b => (
                      <ResultCard key={b.name} brand={b} creatorNiche={creatorNiche} selected={selectedSet.has(b.name)} onToggle={handleToggle} />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer CTA */}
        {results && results.length > 0 && (
          <div className={styles.footer}>
            <span className={styles.footerHint}>
              {selectedCount === 0
                ? 'Tick brands to add them to your Outreach list'
                : `${selectedCount} brand${selectedCount !== 1 ? 's' : ''} selected`}
            </span>
            <div className={styles.footerActions}>
              <button type="button" className={styles.cancelBtn} onClick={onClose}>Done</button>
              <button
                type="button"
                className={styles.addBtn}
                onClick={handleAdd}
                disabled={selectedCount === 0 || adding}
              >
                {adding
                  ? 'Adding...'
                  : selectedCount === 0
                    ? 'Select brands to add'
                    : `Add ${selectedCount} brand${selectedCount !== 1 ? 's' : ''} + enrich emails`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
