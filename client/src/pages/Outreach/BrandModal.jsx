import { useState, useEffect } from 'react';
import { Badge } from '../../components/ui/Badge/Badge';
import { useAuth } from '../../lib/AuthContext';
import { BrandModalDetails } from './BrandModalDetails';
import { BrandModalContacts } from './BrandModalContacts';
import { BrandModalCompose } from './BrandModalCompose';
import { BrandModalHistory } from './BrandModalHistory';
import { CATEGORY_LABELS, PROGRAMME_LABELS, CONFIDENCE_VARIANT } from './brandModalUtils';
import styles from './BrandModal.module.css';

export function BrandModal({ brand, niche, onClose, onOutreachLogged }) {
  const { user } = useAuth();
  const tier = user?.tier;

  const [tab,    setTab]    = useState('details');
  const [sendTo, setSendTo] = useState(brand.partnership_email ?? '');
  const [marked, setMarked] = useState(false);

  const alreadyContacted = !!brand.latest_interaction || marked;

  // Close on Escape
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <p className={styles.brandName}>{brand.brand_name}</p>
            <div className={styles.headerMeta}>
              <Badge variant={CONFIDENCE_VARIANT[brand.registry_confidence] ?? 'lavender'}>
                {brand.registry_confidence}
              </Badge>
              <span className={styles.metaDot} />
              <span className={styles.metaText}>
                {CATEGORY_LABELS[brand.category] ?? brand.category}
              </span>
              {brand.creator_programme_type && brand.creator_programme_type !== 'unknown' && (
                <>
                  <span className={styles.metaDot} />
                  <span className={styles.metaText}>
                    {PROGRAMME_LABELS[brand.creator_programme_type]}
                  </span>
                </>
              )}
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          {[
            { id: 'details',  label: 'Details' },
            { id: 'contacts', label: 'Contacts' },
            { id: 'compose',  label: 'Compose outreach' },
            { id: 'history',  label: `History${alreadyContacted ? ' ·' : ''}` },
          ].map(({ id, label }) => (
            <button
              key={id}
              className={`${styles.tab} ${tab === id ? styles.tabActive : ''}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className={styles.body}>
          {tab === 'details' && (
            <BrandModalDetails brand={brand} />
          )}
          {tab === 'contacts' && (
            <BrandModalContacts
              brand={brand}
              tier={tier}
              onUseEmail={email => { setSendTo(email); setTab('compose'); }}
            />
          )}
          {tab === 'compose' && (
            <BrandModalCompose
              brand={brand}
              niche={niche}
              displayName={user?.displayName ?? 'Your Name'}
              initialSendTo={sendTo}
              alreadyContacted={alreadyContacted}
              onOutreachLogged={onOutreachLogged}
              onMarkSent={() => setMarked(true)}
            />
          )}
          {tab === 'history' && (
            <BrandModalHistory brand={brand} />
          )}
        </div>

      </div>
    </div>
  );
}
