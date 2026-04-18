import { useState } from 'react';
import { PublicNav } from '../../components/PublicNav/PublicNav';
import { MarketingFooter } from '../../components/MarketingFooter/MarketingFooter';
import { PageMeta } from '../../components/PageMeta/PageMeta';
import styles from './ScoreForm.module.css';

const YOUTUBE_RE = /youtube\.com|youtu\.be|^@/;

function detectPlatform(input) {
  if (!input) return null;
  if (/twitch\.tv/i.test(input)) return 'twitch';
  if (YOUTUBE_RE.test(input)) return 'youtube';
  return null;
}

function extractHandle(input, platform) {
  let clean = input.trim();
  if (platform === 'youtube') {
    if (clean.includes('youtube.com/@')) clean = clean.split('/@')[1].split(/[/?#]/)[0];
    else if (clean.includes('youtube.com/c/')) clean = clean.split('/c/')[1].split(/[/?#]/)[0];
    else if (clean.includes('youtube.com/channel/')) clean = clean.split('/channel/')[1].split(/[/?#]/)[0];
    else clean = clean.replace(/^@/, '');
  } else {
    if (clean.includes('twitch.tv/')) clean = clean.split('twitch.tv/')[1].split(/[/?#]/)[0];
    clean = clean.replace(/^@/, '');
  }
  return clean;
}

const PROGRESS_NOTES = [
  'Fetching channel metadata...',
  'Analysing audience geography...',
  'Computing engagement quality...',
  'Checking brand alignment signals...',
  'Finalising your score...',
];

export function ScoreForm() {
  const [input, setInput] = useState('');
  const [platform, setPlatform] = useState('youtube');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progressIdx, setProgressIdx] = useState(0);

  function handleSubmit(e) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    setError(null);
    const detected = detectPlatform(input);
    const activePlatform = detected || platform;
    const handle = extractHandle(input, activePlatform);

    if (!handle || handle.length < 2) {
      setError('Enter a valid channel handle or URL');
      return;
    }

    setLoading(true);
    setProgressIdx(0);

    // Rotate progress notes
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % PROGRESS_NOTES.length;
      setProgressIdx(idx);
    }, 3000);

    // Navigate to the server-rendered score page (full page load)
    // Small delay so the user sees the loading state
    setTimeout(() => {
      clearInterval(interval);
      window.location.href = '/score/' + activePlatform + '/' + encodeURIComponent(handle);
    }, 1500);
  }

  return (
    <div className={styles.page}>
      <PageMeta
        title="Get your free Commercial Viability Score"
        description="Paste your YouTube or Twitch channel. Get your Commercial Viability Score across six dimensions brands actually evaluate. Free, anonymous, no signup."
        canonical="https://creatrbase.com/score"
        ogImage="/brand/og-image-with-tagline.png"
      />

      <PublicNav variant="v2" />

      <main className={styles.main}>
        <section className={styles.hero}>
          <span className={styles.eyebrow}><span className={styles.eyebrowDot} /> Free score</span>
          <h1 className={styles.heroTitle}>Know where you stand.<br/>In under a minute.</h1>
          <p className={styles.heroDesc}>
            Paste your YouTube or Twitch channel. Get your Commercial Viability Score across six dimensions brands actually evaluate. Free, anonymous, no signup.
          </p>
        </section>

        <div className={styles.formCard}>
          <div className={styles.platformTabs}>
            <button
              className={`${styles.platformTab} ${platform === 'youtube' ? styles.platformTabActive : ''}`}
              onClick={() => setPlatform('youtube')}
              type="button"
            >YouTube</button>
            <button
              className={`${styles.platformTab} ${platform === 'twitch' ? styles.platformTabActive : ''}`}
              onClick={() => setPlatform('twitch')}
              type="button"
            >Twitch</button>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.inputRow}>
              <input
                type="text"
                className={styles.input}
                placeholder={platform === 'youtube' ? 'youtube.com/@yourchannel or @handle' : 'twitch.tv/yourchannel or username'}
                value={input}
                onChange={e => setInput(e.target.value)}
                disabled={loading}
              />
              <button type="submit" className={styles.submitBtn} disabled={loading || !input.trim()}>
                {loading ? 'Scoring...' : 'Score my channel'}
              </button>
            </div>
            {error && <p className={styles.error}>{error}</p>}
            {loading && (
              <p className={styles.progress}>{PROGRESS_NOTES[progressIdx]}</p>
            )}
          </form>

          <div className={styles.formMeta}>
            <span>~45 seconds</span>
            <span>No signup</span>
            <span>Free forever</span>
          </div>
        </div>

        <div className={styles.steps}>
          <div className={styles.step}>
            <div className={styles.stepNum}>01</div>
            <h3 className={styles.stepTitle}>Paste your channel</h3>
            <p>YouTube or Twitch, read-only. We pull subscriber count, growth, engagement, and audience signals.</p>
          </div>
          <div className={styles.step}>
            <div className={`${styles.stepNum} ${styles.stepNumPeach}`}>02</div>
            <h3 className={styles.stepTitle}>Get your six-dimension read</h3>
            <p>Scored across the six things brands actually evaluate. Each dimension carries its own weight and confidence level.</p>
          </div>
          <div className={styles.step}>
            <div className={`${styles.stepNum} ${styles.stepNumMint}`}>03</div>
            <h3 className={styles.stepTitle}>Share or save</h3>
            <p>Share your score publicly or sign up to track it over time. Your score updates weekly, automatically.</p>
          </div>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
