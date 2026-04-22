import { useState, useEffect, useRef, useMemo } from 'react';
import { AppLayout } from '../../layouts/AppLayout/AppLayout';
import { Badge } from '../../components/ui/Badge/Badge';
import { BrandModal } from './BrandModal';
import { BrandSearchModal } from './BrandSearchModal';
import { api } from '../../lib/api';
import styles from './Outreach.module.css';

// ── Creator tier derivation ───────────────────────────────────────────────────

const TIER_RANK = { micro: 0, rising: 1, mid: 2, established: 3 };

function getCreatorTier(subscribers) {
  if (subscribers == null) return null;
  if (subscribers >= 250000) return 'established';
  if (subscribers >= 50000)  return 'mid';
  if (subscribers >= 10000)  return 'rising';
  return 'micro';
}

// ── View momentum helpers ─────────────────────────────────────────────────────

function fmtViews(n) {
  if (n == null) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return Math.round(n).toLocaleString();
}

function viewMomentumSignal(avgViews30d, subscribers) {
  if (avgViews30d == null || !subscribers) return null;
  const ratio = avgViews30d / subscribers;
  if (ratio >= 0.30) return 'strong';
  if (ratio >= 0.10) return 'average';
  return 'weak';
}

// ── Niche fit scoring (client-side mirror of src/config/nicheAdjacency.js) ───

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
  const map = NICHE_MAPS[key] || FALLBACK_MAP;
  if (map.core.includes(brandCategory))     return { band: 'core',     label: 'Your niche',          score: 1.00 };
  if (map.adjacent.includes(brandCategory)) return { band: 'adjacent', label: 'Adjacent categories', score: 0.65 };
  if (map.broad.includes(brandCategory))    return { band: 'broad',    label: 'Wider reach',         score: 0.35 };
  return                                           { band: 'outside',  label: 'Long shot',           score: 0.15 };
}

// ── Readiness computation ─────────────────────────────────────────────────────

function computeReadiness(brand, ctx) {
  const { tier, subscribers, isGiftable, isOutreachReady, avgViews30d } = ctx;
  const momentum = viewMomentumSignal(avgViews30d, subscribers);

  if (!tier) {
    return { signal: 'no_context', label: 'Connect YouTube', reason: 'Connect your YouTube channel to see personalised readiness signals.' };
  }

  const profiles = brand.tier_profiles ?? [];

  if (profiles.length === 0) {
    if (isOutreachReady) return { signal: 'ready',    label: 'Reach out',       reason: 'No tier data on file, but your score qualifies you. Worth contacting.' };
    if (isGiftable)      return { signal: 'gifting',  label: 'Gifting ready',   reason: 'No rate data yet. Try reaching out about gifting or samples.' };
    return                      { signal: 'no_data',  label: 'No tier data',    reason: "We don't have intel on this brand's programme yet. Check their site directly." };
  }

  const exactProfile   = profiles.find(tp => tp.creator_tier === tier);
  const sortedByTier   = [...profiles].sort((a, b) => TIER_RANK[a.creator_tier] - TIER_RANK[b.creator_tier]);
  const lowestProfile  = sortedByTier[0];

  if (!exactProfile) {
    const creatorRank = TIER_RANK[tier] ?? 0;
    const lowestRank  = TIER_RANK[lowestProfile?.creator_tier] ?? 99;
    if (creatorRank < lowestRank) {
      const gap = lowestRank - creatorRank;
      if (gap === 1) return { signal: 'approaching', label: 'Building towards this', reason: `Brand works with ${lowestProfile.creator_tier} creators — you're one tier away.` };
      return               { signal: 'not_yet',     label: 'Not yet',               reason: `Brand works with ${lowestProfile.creator_tier} creators and above.` };
    }
    if (isOutreachReady) return { signal: 'ready',    label: 'Reach out',             reason: "Your size is above their documented range — strong position to negotiate." };
    return                      { signal: 'approaching', label: 'Building towards this', reason: 'No tier data for your size yet, but you may already be above their typical range.' };
  }

  const minSubs   = exactProfile.min_subscribers_observed;
  const hasWindow = exactProfile.buying_window_status === 'active' || exactProfile.buying_window_status === 'warming';

  if (minSubs && subscribers < minSubs) {
    const gap    = minSubs - subscribers;
    const fmtGap = gap >= 1000 ? `${(gap / 1000).toFixed(gap >= 10000 ? 0 : 1)}k` : gap.toLocaleString();
    return { signal: 'approaching', label: 'Building towards this', reason: `${fmtGap} more subscribers to meet their observed minimum.` };
  }

  if (hasWindow && isOutreachReady) {
    const extra = momentum === 'strong' ? ` Your avg views are strong right now — good timing.` : momentum === 'weak' ? ` Note: your avg views are soft — mention this in your pitch.` : '';
    return { signal: 'ready', label: 'Reach out now', reason: `Buying in the ${tier} tier right now and your score qualifies. Go.${extra}` };
  }
  if (hasWindow && isGiftable)   return { signal: 'gifting',     label: 'Gifting ready',         reason: `Window open in your tier — reach out about gifting to start the relationship.` };
  if (hasWindow)                 return { signal: 'approaching', label: 'Window open — almost',  reason: "Buying window is live but your viability score isn't at outreach level yet. Keep growing." };
  if (isOutreachReady) {
    const extra = momentum === 'strong' ? ` Avg views are strong — lead with that in your pitch.` : momentum === 'weak' ? ` Avg views are currently soft — worth addressing in your pitch.` : '';
    return { signal: 'ready', label: 'Reach out', reason: `Tier match and your score qualifies. No active window but worth making contact.${extra}` };
  }
  if (isGiftable) return { signal: 'gifting', label: 'Gifting ready', reason: 'Tier match. Lead with a gifting ask — build the relationship before going paid.' };
  return                { signal: 'approaching', label: 'Building towards this', reason: "Tier match exists but your viability score isn't at outreach level yet." };
}

// ── Sort brands by readiness ──────────────────────────────────────────────────

const SIGNAL_RANK = { ready: 0, gifting: 1, approaching: 2, no_data: 3, not_yet: 4, no_context: 5 };

function sortBrands(brands, ctx) {
  return [...brands].sort((a, b) => {
    const ra = computeReadiness(a, ctx);
    const rb = computeReadiness(b, ctx);
    const diff = (SIGNAL_RANK[ra.signal] ?? 9) - (SIGNAL_RANK[rb.signal] ?? 9);
    return diff !== 0 ? diff : a.brand_name.localeCompare(b.brand_name);
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORY_LABELS = {
  gaming_hardware:       'Gaming Hardware',
  gaming_software:       'Gaming Software',
  gaming_nutrition:      'Gaming Nutrition',
  gaming_apparel:        'Gaming Apparel',
  d2c_grooming:          'D2C Grooming',
  d2c_wellness:          'D2C Wellness',
  d2c_tech_accessories:  'D2C Tech',
  publisher:             'Publisher',
  other:                 'Other',
};

const PROGRAMME_LABELS = {
  direct:           'Direct',
  agency_managed:   'Agency managed',
  platform_managed: 'Platform managed',
  unknown:          null,
};

const CONFIDENCE_VARIANT = {
  established: 'mint',
  partial:     'peach',
  minimal:     'lavender',
};

function formatRate(low, high, currency) {
  const sym = currency === 'USD' ? '$' : '£';
  const fmt = n => { const v = Math.round(n / 100); return v >= 1000 ? `${sym}${(v / 1000).toFixed(1)}k` : `${sym}${v}`; };
  if (!low && !high) return null;
  if (low && high)   return `${fmt(low)} – ${fmt(high)}`;
  if (high)          return `up to ${fmt(high)}`;
  return fmt(low);
}

// ── ReadinessStrip ────────────────────────────────────────────────────────────

function ReadinessStrip({ readiness }) {
  const { signal, label, reason } = readiness;
  if (signal === 'no_context') return null;
  const stripClass = { ready: styles.stripReady, gifting: styles.stripGifting, approaching: styles.stripApproaching, not_yet: styles.stripNotYet, no_data: styles.stripNoData }[signal] ?? styles.stripNoData;
  return (
    <div className={`${styles.readinessStrip} ${stripClass}`}>
      <span className={styles.stripLabel}>{label}</span>
      <span className={styles.stripReason}>{reason}</span>
    </div>
  );
}

// ── BrandCard ─────────────────────────────────────────────────────────────────

function BrandCard({ brand, readiness, fitBand, onClick, selected, onSelect }) {
  const notesRef  = useRef(null);
  const [clipped, setClipped] = useState(false);

  useEffect(() => {
    const el = notesRef.current;
    if (el) setClipped(el.scrollHeight > el.clientHeight + 2);
  }, [brand.notes]);

  const bestProfile = brand.tier_profiles?.[0] ?? null;
  const contacted   = !!brand.latest_interaction;
  const rateStr     = bestProfile ? formatRate(bestProfile.rate_range_low, bestProfile.rate_range_high, bestProfile.rate_currency) : null;
  const progLabel   = PROGRAMME_LABELS[brand.creator_programme_type];

  const cardClass = [
    styles.card,
    readiness.signal === 'ready'   ? styles.cardReady    : '',
    readiness.signal === 'gifting' ? styles.cardGifting  : '',
    readiness.signal === 'not_yet' ? styles.cardNotYet   : '',
    contacted                      ? styles.cardContacted : '',
    selected                       ? styles.cardSelected  : '',
    fitBand === 'broad' || fitBand === 'outside' ? styles.cardDimmed : '',
  ].filter(Boolean).join(' ');

  function handleCheckbox(e) {
    e.stopPropagation();
    onSelect(brand.id);
  }

  return (
    <div className={cardClass} onClick={onClick} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && onClick()}>

      {/* Selection checkbox */}
      {onSelect && (
        <div className={`${styles.checkWrap} ${selected ? styles.checkWrapActive : ''}`} onClick={handleCheckbox}>
          <div className={styles.checkBox}>{selected && <span className={styles.checkMark}>✓</span>}</div>
        </div>
      )}

      <div className={styles.cardHead}>
        <p className={styles.brandName}>{brand.brand_name}</p>
        <div className={styles.cardBadges}>
          {contacted && <Badge variant="mint" dot>Contacted</Badge>}
          <Badge variant={CONFIDENCE_VARIANT[brand.registry_confidence] ?? 'lavender'}>
            {brand.registry_confidence}
          </Badge>
        </div>
      </div>

      <ReadinessStrip readiness={readiness} />

      <div className={styles.meta}>
        <span className={styles.categoryLabel}>{CATEGORY_LABELS[brand.category] ?? brand.category}</span>
        {progLabel && (
          <>
            <span className={styles.metaDivider} />
            <span className={styles.programmeLabel}>{progLabel}</span>
          </>
        )}
        {fitBand && fitBand !== 'core' && (
          <>
            <span className={styles.metaDivider} />
            <span className={`${styles.fitBandLabel} ${styles[`fitBand_${fitBand}`]}`}>
              {fitBand === 'adjacent' ? 'Adjacent niche' : fitBand === 'broad' ? 'Wider reach' : 'Long shot'}
            </span>
          </>
        )}
      </div>

      {rateStr && (
        <div className={styles.rateRow}>
          <span className={styles.rateLabel}>Rate</span>
          <span className={styles.rateValue}>{rateStr}</span>
          {bestProfile.typical_deliverable && (
            <span className={styles.rateTier}>{bestProfile.typical_deliverable.replace(/_/g, ' ')}</span>
          )}
        </div>
      )}

      {brand.geo_presence?.length > 0 && (
        <div className={styles.geoRow}>
          {brand.geo_presence.map(geo => <span key={geo} className={styles.geoChip}>{geo}</span>)}
        </div>
      )}

      {brand.notes && (
        <div className={styles.notesWrap}>
          <p ref={notesRef} className={styles.notes}>{brand.notes}</p>
          {clipped && <span className={styles.readMore}>Read more</span>}
        </div>
      )}

      <div className={styles.cardFooter}>
        <span className={styles.openHint}>{contacted ? 'View outreach history' : 'Click to open & compose outreach'}</span>
      </div>
    </div>
  );
}

// ── ReadinessBanner ───────────────────────────────────────────────────────────

function ReadinessBanner({ ctx, readyCounts }) {
  if (!ctx.tier) {
    return (
      <div className={`${styles.banner} ${styles.bannerNeutral}`}>
        <p className={styles.bannerTitle}>Connect YouTube to see your readiness</p>
        <p className={styles.bannerDesc}>Once connected, each brand card will show whether you're ready to reach out, gifting ready, or still building — based on your actual subscriber count and viability score.</p>
      </div>
    );
  }

  const momentumStr = ctx.avgViews30d != null
    ? ` Avg views per video: ${fmtViews(ctx.avgViews30d)} (30d)${ctx.avgViews60d != null ? ctx.avgViews30d > ctx.avgViews60d * 1.05 ? ' — trending up.' : ctx.avgViews30d < ctx.avgViews60d * 0.95 ? ' — softening vs 60d.' : ' — holding steady.' : '.'}`
    : '';

  if (!ctx.isGiftable && !ctx.isOutreachReady) {
    return (
      <div className={`${styles.banner} ${styles.bannerWarning}`}>
        <p className={styles.bannerTitle}>Not outreach ready yet — but keep going</p>
        <p className={styles.bannerDesc}>
          Your viability score hasn't reached the gifting threshold. Focus on the tasks in your dashboard to close the gap. You can browse brands now to understand the landscape.
          {momentumStr && <>{' '}<strong>{momentumStr}</strong></>}
        </p>
      </div>
    );
  }

  if (ctx.isGiftable && !ctx.isOutreachReady) {
    return (
      <div className={`${styles.banner} ${styles.bannerGifting}`}>
        <p className={styles.bannerTitle}>You're in the gifting tier{readyCounts.gifting > 0 && ` · ${readyCounts.gifting} brand${readyCounts.gifting !== 1 ? 's' : ''} ready for gifting outreach`}</p>
        <p className={styles.bannerDesc}>
          Brands will send you products to review. Lead every outreach with a gifting ask — build the relationship before going for paid deals.
          {momentumStr && <>{' '}<strong>{momentumStr}</strong></>}
        </p>
      </div>
    );
  }

  return (
    <div className={`${styles.banner} ${styles.bannerReady}`}>
      <p className={styles.bannerTitle}>Cleared for outreach{readyCounts.ready > 0 && ` · ${readyCounts.ready} brand${readyCounts.ready !== 1 ? 's' : ''} ready now`}</p>
      <p className={styles.bannerDesc}>
        Your score qualifies you for paid outreach. Brands marked <strong>Reach out now</strong> are your priority — buying window is open and your size is a match. Work through those first.
        {momentumStr && <>{' '}<strong>{momentumStr}</strong></>}
      </p>
    </div>
  );
}

// ── MomentumRow ───────────────────────────────────────────────────────────────

function MomentumPill({ label, value, prev }) {
  const trend = prev != null && value != null ? value > prev * 1.05 ? 'up' : value < prev * 0.95 ? 'down' : 'flat' : null;
  const trendText  = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
  const trendClass = trend === 'up' ? styles.trendUp : trend === 'down' ? styles.trendDown : styles.trendFlat;
  return (
    <div className={styles.momentumPill}>
      <span className={styles.momentumPillLabel}>{label}</span>
      <span className={styles.momentumPillValue}>{fmtViews(value) ?? '—'}</span>
      {trend && <span className={`${styles.momentumPillTrend} ${trendClass}`}>{trendText} vs prev</span>}
    </div>
  );
}

function MomentumRow({ ctx }) {
  if (!ctx.avgViews30d && !ctx.avgViews60d && !ctx.avgViews90d) return null;
  return (
    <div className={styles.momentumRow}>
      <MomentumPill label="Avg Views 30d" value={ctx.avgViews30d} prev={null} />
      <MomentumPill label="Avg Views 60d" value={ctx.avgViews60d} prev={ctx.avgViews30d} />
      <MomentumPill label="Avg Views 90d" value={ctx.avgViews90d} prev={ctx.avgViews60d ?? ctx.avgViews30d} />
    </div>
  );
}

// ── Filters ───────────────────────────────────────────────────────────────────

const CATEGORY_FILTERS = [
  { label: 'All brands',   value: null },
  { label: 'Hardware',     value: 'gaming_hardware' },
  { label: 'Software',     value: 'gaming_software' },
  { label: 'Nutrition',    value: 'gaming_nutrition' },
  { label: 'Apparel',      value: 'gaming_apparel' },
  { label: 'D2C Grooming', value: 'd2c_grooming' },
  { label: 'D2C Wellness', value: 'd2c_wellness' },
  { label: 'D2C Tech',     value: 'd2c_tech_accessories' },
  { label: 'Publishers',   value: 'publisher' },
];

// ── BrandGroup (section header + cards) ──────────────────────────────────────

function BrandGroup({ label, brands, ctx, selectedIds, onSelect, onOpen, showFitBand }) {
  if (!brands.length) return null;
  return (
    <div className={styles.brandGroup}>
      <p className={styles.groupLabel}>{label} <span className={styles.groupCount}>{brands.length}</span></p>
      <div className={styles.grid}>
        {brands.map(brand => (
          <BrandCard
            key={brand.id}
            brand={brand}
            readiness={computeReadiness(brand, ctx)}
            fitBand={showFitBand ? brand._fitBand : null}
            selected={selectedIds.has(brand.id)}
            onSelect={onSelect}
            onClick={() => onOpen(brand)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Outreach ──────────────────────────────────────────────────────────────────

export function Outreach() {
  const [brandsData,      setBrandsData]      = useState(null);
  const [creatorCtxRaw,   setCreatorCtxRaw]   = useState(null);
  const [loading,         setLoading]         = useState(true);
  const [category,        setCategory]        = useState(null);
  const [readyOnly,       setReadyOnly]       = useState(false);
  const [selectedBrand,   setSelectedBrand]   = useState(null);
  const [selectedIds,     setSelectedIds]     = useState(new Set());
  const [broadenSearch,    setBroadenSearch]   = useState(false);
  const [batchStatus,      setBatchStatus]    = useState(null); // null | 'sending' | 'done' | 'error'
  const [discoverOpen,     setDiscoverOpen]   = useState(false);

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
        subscribers:   yt?.subscriber_count ?? null,
        avgViews30d:   yt?.avg_views_per_video_30d ?? null,
        avgViews60d:   yt?.avg_views_per_video_60d ?? null,
        avgViews90d:   yt?.avg_views_per_video_90d ?? null,
      });
    }).finally(() => setLoading(false));
  }, []);

  // Re-fetch brands when category filter changes
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

  // Sorted + fit-annotated brands
  const sortedBrands = useMemo(() => {
    const brands = brandsData?.brands ?? [];
    return sortBrands(brands, creatorCtx).map(b => ({
      ...b,
      _fit:     getBrandFit(niche, b.category),
      _fitBand: getBrandFit(niche, b.category).band,
    }));
  }, [brandsData, creatorCtx, niche]);

  // User-added watchlist brands (shown in a dedicated group)
  const watchlistedBrands = useMemo(
    () => sortedBrands.filter(b => b.is_watchlisted),
    [sortedBrands],
  );

  // Registry-only brands (not user-added) for the niche-grouped view
  const registryBrands = useMemo(
    () => sortedBrands.filter(b => !b.is_watchlisted),
    [sortedBrands],
  );

  const readyCounts = useMemo(() => ({
    ready:   sortedBrands.filter(b => computeReadiness(b, creatorCtx).signal === 'ready').length,
    gifting: sortedBrands.filter(b => computeReadiness(b, creatorCtx).signal === 'gifting').length,
  }), [sortedBrands, creatorCtx]);

  // Apply ready-only filter (registry brands only — watchlisted brands always show)
  const filteredBrands = useMemo(() => {
    if (!readyOnly) return registryBrands;
    return registryBrands.filter(b => { const s = computeReadiness(b, creatorCtx).signal; return s === 'ready' || s === 'gifting'; });
  }, [registryBrands, readyOnly, creatorCtx]);

  // Group by fit band when niche is known
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

  // Handlers
  function handleOutreachLogged(brandId, interactionType) {
    const update = brands => brands.map(b =>
      b.id === brandId ? { ...b, latest_interaction: { interaction_type: interactionType, interaction_date: new Date().toISOString().split('T')[0], deal_notes: null } } : b
    );
    setBrandsData(prev => prev ? { ...prev, brands: update(prev.brands) } : prev);
    setSelectedBrand(prev => prev?.id === brandId ? { ...prev, latest_interaction: { interaction_type: interactionType, interaction_date: new Date().toISOString().split('T')[0], deal_notes: null } } : prev);
  }

  function handleToggleSelect(brandId) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(brandId) ? next.delete(brandId) : next.add(brandId);
      return next;
    });
  }

  function handleBrandsAdded() {
    // Re-fetch brands so newly added watchlist brands appear immediately
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
    } catch {
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
              {readyOnly ? 'Keep building. As your score grows, brands will unlock here.' : category ? 'No brands in this category yet. Try a different filter.' : 'The brand registry is being populated. Check back soon.'}
            </p>
          </div>
        </div>
      )}

      {/* User-added watchlist brands — always shown regardless of filters */}
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
          <BrandGroup
            label="Your niche"
            brands={groupedBrands.core}
            ctx={creatorCtx}
            selectedIds={selectedIds}
            onSelect={handleToggleSelect}
            onOpen={setSelectedBrand}
            showFitBand={false}
          />
          <BrandGroup
            label="Adjacent categories"
            brands={groupedBrands.adjacent}
            ctx={creatorCtx}
            selectedIds={selectedIds}
            onSelect={handleToggleSelect}
            onOpen={setSelectedBrand}
            showFitBand={true}
          />

          {/* Broaden search toggle */}
          {hasBroadBrands && (
            <div className={styles.broadenRow}>
              <button type="button" className={styles.broadenBtn} onClick={() => setBroadenSearch(v => !v)}>
                {broadenSearch ? 'Show fewer brands' : `Broaden search — ${groupedBrands.broad.length} more brand${groupedBrands.broad.length !== 1 ? 's' : ''} outside your niche`}
              </button>
              {!broadenSearch && (
                <p className={styles.broadenHint}>Lower brand fit — different audience, but active creator programmes.</p>
              )}
            </div>
          )}

          {broadenSearch && (
            <BrandGroup
              label="Wider reach"
              brands={groupedBrands.broad}
              ctx={creatorCtx}
              selectedIds={selectedIds}
              onSelect={handleToggleSelect}
              onOpen={setSelectedBrand}
              showFitBand={true}
            />
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

      {/* Batch contact discovery action bar */}
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

      {/* Toast feedback when batch is sent */}
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
