import React, { useState } from 'react';
import styles from './BrandCheck.module.css';

const YOUTUBE_RE = /youtube\.com|youtu\.be|^@/;

function detectPlatform(input) {
  if (!input) return 'youtube';
  if (YOUTUBE_RE.test(input)) return 'youtube';
  return null;
}

function extractHandle(input, platform) {
  let clean = input.trim();

  if (platform === 'youtube') {
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

    window.location.href = '/score/' + activePlatform + '/' + encodeURIComponent(handle);
  };

  return (
    <div className={styles.container} id="score">
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.inputWrapper}>
          <span className={styles.prefix}>
            {platform === 'youtube' ? 'youtube.com/' : 'twitch.tv/'}
          </span>
          <input
            type="text"
            placeholder="@yourchannel"
            className={styles.input}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button type="submit" className={styles.submitBtn}>
            Score my channel &rarr;
          </button>
        </div>

        {error && <p className={styles.errorMessage}>{error}</p>}

        <div className={styles.formMeta}>
          <span><span className={styles.tick}>&#10003;</span> No signup</span>
          <span><span className={styles.tick}>&#10003;</span> ~45 seconds</span>
          <span><span className={styles.tick}>&#10003;</span> Free forever</span>
        </div>
      </form>
    </div>
  );
}
