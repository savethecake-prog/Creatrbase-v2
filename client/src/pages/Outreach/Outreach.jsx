import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '../../layouts/AppLayout/AppLayout';
import { BrandModal } from './BrandModal';
import { BrandSearchModal } from './BrandSearchModal';
import { BrandCard, ReadinessBanner, MomentumRow, BrandGroup } from './OutreachCards';
import {
  getCreatorTier, getBrandFit, computeReadiness, sortBrands,
  CATEGORY_FILTERS,
} from './outreachUtils';
import { api } from '../../lib/api';
import styles from './Outreach.module.css';

export function Outreach() {
  const [brandsData,    setBrandsData]    = useState(null);
  const [creatorCtxRaw, setCreatorCtxRaw] = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [category,      setCategory]      = useState(null);
  const [readyOnly,     setReadyOnly]     = useState(false);
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [selectedIds,   setSelectedIds]   = useState(new Set());
  const [broadenSearch,  setBroadenSearch] = useState(false);
  const [batchStatus,    setBatchStatus]  = useState(null);
  const [discoverOpen,   setDiscoverOpen] = useState(false);

  // Parallel fetch on mount
  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      api.get('/brands'),
      api.get('/creator/score'),
      api.get('/connect/platforms'),
    ]).then(([brandsRes, scoreRes, platformsRes]) => {
      setBrandsData(brandsRes.status === 'fulfilled' ? brandsRes.value : { brands: [], niche: null });
      const milestones = scoreRes.status === 'fulfilled' ? (scoreRes.value.milestones ?? []) : [];
      const platforms  = platformsRes.status === 'fulfilled' ? (platformsRes.value.platforms ?? []) : [];
      const yt         = platforms.find(p => p.platform === 'youtube');
      setCreatorCtxRaw({
        milestones,
        subscribers:  yt?.subscriber_count ?? null,
        avgViews30d:  yt?.avg_views_per_video_30d ?? null,
        avgViews60d:  yt?.avg_views_per_video_60d ?? null,
        avgViews90d:  yt?.avg_views_per_video_90d ?? null,
      });
    }).finally(() => setLoading(false));
  }, []);

  // Re-fetch when category filter changes
  useEffect(() => {
    if (brandsData === null) return;
    const path = category ? `/brands?category=${encodeURIComponent(category)}` : '/brands';
    api.get(path).then(res => setBrandsData(res)).catch(err => console.error('[Outreach]', err));
  }, [category]); // eslint-disable-line

  const creatorCtx = useMemo(() => {
    if (!creatorCtxRaw) return { tier: null, subscribers: null, avgViews30d: null, avgViews60d: null, avgViews90d: null, isGiftable: false, isOutreachReady: false };
    const { milestones, subscribers, avgViews30d, avgViews60d, avgViews90d } = creatorCtxRaw;
    const crossed = type => milestones.some(m => m.type === type && m.status === 'crossed');
    return { tier: getCreatorTier(subscribers), subscribers, avgViews30d, avgViews60d, avgViews90d, isGiftable: crossed('giftable'), isOutreachReady: crossed('outreach_ready') };
  }, [creatorCtxRaw]);

  const niche = brandsData?.niche ?? null;

  const sortedBrands = useMemo(() => {
    const brands = brandsData?.brands ?? [];
    return sortBrands(brands, creatorCtx).map(b => ({
      ...b,
      _fit:     getBrandFit(niche, b.category),
      _fitBand: getBrandFit(niche, b.category).band,
    }));
  }, [brandsData, creatorCtx, niche]);

  const watchlistedBrands = useMemo(() => sortedBrands.filter(b => b.is_watchlisted), [sortedBrands]);
  const registryBrands    = useMemo(() => sortedBrands.filter(b => !b.is_watchlisted),  [sortedBrands]);

  const readyCounts = useMemo(() => ({
    ready:   sortedBrands.filter(b => computeReadiness(b, creatorCtx).signal === 'ready').length,
    gifting: sortedBrands.filter(b => computeReadiness(b, creatorCtx).signal === 'gifting').length,
  }), [sortedBrands, creatorCtx]);

  const filteredBrands = useMemo(() => {
    if (!readyOnly) return registryBrands;
    return registryBrands.filter(b => { const s = computeReadiness(b, creatorCtx).signal; return s === 'ready' || s === 'gifting'; });
  }, [registryBrands, readyOnly, creatorCtx]);

  const groupedBrands = useMemo(() => {
    if (!niche) return { flat: filteredBrands };
    return {
      core:     filteredBrands.filter(b => b._fitBand === 'core'),
      adjacent: filteredBrands.filter(b => b._fitBand === 'adjacent'),
      broad:    filteredBrands.filter(b => b._fitBand === 'broad' || b._fitBand === 'outside'),
    };
  }, [filteredBrands, niche]);

  const activeBrandCategories = useMemo(() => new Set((brandsData?.brands ?? []).map(b => b.category)), [brandsData]);
  const visibleFilters = CATEGORY_FILTERS.filter(f => f.value === null || activeBrandCategories.has(f.value));

  function handleOutreachLogged(brandId, interactionType) {
    const update = brands => brands.map(b =>
      b.id === brandId
        ? { ...b, latest_interaction: { interaction_type: interactionType, interaction_date: new Date().toISOString().split('T')[0], deal_notes: null } }
        : b
    );
    setBrandsData(prev => prev ? { ...prev, brands: update(prev.brands) } : prev);
    setSelectedBrand(prev => prev?.id === brandId
      ? { ...prev, latest_interaction: { interaction_type: interactionType, interaction_date: new Date().toISOString().split('T')[0], deal_notes: null } }
      : prev
    );
  }

  function handleToggleSelect(brandId) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(brandId) ? next.delete(brandId) : next.add(brandId);
      return next;
    });
  }

  function handleBrandsAdded() {
    const path = category ? `/brands?category=${encodeURIComponent(category)}` : '/brands';
    api.get(path).then(res => setBrandsData(res)).catch(err => console.error('[Outreach]', err));
  }

  async function handleBatchDiscover() {
    if (selectedIds.size === 0) return;
    setBatchStatus('sending');
    try {
      await api.post('/contacts/discover-batch', { brandIds: [...selectedIds] });
      setBatchStatus('done');
      setSelectedIds(new Set());
      setTimeout(() => setBatchStatus(null), 3500);
    } catch (err) {
      console.error('[Outreach]', err);
      setBatchStatus('error');
      setTimeout(() => setBatchStatus(null), 3000);
    }
  }

  const hasBroadBrands = (groupedBrands.broad?.length ?? 0) > 0;

  return (
    <AppLayout>
      <div className={styles.header}>
        <h1 className={styles.title}>Brand Outreach</h1>
        <p className={styles.subtitle}>Every brand card is scored against your current size and viability — so you know exactly who to contact and why.</p>
        {niche && <span className={styles.nicheHint}>Matched to: {niche.replace(/_/g, ' ')}</span>}
      </div>

      {!loading && <ReadinessBanner ctx={creatorCtx} readyCounts={readyCounts} />}
      {!loading && <MomentumRow ctx={creatorCtx} />}

      <div className={styles.filterBar}>
        {visibleFilters.map(f => (
          <button key={f.value ?? 'all'} type="button"
            className={[styles.filterChip, category === f.value ? styles.filterChipActive : ''].filter(Boolean).join(' ')}
            onClick={() => setCategory(f.value)}
          >
            {f.label}
          </button>
        ))}
        <div className={styles.filterDivider} />
        <button type="button"
          className={[styles.filterChip, readyOnly ? styles.filterChipReady : ''].filter(Boolean).join(' ')}
          onClick={() => setReadyOnly(v => !v)}
        >
          {readyOnly ? 'Show all' : 'Ready for me only'}
        </button>
        <div className={styles.filterDivider} />
        <button type="button" className={styles.discoverBtn} onClick={() => setDiscoverOpen(true)}>
          + Discover brands
        </button>
      </div>

      {loading && (
        <div className={styles.grid}>
          <div className={styles.loadingRow}>
            <div className={styles.skeleton} />
            <div className={styles.skeleton} />
          </div>
        </div>
      )}

      {!loading && filteredBrands.length === 0 && (
        <div className={styles.grid}>
          <div className={styles.stateCard}>
            <p className={styles.stateTitle}>{readyOnly ? 'No brands ready for you yet' : 'No brands found'}</p>
            <p className={styles.stateDesc}>
              {readyOnly
                ? 'Keep building. As your score grows, brands will unlock here.'
                : category
                  ? 'No brands in this category yet. Try a different filter.'
                  : 'The brand registry is being populated. Check back soon.'}
            </p>
          </div>
        </div>
      )}

      {/* User-added watchlist brands */}
      {!loading && watchlistedBrands.length > 0 && (
        <BrandGroup
          label="Your brands"
          brands={watchlistedBrands}
          ctx={creatorCtx}
          selectedIds={selectedIds}
          onSelect={handleToggleSelect}
          onOpen={setSelectedBrand}
          showFitBand={true}
        />
      )}

      {/* Niche-grouped view */}
      {!loading && filteredBrands.length > 0 && niche && (
        <>
          <BrandGroup label="Your niche" brands={groupedBrands.core} ctx={creatorCtx}
            selectedIds={selectedIds} onSelect={handleToggleSelect} onOpen={setSelectedBrand} showFitBand={false} />
          <BrandGroup label="Adjacent categories" brands={groupedBrands.adjacent} ctx={creatorCtx}
            selectedIds={selectedIds} onSelect={handleToggleSelect} onOpen={setSelectedBrand} showFitBand={true} />

          {hasBroadBrands && (
            <div className={styles.broadenRow}>
              <button type="button" className={styles.broadenBtn} onClick={() => setBroadenSearch(v => !v)}>
                {broadenSearch
                  ? 'Show fewer brands'
                  : `Broaden search — ${groupedBrands.broad.length} more brand${groupedBrands.broad.length !== 1 ? 's' : ''} outside your niche`}
              </button>
              {!broadenSearch && (
                <p className={styles.broadenHint}>Lower brand fit — different audience, but active creator programmes.</p>
              )}
            </div>
          )}

          {broadenSearch && (
            <BrandGroup label="Wider reach" brands={groupedBrands.broad} ctx={creatorCtx}
              selectedIds={selectedIds} onSelect={handleToggleSelect} onOpen={setSelectedBrand} showFitBand={true} />
          )}
        </>
      )}

      {/* Flat view when no niche */}
      {!loading && filteredBrands.length > 0 && !niche && (
        <div className={styles.grid}>
          {filteredBrands.map(brand => (
            <BrandCard
              key={brand.id}
              brand={brand}
              readiness={computeReadiness(brand, creatorCtx)}
              fitBand={null}
              selected={selectedIds.has(brand.id)}
              onSelect={handleToggleSelect}
              onClick={() => setSelectedBrand(brand)}
            />
          ))}
        </div>
      )}

      {/* Batch contact discovery bar */}
      {selectedIds.size > 0 && (
        <div className={styles.batchBar}>
          <span className={styles.batchCount}>{selectedIds.size} brand{selectedIds.size !== 1 ? 's' : ''} selected</span>
          <div className={styles.batchActions}>
            <button type="button" className={styles.batchClearBtn} onClick={() => setSelectedIds(new Set())}>Clear</button>
            <button type="button" className={styles.batchDiscoverBtn} onClick={handleBatchDiscover} disabled={batchStatus === 'sending'}>
              {batchStatus === 'sending' ? 'Searching...' : 'Find contacts for all'}
            </button>
          </div>
        </div>
      )}

      {batchStatus === 'done' && (
        <div className={styles.batchToast}>Contact search queued — check the Contacts tab in each brand</div>
      )}
      {batchStatus === 'error' && (
        <div className={`${styles.batchToast} ${styles.batchToastError}`}>Something went wrong. Try again or search brands individually.</div>
      )}

      {selectedBrand && (
        <BrandModal
          brand={selectedBrand}
          niche={niche}
          onClose={() => setSelectedBrand(null)}
          onOutreachLogged={handleOutreachLogged}
        />
      )}

      {discoverOpen && (
        <BrandSearchModal
          creatorNiche={niche}
          onClose={() => setDiscoverOpen(false)}
          onBrandsAdded={handleBrandsAdded}
        />
      )}
    </AppLayout>
  );
}
