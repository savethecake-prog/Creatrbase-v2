import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../../layouts/AppLayout/AppLayout';
import { Badge } from '../../components/ui/Badge/Badge';
import { HintCallout } from '../../components/ui/HintCallout/HintCallout';
import { DealModal } from './DealModal';
import { api } from '../../lib/api';
import styles from './Negotiations.module.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

const STAGE_META = {
  outreach_sent:        { label: 'Outreach sent',  group: 'pipeline', dot: styles.dotActive },
  outreach_responded:   { label: 'Responded',       group: 'pipeline', dot: styles.dotActive },
  deal_negotiating:     { label: 'Negotiating',     group: 'negotiating', dot: styles.dotNegotiating },
  deal_completed:       { label: 'Deal completed',  group: 'won',     dot: styles.dotWon },
  relationship_ongoing: { label: 'Ongoing',         group: 'won',     dot: styles.dotWon },
  outreach_declined:    { label: 'Declined',        group: 'lost',    dot: styles.dotLost },
};

const BADGE_VARIANT = {
  outreach_sent:        'peach',
  outreach_responded:   'peach',
  deal_negotiating:     'lavender',
  deal_completed:       'mint',
  relationship_ongoing: 'mint',
  outreach_declined:    'error',
};

const CATEGORY_LABELS = {
  gaming_hardware:      'Gaming Hardware',
  gaming_software:      'Gaming Software',
  gaming_nutrition:     'Gaming Nutrition',
  gaming_apparel:       'Gaming Apparel',
  d2c_grooming:         'D2C Grooming',
  d2c_wellness:         'D2C Wellness',
  d2c_tech_accessories: 'D2C Tech',
  publisher:            'Publisher',
  other:                'Other',
};

function fmtRate(pence, currency) {
  if (pence == null) return null;
  const sym = currency === 'USD' ? '$' : '£';
  const v   = Math.round(pence / 100);
  return v >= 1000 ? `${sym}${(v / 1000).toFixed(1)}k` : `${sym}${v}`;
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

// ── DealCard ──────────────────────────────────────────────────────────────────

function DealCard({ deal, onClick }) {
  const meta    = STAGE_META[deal.interaction_type] ?? { label: deal.interaction_type, dot: styles.dotActive };
  const group   = meta.group;
  const rateStr = fmtRate(deal.agreed_rate ?? deal.offered_rate, deal.rate_currency);

  const cardClass = [
    styles.card,
    group === 'negotiating' ? styles.cardNegotiating : '',
    group === 'won'         ? styles.cardWon         : '',
    group === 'lost'        ? styles.cardLost        : '',
  ].filter(Boolean).join(' ');

  return (
    <button className={cardClass} onClick={onClick} type="button">
      <span className={`${styles.stageDot} ${meta.dot}`} />

      <div className={styles.cardBody}>
        <div className={styles.cardTop}>
          <span className={styles.brandName}>{deal.brand_name}</span>
          <Badge variant={BADGE_VARIANT[deal.interaction_type] ?? 'lavender'}>
            {meta.label}
          </Badge>
        </div>
        <div className={styles.cardMeta}>
          {deal.category && (
            <span className={styles.metaItem}>{CATEGORY_LABELS[deal.category] ?? deal.category}</span>
          )}
          {deal.last_updated_at && (
            <>
              <span className={styles.metaDivider} />
              <span className={styles.metaItem}>Updated {fmtDate(deal.last_updated_at)}</span>
            </>
          )}
          {deal.deliverable_type && (
            <>
              <span className={styles.metaDivider} />
              <span className={styles.metaItem}>{deal.deliverable_type.replace(/_/g, ' ')}</span>
            </>
          )}
        </div>
        {deal.deal_notes && (
          <p className={styles.cardNotes}>{deal.deal_notes}</p>
        )}
      </div>

      {rateStr && (
        <div className={styles.rateDisplay}>
          <span className={styles.rateLabel}>
            {deal.agreed_rate != null ? 'Agreed' : 'Offered'}
          </span>
          <span className={styles.rateValue}>{rateStr}</span>
        </div>
      )}

      <span className={styles.chevron}>›</span>
    </button>
  );
}

// ── Negotiations ──────────────────────────────────────────────────────────────

export function Negotiations() {
  const [deals,       setDeals]       = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [activeDeal,  setActiveDeal]  = useState(null);

  useEffect(() => {
    api.get('/negotiations')
      .then(res => setDeals(res.deals))
      .catch(() => setDeals([]))
      .finally(() => setLoading(false));
  }, []);

  function handleUpdated(brandId, newInteractionType) {
    setDeals(prev =>
      prev?.map(d =>
        d.brand_id === brandId
          ? {
              ...d,
              interaction_type: newInteractionType,
              last_updated_at:  new Date().toISOString(),
            }
          : d
      ) ?? prev
    );
    // Keep modal open but update the deal it holds
    setActiveDeal(prev =>
      prev?.brand_id === brandId
        ? { ...prev, interaction_type: newInteractionType, last_updated_at: new Date().toISOString() }
        : prev
    );
  }

  const pipeline    = deals?.filter(d => STAGE_META[d.interaction_type]?.group === 'pipeline')    ?? [];
  const negotiating = deals?.filter(d => STAGE_META[d.interaction_type]?.group === 'negotiating') ?? [];
  const won         = deals?.filter(d => STAGE_META[d.interaction_type]?.group === 'won')         ?? [];
  const lost        = deals?.filter(d => STAGE_META[d.interaction_type]?.group === 'lost')        ?? [];

  const isEmpty = !loading && deals?.length === 0;

  return (
    <AppLayout>
      <HintCallout
        storageKey="cb_hint_negotiations_v1"
        eyebrow="How this works"
        heading="Log every deal. Never let one go cold."
      >
        Add a deal when you start any brand conversation — outreach sent, reply received, negotiating, or closed. Creatrbase tracks the timeline and sends you a nudge if a deal goes quiet for 7+ days. Completed deals count towards your commercial viability score.
      </HintCallout>
      <div className={styles.header}>
        <h1 className={styles.title}>Negotiations</h1>
        <p className={styles.subtitle}>
          Track every brand conversation from first outreach to deal signed.
        </p>
      </div>

      {loading && <p className={styles.loadingHint}>Loading pipeline…</p>}

      {isEmpty && (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>No deals in your pipeline yet</p>
          <p className={styles.emptyDesc}>
            Send outreach to a brand via the Compose tab and it will appear here automatically.
            Replies are detected and tracked without any manual input.
          </p>
          <Link to="/outreach" className={styles.emptyLink}>Go to Brand Outreach →</Link>
        </div>
      )}

      {!loading && !isEmpty && (
        <>
          {negotiating.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <p className={styles.sectionTitle}>Negotiating</p>
                <span className={styles.sectionCount}>{negotiating.length}</span>
              </div>
              <div className={styles.dealList}>
                {negotiating.map(d => (
                  <DealCard key={d.brand_id} deal={d} onClick={() => setActiveDeal(d)} />
                ))}
              </div>
            </section>
          )}

          {pipeline.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <p className={styles.sectionTitle}>In Conversation</p>
                <span className={styles.sectionCount}>{pipeline.length}</span>
              </div>
              <div className={styles.dealList}>
                {pipeline.map(d => (
                  <DealCard key={d.brand_id} deal={d} onClick={() => setActiveDeal(d)} />
                ))}
              </div>
            </section>
          )}

          {won.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <p className={styles.sectionTitle}>Won</p>
                <span className={styles.sectionCount}>{won.length}</span>
              </div>
              <div className={styles.dealList}>
                {won.map(d => (
                  <DealCard key={d.brand_id} deal={d} onClick={() => setActiveDeal(d)} />
                ))}
              </div>
            </section>
          )}

          {lost.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <p className={styles.sectionTitle}>Declined</p>
                <span className={styles.sectionCount}>{lost.length}</span>
              </div>
              <div className={styles.dealList}>
                {lost.map(d => (
                  <DealCard key={d.brand_id} deal={d} onClick={() => setActiveDeal(d)} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {activeDeal && (
        <DealModal
          deal={activeDeal}
          onClose={() => setActiveDeal(null)}
          onUpdated={handleUpdated}
        />
      )}
    </AppLayout>
  );
}
