import { formatRate } from './brandModalUtils';
import styles from './BrandModal.module.css';

export function BrandModalDetails({ brand }) {
  return (
    <>
      {brand.notes && (
        <div className={styles.section}>
          <p className={styles.sectionLabel}>Programme intelligence</p>
          <p className={styles.notes}>{brand.notes}</p>
        </div>
      )}

      {brand.geo_presence?.length > 0 && (
        <div className={styles.section}>
          <p className={styles.sectionLabel}>Geographic presence</p>
          <div className={styles.geoRow}>
            {brand.geo_presence.map(g => (
              <span key={g} className={styles.geoChip}>{g}</span>
            ))}
          </div>
        </div>
      )}

      {(brand.website || brand.partnership_url || brand.partnership_email) && (
        <div className={styles.section}>
          <p className={styles.sectionLabel}>Contact & links</p>
          <div className={styles.linkRow}>
            {brand.partnership_url && (
              <a href={brand.partnership_url} target="_blank" rel="noopener noreferrer" className={styles.link}>
                Programme page ↗
              </a>
            )}
            {brand.website && (
              <a href={brand.website} target="_blank" rel="noopener noreferrer" className={styles.link}>
                Website ↗
              </a>
            )}
            {brand.partnership_email && (
              <a href={`mailto:${brand.partnership_email}`} className={styles.link}>
                {brand.partnership_email}
              </a>
            )}
          </div>
        </div>
      )}

      {brand.tier_profiles?.length > 0 && (
        <div className={styles.section}>
          <p className={styles.sectionLabel}>Rate intelligence</p>
          <div className={styles.rateTable}>
            {brand.tier_profiles.map((tp, i) => {
              const rateStr = formatRate(tp.rate_range_low, tp.rate_range_high, tp.rate_currency);
              const statusClass =
                tp.buying_window_status === 'active'  ? styles.rateStatusActive :
                tp.buying_window_status === 'warming' ? styles.rateStatusWarming :
                styles.rateStatusInactive;
              return (
                <div key={i} className={styles.rateRow}>
                  <span className={styles.rateTier}>{tp.creator_tier}</span>
                  <span className={`${styles.rateStatus} ${statusClass}`}>
                    {tp.buying_window_status}
                  </span>
                  <span className={styles.rateRange}>
                    {rateStr
                      ? `${rateStr} · ${(tp.typical_deliverable ?? '').replace(/_/g, ' ')}`
                      : 'Rate data pending'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
