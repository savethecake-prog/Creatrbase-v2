// Pure utility functions and constants for the Outreach page

// ── Creator tier derivation ───────────────────────────────────────────────────

const TIER_RANK = { micro: 0, rising: 1, mid: 2, established: 3 };

export function getCreatorTier(subscribers) {
  if (subscribers == null) return null;
  if (subscribers >= 250000) return 'established';
  if (subscribers >= 50000)  return 'mid';
  if (subscribers >= 10000)  return 'rising';
  return 'micro';
}

// ── View momentum helpers ─────────────────────────────────────────────────────

export function fmtViews(n) {
  if (n == null) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return Math.round(n).toLocaleString();
}

export function viewMomentumSignal(avgViews30d, subscribers) {
  if (avgViews30d == null || !subscribers) return null;
  const ratio = avgViews30d / subscribers;
  if (ratio >= 0.30) return 'strong';
  if (ratio >= 0.10) return 'average';
  return 'weak';
}

// ── Niche fit scoring ─────────────────────────────────────────────────────────

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
const FALLBACK_MAP = {
  core: [],
  adjacent: ['publisher','d2c_tech_accessories','d2c_wellness'],
  broad:    ['gaming_hardware','gaming_software','gaming_nutrition','gaming_apparel','d2c_grooming','other'],
};

export function getBrandFit(creatorNiche, brandCategory) {
  const key = (creatorNiche || '').toLowerCase().trim();
  const map = NICHE_MAPS[key] || FALLBACK_MAP;
  if (map.core.includes(brandCategory))     return { band: 'core',     label: 'Your niche',          score: 1.00 };
  if (map.adjacent.includes(brandCategory)) return { band: 'adjacent', label: 'Adjacent categories', score: 0.65 };
  if (map.broad.includes(brandCategory))    return { band: 'broad',    label: 'Wider reach',         score: 0.35 };
  return                                           { band: 'outside',  label: 'Long shot',           score: 0.15 };
}

// ── Readiness computation ─────────────────────────────────────────────────────

export function computeReadiness(brand, ctx) {
  const { tier, subscribers, isGiftable, isOutreachReady, avgViews30d } = ctx;
  const momentum = viewMomentumSignal(avgViews30d, subscribers);

  if (!tier) {
    return { signal: 'no_context', label: 'Connect YouTube', reason: 'Connect your YouTube channel to see personalised readiness signals.' };
  }

  const profiles = brand.tier_profiles ?? [];

  if (profiles.length === 0) {
    if (isOutreachReady) return { signal: 'ready',   label: 'Reach out',     reason: 'No tier data on file, but your score qualifies you. Worth contacting.' };
    if (isGiftable)      return { signal: 'gifting', label: 'Gifting ready', reason: 'No rate data yet. Try reaching out about gifting or samples.' };
    return                      { signal: 'no_data', label: 'No tier data',  reason: "We don't have intel on this brand's programme yet. Check their site directly." };
  }

  const exactProfile  = profiles.find(tp => tp.creator_tier === tier);
  const sortedByTier  = [...profiles].sort((a, b) => TIER_RANK[a.creator_tier] - TIER_RANK[b.creator_tier]);
  const lowestProfile = sortedByTier[0];

  if (!exactProfile) {
    const creatorRank = TIER_RANK[tier] ?? 0;
    const lowestRank  = TIER_RANK[lowestProfile?.creator_tier] ?? 99;
    if (creatorRank < lowestRank) {
      const gap = lowestRank - creatorRank;
      if (gap === 1) return { signal: 'approaching', label: 'Building towards this', reason: `Brand works with ${lowestProfile.creator_tier} creators — you're one tier away.` };
      return               { signal: 'not_yet',      label: 'Not yet',               reason: `Brand works with ${lowestProfile.creator_tier} creators and above.` };
    }
    if (isOutreachReady) return { signal: 'ready',       label: 'Reach out',             reason: "Your size is above their documented range — strong position to negotiate." };
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
  if (hasWindow && isGiftable)   return { signal: 'gifting',     label: 'Gifting ready',        reason: `Window open in your tier — reach out about gifting to start the relationship.` };
  if (hasWindow)                 return { signal: 'approaching', label: 'Window open — almost', reason: "Buying window is live but your viability score isn't at outreach level yet. Keep growing." };
  if (isOutreachReady) {
    const extra = momentum === 'strong' ? ` Avg views are strong — lead with that in your pitch.` : momentum === 'weak' ? ` Avg views are currently soft — worth addressing in your pitch.` : '';
    return { signal: 'ready', label: 'Reach out', reason: `Tier match and your score qualifies. No active window but worth making contact.${extra}` };
  }
  if (isGiftable) return { signal: 'gifting',     label: 'Gifting ready',         reason: 'Tier match. Lead with a gifting ask — build the relationship before going paid.' };
  return                { signal: 'approaching', label: 'Building towards this',  reason: "Tier match exists but your viability score isn't at outreach level yet." };
}

// ── Sort brands by readiness ──────────────────────────────────────────────────

const SIGNAL_RANK = { ready: 0, gifting: 1, approaching: 2, no_data: 3, not_yet: 4, no_context: 5 };

export function sortBrands(brands, ctx) {
  return [...brands].sort((a, b) => {
    const ra = computeReadiness(a, ctx);
    const rb = computeReadiness(b, ctx);
    const diff = (SIGNAL_RANK[ra.signal] ?? 9) - (SIGNAL_RANK[rb.signal] ?? 9);
    return diff !== 0 ? diff : a.brand_name.localeCompare(b.brand_name);
  });
}

// ── Category labels ───────────────────────────────────────────────────────────

export const CATEGORY_LABELS = {
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

export const PROGRAMME_LABELS = {
  direct:           'Direct',
  agency_managed:   'Agency managed',
  platform_managed: 'Platform managed',
  unknown:          null,
};

export const CONFIDENCE_VARIANT = {
  established: 'mint',
  partial:     'peach',
  minimal:     'lavender',
};

export function formatRate(low, high, currency) {
  const sym = currency === 'USD' ? '$' : '£';
  const fmt = n => { const v = Math.round(n / 100); return v >= 1000 ? `${sym}${(v / 1000).toFixed(1)}k` : `${sym}${v}`; };
  if (!low && !high) return null;
  if (low && high)   return `${fmt(low)} – ${fmt(high)}`;
  if (high)          return `up to ${fmt(high)}`;
  return fmt(low);
}

export const CATEGORY_FILTERS = [
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
