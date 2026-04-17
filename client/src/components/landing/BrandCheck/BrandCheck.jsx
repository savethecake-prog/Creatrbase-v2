import React, { useState } from 'react';
import styles from './BrandCheck.module.css';

const YOUTUBE_RE = /youtube\.com|youtu\.be|^@/;

function detectPlatform(input) {
  if (!input) return 'youtube';
  if (YOUTUBE_RE.test(input)) return 'youtube';
  return null; // ambiguous
}

function extractHandle(input, platform) {
  let clean = input.trim();

  if (platform === 'youtube') {
    // Extract from URL patterns
    if (clean.includes('youtube.com/@')) {
      clean = clean.split('/@')[1].split(/[/?#]/)[0];
    } else if (clean.includes('youtube.com/c/')) {
      clean = clean.split('/c/')[1].split(/[/?#]/)[0];
    } else if (clean.includes('youtube.com/channel/')) {
      clean = clean.split('/channel/')[1].split(/[/?#]/)[0];
    } else {
      clean = clean.replace(/^@/, '');
    }
  } else {
    // Twitch: strip URL prefix if present
    if (clean.includes('twitch.tv/')) {
      clean = clean.split('twitch.tv/')[1].split(/[/?#]/)[0];
    }
    clean = clean.replace(/^@/, '');
  }

  return clean;
}

export function BrandCheck() {
  const [input, setInput] = useState('');
  const [platform, setPlatform] = useState('youtube');
  const [error, setError] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    setError(null);

    const detected = detectPlatform(input);
    const activePlatform = detected || platform;
    const handle = extractHandle(input, activePlatform);

    if (!handle || handle.length < 2) {
      setError('Enter a valid channel handle or URL');
      return;
    }

    // Full navigation — score card is server-rendered
    window.location.href = '/score/' + activePlatform + '/' + encodeURIComponent(handle);
  };

  return (
    <div className={styles.container} id="score">
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.platformToggle}>
          <button
            type="button"
            className={`${styles.toggleBtn} ${platform === 'youtube' ? styles.toggleActive : ''}`}
            onClick={() => setPlatform('youtube')}
          >
            YouTube
          </button>
          <button
            type="button"
            className={`${styles.toggleBtn} ${platform === 'twitch' ? styles.toggleActive : ''}`}
            onClick={() => setPlatform('twitch')}
          >
            Twitch
          </button>
        </div>

        <div className={styles.inputWrapper}>
          <input
            type="text"
            placeholder={platform === 'youtube' ? '@yourchannel or youtube.com/@channel' : 'your_twitch_handle'}
            className={styles.input}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button type="submit" className={styles.submitBtn}>
            Get my score
          </button>
        </div>

        {error && <p className={styles.errorMessage}>{error}</p>}
        <p className={styles.helperText}>Free. No signup required. Results in seconds.</p>
      </form>
    </div>
  );
}
