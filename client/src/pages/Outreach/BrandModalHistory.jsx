import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { fmtDate } from './brandModalUtils';
import styles from './BrandModal.module.css';

const INTERACTION_LABELS = {
  outreach_sent:        'Outreach sent',
  outreach_responded:   'Responded',
  outreach_declined:    'Declined',
  deal_negotiating:     'Negotiating',
  deal_completed:       'Deal completed',
  relationship_ongoing: 'Ongoing relationship',
};

const INTERACTION_DOT_CLASS = {
  outreach_sent:        styles.historyDotSent,
  outreach_responded:   styles.historyDotResponse,
  outreach_declined:    styles.historyDotDeclined,
  deal_negotiating:     styles.historyDotDeal,
  deal_completed:       styles.historyDotDeal,
  relationship_ongoing: styles.historyDotDeal,
};

export function BrandModalHistory({ brand }) {
  const [history, setHistory] = useState(null);

  useEffect(() => {
    api.get(`/brands/${brand.id}/outreach`)
      .then(res => setHistory(res.history))
      .catch(() => setHistory([]));
  }, [brand.id]);

  if (history === null) {
    return <p className={styles.emptyHistory}>Loading…</p>;
  }

  if (history.length === 0) {
    return (
      <p className={styles.emptyHistory}>
        No outreach logged yet. Use the Compose tab to draft and track your first message.
      </p>
    );
  }

  return (
    <div className={styles.historyList}>
      {history.map(item => (
        <div key={item.id} className={styles.historyItem}>
          <div className={`${styles.historyDot} ${INTERACTION_DOT_CLASS[item.interaction_type] ?? ''}`} />
          <div className={styles.historyContent}>
            <p className={styles.historyType}>
              {INTERACTION_LABELS[item.interaction_type] ?? item.interaction_type.replace(/_/g, ' ')}
            </p>
            <p className={styles.historyDate}>{fmtDate(item.interaction_date)}</p>
            {item.deal_notes && (
              <p className={styles.historyNotes}>{item.deal_notes}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
