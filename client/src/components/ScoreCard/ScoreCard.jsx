import { useRef, useState } from 'react';
import styles from './ScoreCard.module.css';
import { TIER_GRADE, TIER_LABEL, TIER_VERDICT } from '../../lib/tierGrades';

const TIER_COLORS = {
  pre_commercial: '#8B8B9A',
  emerging:       '#E8874C',
  viable:         '#D1B9FF',
  established:    '#A4FFDB',
};

const CIRCUMFERENCE = 490; // 2π × r=78

function ScoreCardContent({ score, niche, platform, lightMode }) {
  const tier        = score?.tier ?? 'emerging';
  const overall     = score?.overall ?? 0;
  const dimensions  = score?.dimensions ?? {};
  const color       = TIER_COLORS[tier] ?? '#A4FFDB';
  const grade       = TIER_GRADE[tier] ?? '?';
  const tierLabel   = TIER_LABEL[tier] ?? tier.replace(/_/g, ' ');
  const tierVerdict = TIER_VERDICT[tier] ?? '';

  const ringTrack = lightMode ? 'rgba(14,27,42,0.1)' : 'rgba(255,255,255,0.06)';
  const wordmark  = lightMode ? '/brand/wordmark-dark.png' : '/brand/wordmark-light.png';

  return (
    <div className={styles.card} data-tier={tier} data-light={lightMode ? 'true' : 'false'}>
      {/* Header */}
      <div className={styles.cardHeader}>
        <img src={wordmark} alt="Creatrbase" className={styles.wordmark} />
      </div>

      {/* Two-column body */}
      <div className={styles.cardBody}>
        {/* Score ring */}
        <div className={styles.scoreRing}>
          <svg viewBox="0 0 180 180" className={styles.ringsvg}>
            <circle cx="90" cy="90" r="78" fill="none" stroke={ringTrack} strokeWidth="10" />
            <circle
              cx="90" cy="90" r="78"
              fill="none"
              stroke={color}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${(overall / 100) * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
              transform="rotate(-90 90 90)"
            />
          </svg>
          <div className={styles.ringInner}>
            <span className={styles.ringScore}>{overall}</span>
            <span className={styles.ringLabel}>/ 100</span>
          </div>
        </div>

        {/* Right column */}
        <div className={styles.cardRight}>
          <span className={styles.cardEyebrow}>Commercial Intelligence Score</span>
          <p className={styles.cardTierHeading}>{grade} tier &mdash; {tierVerdict}</p>

          {(niche || platform) && (
            <p className={styles.nicheTag}>
              {[niche, platform].filter(Boolean).join(' · ')}
            </p>
          )}

          <div className={styles.tierBadge}>{grade} tier</div>

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
        </div>
      </div>

      {/* Footer */}
      <p className={styles.cardFooter}>Commercial Viability Score</p>
    </div>
  );
}

export function ScoreCardModal({ score, niche, platform, onClose }) {
  const cardRef  = useRef(null);
  const [copied,    setCopied]    = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [lightMode, setLightMode] = useState(true);

  async function handleDownload() {
    if (!cardRef.current || saving) return;
    setSaving(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: lightMode ? '#FAF6EF' : '#05040A',
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
          <div className={styles.modalHeaderRight}>
            <button
              className={`${styles.themeToggle} ${lightMode ? styles.themeToggleLight : ''}`}
              onClick={() => setLightMode(m => !m)}
              title={lightMode ? 'Switch to dark' : 'Switch to light'}
            >
              {lightMode ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2"/>
                  <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
              {lightMode ? 'Light' : 'Dark'}
            </button>
            <button className={styles.close} onClick={onClose}>✕</button>
          </div>
        </div>

        <div ref={cardRef} className={styles.cardWrap}>
          <ScoreCardContent score={score} niche={niche} platform={platform} lightMode={lightMode} />
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
