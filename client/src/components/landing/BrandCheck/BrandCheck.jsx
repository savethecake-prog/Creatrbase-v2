import React, { useState } from 'react';
import styles from './BrandCheck.module.css';
import { Button } from '../../ui/Button/Button';
import { Card } from '../../ui/Card/Card';

export function BrandCheck() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleCheck = async (e) => {
    e.preventDefault();
    if (!url) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`/api/public/youtube-check?url=${encodeURIComponent(url)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong');
      }

      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      {!result ? (
        <Card className={styles.checkCard} variant="glass">
          <form onSubmit={handleCheck} className={styles.form}>
            <h3 className={styles.formTitle}>See what brands see</h3>
            <p className={styles.formSub}>Paste your YouTube link to see your Brand-Ready score.</p>
            
            <div className={styles.inputWrapper}>
              <input
                type="text"
                placeholder="youtube.com/@yourchannel"
                className={styles.input}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={loading}
              />
              <Button 
                type="submit" 
                variant="glow" 
                disabled={loading}
                className={styles.submitBtn}
              >
                {loading ? 'Scanning...' : 'Check My Stats'}
              </Button>
            </div>
            
            {error && <p className={styles.errorMessage}>{error}</p>}
          </form>
        </Card>
      ) : (
        <Card className={styles.resultCard} variant="glass">
          <div className={styles.resultHeader}>
            {result.channel.thumbnail && (
              <img src={result.channel.thumbnail} alt="" className={styles.avatar} />
            )}
            <div className={styles.channelInfo}>
              <span className={styles.channelTitle}>{result.channel.title}</span>
              <span className={styles.tierBadge}>{result.targetTier} Tier</span>
            </div>
            <button className={styles.resetBtn} onClick={() => setResult(null)}>Reset</button>
          </div>

          <div className={styles.scoreSection}>
            <div className={styles.gaugeContainer}>
              <div className={styles.gaugeOuter}>
                <div 
                  className={styles.gaugeInner} 
                  style={{ '--score-width': `${result.score}%` }}
                />
              </div>
              <div className={styles.scoreText}>
                <span className={styles.scoreNumber}>{result.score}%</span>
                <span className={styles.scoreLabel}>Brand Ready</span>
              </div>
            </div>
          </div>

          <div className={styles.insightBox}>
            <p className={styles.insightText}>{result.insight}</p>
          </div>

          <Button 
            variant="primary" 
            className={styles.ctaBtn}
            onClick={() => window.location.href = '/signup'}
          >
            Unlock My Full Earnings Report
          </Button>
        </Card>
      )}
    </div>
  );
}
