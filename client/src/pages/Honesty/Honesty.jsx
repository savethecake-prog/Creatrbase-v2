import { useState, useEffect, useCallback } from 'react';
import { PublicNav } from '../../components/PublicNav/PublicNav';
import { MarketingFooter } from '../../components/MarketingFooter/MarketingFooter';
import { PageMeta } from '../../components/PageMeta/PageMeta';
import { useAuth } from '../../lib/AuthContext';
import { api } from '../../lib/api';
import { PageLoader } from '../../components/PageLoader/PageLoader';
import styles from './Honesty.module.css';

function factorLines(factors) {
  if (!factors) return [];
  const lines = [];

  if (factors.corroboration != null) {
    const c = factors.corroboration;
    if (c >= 0.7)      lines.push('Well supported by prior tracked activity');
    else if (c >= 0.4) lines.push('Partially corroborated by prior signals');
    else               lines.push('First signal of this type — no corroboration yet');
  }

  if (factors.recency != null) {
    const r = factors.recency;
    if (r >= 1.0)      lines.push('Very recent (less than 7 days old)');
    else if (r >= 0.8) lines.push('Recent (within the last month)');
    else if (r >= 0.6) lines.push('Moderate age (1-3 months)');
    else if (r >= 0.4) lines.push('Getting older (3-6 months)');
    else               lines.push('Old signal (over 6 months)');
  }

  if (factors.completeness != null) {
    const pct = Math.round(factors.completeness * 100);
    lines.push(`${pct}% of expected data fields were present`);
  }

  if (factors.sourceType != null) {
    const s = factors.sourceType;
    if (s >= 0.8)      lines.push('Source: user-recorded (most reliable)');
    else if (s >= 0.5) lines.push('Source: auto-detected from email');
    else               lines.push('Source: inferred');
  }

  if (Array.isArray(factors.notes)) {
    factors.notes.forEach((n) => n && lines.push(n));
  }

  return lines;
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1)  return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)   return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30)    return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function qualityVariant(score) {
  if (score == null) return 'low';
  if (score >= 0.8) return 'high';
  if (score >= 0.5) return 'medium';
  return 'low';
}

function SignalLogEntry({ signal }) {
  const [expanded, setExpanded] = useState(false);
  const variant = qualityVariant(signal.quality_score);
  const factors = signal.quality_factors ?? null;
  const factorText = factorLines(factors);
  const pct = Math.round((signal.quality_score ?? 0) * 100);

  return (
    <div className={styles.logEntry}>
      <div className={styles.logEntryMain}>
        <div className={styles.logEntryContent}>
          <p className={styles.logEntryDesc}>{signal.description}</p>
          <span className={styles.logEntryTime}>{timeAgo(signal.created_at)}</span>
        </div>
        <div className={styles.logEntryMeta}>
          <div className={`${styles.logQualityTrack} ${styles[`logQuality_${variant}`]}`}>
            <div className={styles.logQualityFill} style={{ width: `${pct}%` }} />
          </div>
          <span className={`${styles.logQualityPct} ${styles[`logQuality_${variant}`]}`}>{pct}%</span>
          {factorText.length > 0 && (
            <button
              className={styles.logExpandBtn}
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
            >
              {expanded ? 'Less' : 'Why?'}
            </button>
          )}
        </div>
      </div>

      {expanded && factorText.length > 0 && (
        <ul className={styles.logFactors}>
          {factorText.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

const PAGE_SIZE = 20;

function LearningLog() {
  const [signals, setSignals]   = useState([]);
  const [total, setTotal]       = useState(0);
  const [offset, setOffset]     = useState(0);
  const [loading, setLoading]   = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]       = useState(false);

  const fetchPage = useCallback(async (off, append = false) => {
    try {
      const { signals: rows, total: t } = await api.get(
        `/signals/recent?offset=${off}&limit=${PAGE_SIZE}`
      );
      setTotal(t ?? 0);
      setSignals((prev) => append ? [...prev, ...(rows ?? [])] : (rows ?? []));
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    fetchPage(0).finally(() => setLoading(false));
  }, [fetchPage]);

  const loadMore = async () => {
    const next = offset + PAGE_SIZE;
    setLoadingMore(true);
    await fetchPage(next, true);
    setOffset(next);
    setLoadingMore(false);
  };

  if (loading) return <PageLoader />;
  if (error || signals.length === 0) return null;

  const hasMore = signals.length < total;

  return (
    <section className={styles.logSection}>
      <div className={styles.logSectionHeader}>
        <span className={styles.logSectionEyebrow}>
          <span className={styles.logSectionDot} /> Your learning log
        </span>
        <p className={styles.logSectionSubtitle}>
          Every time Creatrbase updates its model from your data, it is recorded here with a plain-English explanation and a quality score showing how much weight it was given.
        </p>
      </div>

      <div className={styles.logEntries}>
        {signals.map((s) => <SignalLogEntry key={s.id} signal={s} />)}
      </div>

      {hasMore && (
        <button
          className={styles.logLoadMore}
          onClick={loadMore}
          disabled={loadingMore}
        >
          {loadingMore ? 'Loading...' : `Load more (${total - signals.length} remaining)`}
        </button>
      )}
    </section>
  );
}

export function Honesty() {
  const { user, loading: authLoading } = useAuth();
  const showLog = !authLoading && user != null;

  return (
    <div className={styles.page}>
      <PageMeta
        title="The Honesty Principle — Creatrbase"
        description="What Creatrbase will and won't do. Our commitment to creators about how we measure, what we publish, and where the limits are."
        canonical="https://creatrbase.com/honesty"
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'WebPage',
        name: 'The Honesty Principle', url: 'https://creatrbase.com/honesty',
        description: 'What Creatrbase will and won\'t do.',
        breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://creatrbase.com' },
          { '@type': 'ListItem', position: 2, name: 'Honesty', item: 'https://creatrbase.com/honesty' },
        ] },
      }) }} />

      <PublicNav variant="v2" />

      <main className={styles.main}>
        <header className={styles.hero}>
          <span className={styles.eyebrow}><span className={styles.eyebrowDot} /> The honesty principle</span>
          <h1 className={styles.heroTitle}>If we don&rsquo;t know, we say&nbsp;so. If we change, we publish what&nbsp;changed.</h1>
        </header>

        <section className={styles.pillar}>
          <h2 className={styles.pillarTitle}>We will</h2>
          <ul className={styles.pillarList}>
            <li>Tell you exactly how your score is calculated — every dimension, every weighting, every calibration.</li>
            <li>Label every estimate as an estimate. Where the data is thin, we say so directly.</li>
            <li>Attach a confidence level to every output. High, medium, or low — never unlabelled.</li>
            <li>Show you what changed when we update the scoring model, and why.</li>
            <li>Let you export your data at any time, in a format you can actually use.</li>
            <li>Cancel your account in one click. No &ldquo;schedule a call&rdquo; nonsense.</li>
          </ul>
        </section>

        <section className={`${styles.pillar} ${styles.pillarPeach}`}>
          <h2 className={styles.pillarTitle}>We won&rsquo;t</h2>
          <ul className={styles.pillarList}>
            <li>Sell your data. Not to brands, not to agencies, not to anyone.</li>
            <li>Fabricate social proof. The numbers on the landing page are real or they&rsquo;re not there.</li>
            <li>Hide bad news. If your score drops, we tell you why and what to do about it.</li>
            <li>Gate features behind dark patterns, upsell modals, or artificial urgency.</li>
            <li>Use your data to train AI models for third parties.</li>
            <li>Pretend we have data we don&rsquo;t have. If a metric is unavailable, the field is empty — not estimated.</li>
          </ul>
        </section>

        <section className={`${styles.pillar} ${styles.pillarLav}`}>
          <h2 className={styles.pillarTitle}>We publish</h2>
          <ul className={styles.pillarList}>
            <li>The full scoring methodology — publicly, at <a href="/scoring-explained">/scoring-explained</a>.</li>
            <li>Every calibration change with the date, the delta, and the reasoning.</li>
            <li>Aggregate benchmarking data so you can see where you sit relative to your niche and tier.</li>
            <li>Our pricing, plainly. No &ldquo;contact us for a quote.&rdquo;</li>
          </ul>
        </section>

        {showLog && <LearningLog />}

        <div className={styles.logPreview}>
          <div className={styles.logTitle}>Calibration log</div>
          <p className={styles.logDesc}>Every scoring model change is published with the date, what changed, and why. See the full log on the <a href="/scoring-explained">methodology page</a>.</p>
        </div>

        <div className={styles.closing}>
          <p>We built Creatrbase because the creator economy runs on asymmetric information — and creators are on the wrong side of it. The least we can do is be honest about what we know and what we don&rsquo;t.</p>
        </div>

        <div className={styles.cta}>
          <h2 className={styles.ctaTitle}>See for yourself.</h2>
          <a href="/#score" className={styles.ctaBtn}>Score my channel &rarr;</a>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
