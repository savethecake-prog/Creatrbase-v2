import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '../../layouts/AppLayout/AppLayout';
import { Badge } from '../../components/ui/Badge/Badge';
import { api } from '../../lib/api';
import styles from './Outreach.module.css';

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
  direct:           'Direct programme',
  agency_managed:   'Agency managed',
  platform_managed: 'Platform managed',
  unknown:          'Programme unknown',
};

const CONFIDENCE_VARIANT = {
  established: 'mint',
  partial:     'peach',
  minimal:     'lavender',
};

function formatRate(low, high, currency) {
  const sym = currency === 'USD' ? '$' : '£';
  const fmt = n => {
    const pounds = Math.round(n / 100);
    return pounds >= 1000 ? `${sym}${(pounds / 1000).toFixed(1)}k` : `${sym}${pounds}`;
  };
  if (!low && !high) return null;
  if (low && high) return `${fmt(low)} – ${fmt(high)}`;
  if (high)        return `up to ${fmt(high)}`;
  return fmt(low);
}

function bestWindow(tierProfiles) {
  // Take the first profile — already sorted active → warming → ... in SQL
  return tierProfiles?.[0] ?? null;
}

// ── BrandCard ─────────────────────────────────────────────────────────────────

function BrandCard({ brand }) {
  const window    = bestWindow(brand.tier_profiles);
  const isActive  = window?.buying_window_status === 'active';
  const isWarming = window?.buying_window_status === 'warming';

  const rateStr = window ? formatRate(
    window.rate_range_low,
    window.rate_range_high,
    window.rate_currency
  ) : null;

  const cardClass = [
    styles.card,
    isActive  ? styles.cardActive  : '',
    isWarming ? styles.cardWarming : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={cardClass}>
      <div className={styles.cardHead}>
        <p className={styles.brandName}>{brand.brand_name}</p>
        <Badge variant={CONFIDENCE_VARIANT[brand.registry_confidence] ?? 'lavender'}>
          {brand.registry_confidence}
        </Badge>
      </div>

      {(isActive || isWarming) && (
        <div className={isActive ? styles.windowActive : styles.windowWarming}>
          <div className={`${styles.windowStrip} ${isActive ? styles.windowActive : styles.windowWarming}`}>
            <span className={styles.windowDot} />
            {isActive ? 'Buying now' : 'Warming up'}
            {window.creator_tier && ` · ${window.creator_tier}`}
          </div>
        </div>
      )}

      <div className={styles.meta}>
        <span className={styles.categoryLabel}>
          {CATEGORY_LABELS[brand.category] ?? brand.category}
        </span>
        {brand.sub_category && (
          <>
            <span className={styles.metaDivider} />
            <span className={styles.programmeLabel}>{brand.sub_category.replace(/_/g, ' ')}</span>
          </>
        )}
        <span className={styles.metaDivider} />
        <span className={styles.programmeLabel}>
          {PROGRAMME_LABELS[brand.creator_programme_type] ?? brand.creator_programme_type}
        </span>
      </div>

      {rateStr && (
        <div className={styles.rateRow}>
          <span className={styles.rateLabel}>Rate</span>
          <span className={styles.rateValue}>{rateStr}</span>
          {window.typical_deliverable && (
            <span className={styles.rateTier}>
              {window.typical_deliverable.replace(/_/g, ' ')}
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
        <p className={styles.notes}>{brand.notes}</p>
      )}

      <div className={styles.actions}>
        {brand.partnership_email && (
          <a
            href={`mailto:${brand.partnership_email}`}
            className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
          >
            Email partnerships
          </a>
        )}
        {brand.partnership_url && (
          <a
            href={brand.partnership_url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.actionBtn}
          >
            Programme page
          </a>
        )}
        {brand.website && !brand.partnership_email && !brand.partnership_url && (
          <a
            href={brand.website}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.actionBtn}
          >
            Visit website
          </a>
        )}
      </div>
    </div>
  );
}

// ── Outreach ──────────────────────────────────────────────────────────────────

const FILTERS = [
  { label: 'All brands',    value: null },
  { label: 'Hardware',      value: 'gaming_hardware' },
  { label: 'Software',      value: 'gaming_software' },
  { label: 'Nutrition',     value: 'gaming_nutrition' },
  { label: 'Apparel',       value: 'gaming_apparel' },
  { label: 'D2C Grooming',  value: 'd2c_grooming' },
  { label: 'D2C Wellness',  value: 'd2c_wellness' },
  { label: 'D2C Tech',      value: 'd2c_tech_accessories' },
  { label: 'Publishers',    value: 'publisher' },
];

export function Outreach() {
  const [data,     setData]     = useState(null);   // { brands, niche }
  const [loading,  setLoading]  = useState(true);
  const [category, setCategory] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.get('/brands')
      .then(res => setData(res))
      .catch(() => setData({ brands: [], niche: null }))
      .finally(() => setLoading(false));
  }, []);

  // Re-fetch when category filter changes
  useEffect(() => {
    if (data === null) return; // skip initial — handled by first effect
    const path = category ? `/brands?category=${encodeURIComponent(category)}` : '/brands';
    api.get(path)
      .then(res => setData(res))
      .catch(() => {});
  }, [category]);

  const brands = data?.brands ?? [];
  const niche  = data?.niche  ?? null;

  // Only show filters that have at least one brand in the full set
  const activeBrandCategories = useMemo(() => {
    if (!data?.brands) return new Set();
    return new Set(data.brands.map(b => b.category));
  }, [data]);

  const visibleFilters = FILTERS.filter(
    f => f.value === null || activeBrandCategories.has(f.value)
  );

  return (
    <AppLayout>
      <div className={styles.header}>
        <h1 className={styles.title}>Brand Outreach</h1>
        <p className={styles.subtitle}>
          Brands actively buying in your space. Contact info, programme intelligence, and buying window signals in one place.
        </p>
        {niche && (
          <span className={styles.nicheHint}>
            Showing brands matched to: {niche.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      <div className={styles.filterBar}>
        {visibleFilters.map(f => (
          <button
            key={f.value ?? 'all'}
            className={[
              styles.filterChip,
              category === f.value ? styles.filterChipActive : '',
            ].filter(Boolean).join(' ')}
            onClick={() => setCategory(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className={styles.grid}>
        {loading && (
          <div className={styles.loadingRow}>
            <div className={styles.skeleton} />
            <div className={styles.skeleton} />
          </div>
        )}

        {!loading && brands.length === 0 && (
          <div className={styles.stateCard}>
            <p className={styles.stateTitle}>No brands found</p>
            <p className={styles.stateDesc}>
              {category
                ? 'No brands in this category yet. Try a different filter.'
                : 'The brand registry is being populated. Check back soon.'}
            </p>
          </div>
        )}

        {!loading && brands.map(brand => (
          <BrandCard key={brand.id} brand={brand} />
        ))}
      </div>
    </AppLayout>
  );
}
