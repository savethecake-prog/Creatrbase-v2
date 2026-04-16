import { useRef, useState } from 'react';
import styles from './ScoreCard.module.css';

const TIER_LABELS = {
  pre_commercial: 'Pre-Commercial',
  emerging:       'Emerging',
  viable:         'Viable',
  established:    'Established',
};

const TIER_COLORS = {
  pre_commercial: '#8B8B9A',
  emerging:       '#E8874C',
  viable:         '#D1B9FF',
  established:    '#A4FFDB',
};

function ScoreCardContent({ score, niche, platform }) {
  const tier       = score?.tier ?? 'emerging';
  const overall    = score?.overall ?? 0;
  const dimensions = score?.dimensions ?? {};
  const color      = TIER_COLORS[tier] ?? '#A4FFDB';
  const tierLabel  = TIER_LABELS[tier] ?? tier.replace(/_/g, ' ');

  return (
    <div className={styles.card} data-tier={tier}>
      {/* Header */}
      <div className={styles.cardHeader}>
        <div className={styles.logoMark}>CB</div>
        <span className={styles.cardBrand}>creatrbase.com</span>
      </div>

      {/* Score ring */}
      <div className={styles.scoreRing}>
        <svg viewBox="0 0 120 120" className={styles.ringsvg}>
          <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
          <circle
            cx="60" cy="60" r="50"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${(overall / 100) * 314} 314`}
            transform="rotate(-90 60 60)"
          />
        </svg>
        <div className={styles.ringInner}>
          <span className={styles.ringScore}>{overall}</span>
          <span className={styles.ringLabel}>/ 100</span>
        </div>
      </div>

      {/* Tier */}
      <div className={styles.tierBadge} style={{ color, borderColor: `${color}40` }}>
        {tierLabel}
      </div>

      {/* Niche + platform */}
      {(niche || platform) && (
        <p className={styles.nicheTag}>
          {[niche, platform].filter(Boolean).join(' · ')}
        </p>
      )}

      {/* Dimension bars */}
      {Object.keys(dimensions).length > 0 && (
        <div className={styles.dims}>
          {Object.entries(dimensions).map(([key, dim]) => (
            <div key={key} className={styles.dimRow}>
              <span className={styles.dimName}>{key.replace(/_/g, ' ')}</span>
              <div className={styles.dimBarWrap}>
                <div
                  className={styles.dimBar}
                  style={{
                    width: `${dim.score ?? 0}%`,
                    background: color,
                    opacity: dim.confidence === 'insufficient_data' ? 0.25 : 0.7,
                  }}
                />
              </div>
              <span className={styles.dimVal}>{dim.score ?? '—'}</span>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <p className={styles.cardFooter}>Commercial Viability Score</p>
    </div>
  );
}

export function ScoreCardModal({ score, niche, platform, onClose }) {
  const cardRef  = useRef(null);
  const [copied, setCopied]      = useState(false);
  const [saving, setSaving]      = useState(false);

  async function handleDownload() {
    if (!cardRef.current || saving) return;
    setSaving(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#05040A',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const link = document.createElement('a');
      link.download = 'my-creatrbase-score.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      console.error('ScoreCard export failed', e);
    } finally {
      setSaving(false);
    }
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText('https://creatrbase.com/scoring-explained');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
  }

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <p className={styles.modalTitle}>Your score card</p>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>

        <div ref={cardRef} className={styles.cardWrap}>
          <ScoreCardContent score={score} niche={niche} platform={platform} />
        </div>

        <div className={styles.actions}>
          <button className={styles.actionBtn} onClick={handleDownload} disabled={saving}>
            {saving ? 'Exporting…' : 'Download PNG'}
          </button>
          <button className={styles.actionBtnSecondary} onClick={handleCopyLink}>
            {copied ? 'Copied!' : 'Copy link'}
          </button>
        </div>

        <p className={styles.hint}>Share your score on social or use it in outreach to brands.</p>
      </div>
    </div>
  );
}
