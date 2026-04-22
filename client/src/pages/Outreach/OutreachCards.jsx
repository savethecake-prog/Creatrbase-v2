// BrandCard, ReadinessStrip, ReadinessBanner, MomentumPill/Row, BrandGroup
import { useState, useEffect, useRef } from 'react';
import { Badge } from '../../components/ui/Badge/Badge';
import {
  computeReadiness, fmtViews,
  CATEGORY_LABELS, PROGRAMME_LABELS, CONFIDENCE_VARIANT, formatRate,
} from './outreachUtils';
import styles from './Outreach.module.css';

// ── ReadinessStrip ────────────────────────────────────────────────────────────

export function ReadinessStrip({ readiness }) {
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

export function BrandCard({ brand, readiness, fitBand, onClick, selected, onSelect }) {
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

export function ReadinessBanner({ ctx, readyCounts }) {
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

export function MomentumRow({ ctx }) {
  if (!ctx.avgViews30d && !ctx.avgViews60d && !ctx.avgViews90d) return null;
  return (
    <div className={styles.momentumRow}>
      <MomentumPill label="Avg Views 30d" value={ctx.avgViews30d} prev={null} />
      <MomentumPill label="Avg Views 60d" value={ctx.avgViews60d} prev={ctx.avgViews30d} />
      <MomentumPill label="Avg Views 90d" value={ctx.avgViews90d} prev={ctx.avgViews60d ?? ctx.avgViews30d} />
    </div>
  );
}

// ── BrandGroup ────────────────────────────────────────────────────────────────

export function BrandGroup({ label, brands, ctx, selectedIds, onSelect, onOpen, showFitBand }) {
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
