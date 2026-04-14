import { useState, useEffect, useRef, useMemo } from 'react';
import { AppLayout } from '../../layouts/AppLayout/AppLayout';
import { Badge } from '../../components/ui/Badge/Badge';
import { BrandModal } from './BrandModal';
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

// ── Readiness computation ─────────────────────────────────────────────────────
//
// signal:
//   'ready'      — cleared for paid outreach to this brand
//   'gifting'    — right size for gifting; not paid yet
//   'approaching'— one step away; tier exists but gap remains
//   'not_yet'    — meaningfully below what this brand works with
//   'no_data'    — brand has no tier intelligence yet
//   'no_context' — creator has no platform connected

function computeReadiness(brand, ctx) {
  const { tier, subscribers, isGiftable, isOutreachReady } = ctx;

  if (!tier) {
    return {
      signal: 'no_context',
      label:  'Connect YouTube',
      reason: 'Connect your YouTube channel to see personalised readiness signals.',
    };
  }

  const profiles = brand.tier_profiles ?? [];

  if (profiles.length === 0) {
    if (isOutreachReady) return { signal: 'ready',    label: 'Reach out',           reason: 'No tier data on file, but your score qualifies you. Worth contacting.' };
    if (isGiftable)      return { signal: 'gifting',  label: 'Gifting ready',       reason: 'No rate data yet. Try reaching out about gifting or samples.' };
    return                      { signal: 'no_data',  label: 'No tier data',         reason: "We don't have intel on this brand's programme yet. Check their site directly." };
  }

  const exactProfile = profiles.find(tp => tp.creator_tier === tier);
  const sortedByTier = [...profiles].sort((a, b) => TIER_RANK[a.creator_tier] - TIER_RANK[b.creator_tier]);
  const lowestProfile = sortedByTier[0];

  if (!exactProfile) {
    const creatorRank = TIER_RANK[tier] ?? 0;
    const lowestRank  = TIER_RANK[lowestProfile?.creator_tier] ?? 99;

    if (creatorRank < lowestRank) {
      const gap = lowestRank - creatorRank;
      if (gap === 1) return { signal: 'approaching', label: 'Building towards this', reason: `Brand works with ${lowestProfile.creator_tier} creators — you're one tier away.` };
      return                { signal: 'not_yet',     label: 'Not yet',               reason: `Brand works with ${lowestProfile.creator_tier} creators and above.` };
    }

    // Creator is bigger than any documented tier
    if (isOutreachReady) return { signal: 'ready',    label: 'Reach out',           reason: "Your size is above their documented range — strong position to negotiate." };
    return                      { signal: 'approaching', label: 'Building towards this', reason: 'No tier data for your size yet, but you may already be above their typical range.' };
  }

  // Exact tier match — check subscriber minimum
  const minSubs   = exactProfile.min_subscribers_observed;
  const hasWindow = exactProfile.buying_window_status === 'active' || exactProfile.buying_window_status === 'warming';

  if (minSubs && subscribers < minSubs) {
    const gap    = minSubs - subscribers;
    const fmtGap = gap >= 1000 ? `${(gap / 1000).toFixed(gap >= 10000 ? 0 : 1)}k` : gap.toLocaleString();
    return { signal: 'approaching', label: 'Building towards this', reason: `${fmtGap} more subscribers to meet their observed minimum.` };
  }

  // Meets threshold — now check window + milestones
  if (hasWindow && isOutreachReady) return { signal: 'ready',    label: 'Reach out now',         reason: `Buying in the ${tier} tier right now and your score qualifies. Go.` };
  if (hasWindow && isGiftable)      return { signal: 'gifting',  label: 'Gifting ready',         reason: `Window open in your tier — reach out about gifting to start the relationship.` };
  if (hasWindow)                    return { signal: 'approaching', label: 'Window open — almost', reason: 'Buying window is live but your viability score isn\'t at outreach level yet. Keep growing.' };
  if (isOutreachReady)              return { signal: 'ready',    label: 'Reach out',             reason: 'Tier match and your score qualifies. No active window but worth making contact.' };
  if (isGiftable)                   return { signal: 'gifting',  label: 'Gifting ready',         reason: 'Tier match. Lead with a gifting ask — build the relationship before going paid.' };
  return                                   { signal: 'approaching', label: 'Building towards this', reason: 'Tier match exists but your viability score isn\'t at outreach level yet.' };
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
  const fmt = n => {
    const v = Math.round(n / 100);
    return v >= 1000 ? `${sym}${(v / 1000).toFixed(1)}k` : `${sym}${v}`;
  };
  if (!low && !high) return null;
  if (low && high)   return `${fmt(low)} – ${fmt(high)}`;
  if (high)          return `up to ${fmt(high)}`;
  return fmt(low);
}

// ── ReadinessStrip ────────────────────────────────────────────────────────────

function ReadinessStrip({ readiness }) {
  const { signal, label, reason } = readiness;
  if (signal === 'no_context') return null;

  const stripClass = {
    ready:      styles.stripReady,
    gifting:    styles.stripGifting,
    approaching:styles.stripApproaching,
    not_yet:    styles.stripNotYet,
    no_data:    styles.stripNoData,
  }[signal] ?? styles.stripNoData;

  return (
    <div className={`${styles.readinessStrip} ${stripClass}`}>
      <span className={styles.stripLabel}>{label}</span>
      <span className={styles.stripReason}>{reason}</span>
    </div>
  );
}

// ── BrandCard ─────────────────────────────────────────────────────────────────

function BrandCard({ brand, readiness, onClick }) {
  const notesRef  = useRef(null);
  const [clipped, setClipped] = useState(false);

  useEffect(() => {
    const el = notesRef.current;
    if (el) setClipped(el.scrollHeight > el.clientHeight + 2);
  }, [brand.notes]);

  const bestProfile = brand.tier_profiles?.[0] ?? null;
  const contacted   = !!brand.latest_interaction;
  const rateStr     = bestProfile
    ? formatRate(bestProfile.rate_range_low, bestProfile.rate_range_high, bestProfile.rate_currency)
    : null;

  const progLabel = PROGRAMME_LABELS[brand.creator_programme_type];

  const cardClass = [
    styles.card,
    readiness.signal === 'ready'       ? styles.cardReady    : '',
    readiness.signal === 'gifting'     ? styles.cardGifting  : '',
    readiness.signal === 'not_yet'     ? styles.cardNotYet   : '',
    contacted                          ? styles.cardContacted : '',
  ].filter(Boolean).join(' ');

  return (
    <button className={cardClass} onClick={onClick} type="button">

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
        <span className={styles.categoryLabel}>
          {CATEGORY_LABELS[brand.category] ?? brand.category}
        </span>
        {progLabel && (
          <>
            <span className={styles.metaDivider} />
            <span className={styles.programmeLabel}>{progLabel}</span>
          </>
        )}
      </div>

      {rateStr && (
        <div className={styles.rateRow}>
          <span className={styles.rateLabel}>Rate</span>
          <span className={styles.rateValue}>{rateStr}</span>
          {bestProfile.typical_deliverable && (
            <span className={styles.rateTier}>
              {bestProfile.typical_deliverable.replace(/_/g, ' ')}
            </span>
          )}
        </div>
      )}

      {brand.geo_presence?.length > 0 && (
        <div className={styles.geoRow}>
          {brand.geo_presence.map(geo => (
            <span key={geo} className={styles.geoChip}>{geo}</span>
          ))}
        </div>
      )}

      {brand.notes && (
        <div className={styles.notesWrap}>
          <p ref={notesRef} className={styles.notes}>{brand.notes}</p>
          {clipped && <span className={styles.readMore}>Read more</span>}
        </div>
      )}

      <div className={styles.cardFooter}>
        <span className={styles.openHint}>
          {contacted ? 'View outreach history' : 'Click to open & compose outreach'}
        </span>
      </div>
    </button>
  );
}

// ── ReadinessBanner ───────────────────────────────────────────────────────────

function ReadinessBanner({ ctx, readyCounts }) {
  if (!ctx.tier) {
    return (
      <div className={`${styles.banner} ${styles.bannerNeutral}`}>
        <p className={styles.bannerTitle}>Connect YouTube to see your readiness</p>
        <p className={styles.bannerDesc}>
          Once connected, each brand card will show whether you're ready to reach out, gifting ready, or still building — based on your actual subscriber count and viability score.
        </p>
      </div>
    );
  }

  if (!ctx.isGiftable && !ctx.isOutreachReady) {
    return (
      <div className={`${styles.banner} ${styles.bannerWarning}`}>
        <p className={styles.bannerTitle}>Not outreach ready yet — but keep going</p>
        <p className={styles.bannerDesc}>
          Your viability score hasn't reached the gifting threshold. Focus on the tasks in your dashboard to close the gap. You can browse brands now to understand the landscape.
        </p>
      </div>
    );
  }

  if (ctx.isGiftable && !ctx.isOutreachReady) {
    return (
      <div className={`${styles.banner} ${styles.bannerGifting}`}>
        <p className={styles.bannerTitle}>
          You're in the gifting tier
          {readyCounts.gifting > 0 && ` · ${readyCounts.gifting} brand${readyCounts.gifting !== 1 ? 's' : ''} ready for gifting outreach`}
        </p>
        <p className={styles.bannerDesc}>
          Brands will send you products to review. Lead every outreach with a gifting ask — build the relationship before going for paid deals. This is the right move at your current stage.
        </p>
      </div>
    );
  }

  // isOutreachReady
  return (
    <div className={`${styles.banner} ${styles.bannerReady}`}>
      <p className={styles.bannerTitle}>
        Cleared for outreach
        {readyCounts.ready > 0 && ` · ${readyCounts.ready} brand${readyCounts.ready !== 1 ? 's' : ''} ready now`}
      </p>
      <p className={styles.bannerDesc}>
        Your score qualifies you for paid outreach. Brands marked <strong>Reach out now</strong> are your priority — buying window is open and your size is a match. Work through those first.
      </p>
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

// ── Outreach ──────────────────────────────────────────────────────────────────

export function Outreach() {
  const [brandsData,    setBrandsData]    = useState(null);
  const [creatorCtxRaw, setCreatorCtxRaw] = useState(null); // { milestones, subscribers }
  const [loading,       setLoading]       = useState(true);
  const [category,      setCategory]      = useState(null);
  const [readyOnly,     setReadyOnly]     = useState(false);
  const [selectedBrand, setSelectedBrand] = useState(null);

  // Parallel fetch: brands + score + platforms
  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      api.get('/brands'),
      api.get('/creator/score'),
      api.get('/connect/platforms'),
    ]).then(([brandsRes, scoreRes, platformsRes]) => {
      setBrandsData(brandsRes.status === 'fulfilled' ? brandsRes.value : { brands: [], niche: null });

      const milestones  = scoreRes.status === 'fulfilled' ? (scoreRes.value.milestones ?? []) : [];
      const platforms   = platformsRes.status === 'fulfilled' ? (platformsRes.value.platforms ?? []) : [];
      const yt          = platforms.find(p => p.platform === 'youtube');
      const subscribers = yt?.subscriber_count ?? null;
      setCreatorCtxRaw({ milestones, subscribers });
    }).finally(() => setLoading(false));
  }, []);

  // Re-fetch brands on category change
  useEffect(() => {
    if (brandsData === null) return;
    const path = category ? `/brands?category=${encodeURIComponent(category)}` : '/brands';
    api.get(path).then(res => setBrandsData(res)).catch(() => {});
  }, [category]);

  // Build creator context object
  const creatorCtx = useMemo(() => {
    if (!creatorCtxRaw) return { tier: null, subscribers: null, isGiftable: false, isOutreachReady: false };
    const { milestones, subscribers } = creatorCtxRaw;
    const crossed = type => milestones.some(m => m.type === type && m.status === 'crossed');
    return {
      tier:           getCreatorTier(subscribers),
      subscribers,
      isGiftable:     crossed('giftable'),
      isOutreachReady:crossed('outreach_ready'),
    };
  }, [creatorCtxRaw]);

  // Compute readiness + sort
  const sortedBrands = useMemo(() => {
    const brands = brandsData?.brands ?? [];
    return sortBrands(brands, creatorCtx);
  }, [brandsData, creatorCtx]);

  // Count ready brands for the banner
  const readyCounts = useMemo(() => ({
    ready:   sortedBrands.filter(b => computeReadiness(b, creatorCtx).signal === 'ready').length,
    gifting: sortedBrands.filter(b => computeReadiness(b, creatorCtx).signal === 'gifting').length,
  }), [sortedBrands, creatorCtx]);

  // Apply ready-only filter if toggled
  const displayBrands = useMemo(() => {
    if (!readyOnly) return sortedBrands;
    return sortedBrands.filter(b => {
      const s = computeReadiness(b, creatorCtx).signal;
      return s === 'ready' || s === 'gifting';
    });
  }, [sortedBrands, readyOnly, creatorCtx]);

  // Visible category filter chips
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

  const niche = brandsData?.niche ?? null;

  return (
    <AppLayout>
      <div className={styles.header}>
        <h1 className={styles.title}>Brand Outreach</h1>
        <p className={styles.subtitle}>
          Every brand card is scored against your current size and viability — so you know exactly who to contact and why.
        </p>
        {niche && <span className={styles.nicheHint}>Matched to: {niche.replace(/_/g, ' ')}</span>}
      </div>

      {!loading && <ReadinessBanner ctx={creatorCtx} readyCounts={readyCounts} />}

      <div className={styles.filterBar}>
        {visibleFilters.map(f => (
          <button
            key={f.value ?? 'all'}
            type="button"
            className={[styles.filterChip, category === f.value ? styles.filterChipActive : ''].filter(Boolean).join(' ')}
            onClick={() => setCategory(f.value)}
          >
            {f.label}
          </button>
        ))}

        <div className={styles.filterDivider} />

        <button
          type="button"
          className={[styles.filterChip, readyOnly ? styles.filterChipReady : ''].filter(Boolean).join(' ')}
          onClick={() => setReadyOnly(v => !v)}
        >
          {readyOnly ? 'Show all' : 'Ready for me only'}
        </button>
      </div>

      <div className={styles.grid}>
        {loading && (
          <div className={styles.loadingRow}>
            <div className={styles.skeleton} />
            <div className={styles.skeleton} />
          </div>
        )}

        {!loading && displayBrands.length === 0 && (
          <div className={styles.stateCard}>
            <p className={styles.stateTitle}>
              {readyOnly ? 'No brands ready for you yet' : 'No brands found'}
            </p>
            <p className={styles.stateDesc}>
              {readyOnly
                ? 'Keep building. As your score grows, brands will unlock here.'
                : category
                  ? 'No brands in this category yet. Try a different filter.'
                  : 'The brand registry is being populated. Check back soon.'}
            </p>
          </div>
        )}

        {!loading && displayBrands.map(brand => (
          <BrandCard
            key={brand.id}
            brand={brand}
            readiness={computeReadiness(brand, creatorCtx)}
            onClick={() => setSelectedBrand(brand)}
          />
        ))}
      </div>

      {selectedBrand && (
        <BrandModal
          brand={selectedBrand}
          niche={niche}
          onClose={() => setSelectedBrand(null)}
          onOutreachLogged={handleOutreachLogged}
        />
      )}
    </AppLayout>
  );
}
