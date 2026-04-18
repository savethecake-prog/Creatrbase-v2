import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { PublicNav } from '../../components/PublicNav/PublicNav';
import { MarketingFooter } from '../../components/MarketingFooter/MarketingFooter';
import { PageMeta } from '../../components/PageMeta/PageMeta';
import styles from './Programmatic.module.css';

const TIER_ORDER = ['1k-10k', '10k-50k', '50k-100k', '100k+'];

export function NichePage() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.get(`/niche/${slug}`).then(setData).catch(() => setError(true));
  }, [slug]);

  if (error) return <NotFound msg="Niche page not found." />;
  if (!data) return <Loading />;

  const { niche, benchmarks } = data;
  const ukBench = benchmarks.filter(b => b.country === 'uk');
  const usBench = benchmarks.filter(b => b.country === 'us');

  return (
    <div className={styles.page}>
      <PageMeta title={`${niche.display_name} creator brand deals and rates`} description={niche.meta_description} canonical={`https://creatrbase.com/niche/${niche.slug}`} />
      <PublicNav variant="v2" />
      <main className={styles.main}>
        <header className={styles.hero}>
          <span className={styles.eyebrow}>Niche guide</span>
          <h1 className={styles.title}>{niche.display_name}</h1>
          <p className={styles.desc}>{niche.description}</p>
        </header>

        {niche.typical_brand_categories?.length > 0 && (
          <div className={styles.tags}>
            {niche.typical_brand_categories.map(c => <span key={c} className={styles.tag}>{c}</span>)}
          </div>
        )}

        {benchmarks.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Typical rates</h2>
            <BenchmarkTable rows={ukBench} label="UK" />
            <BenchmarkTable rows={usBench} label="US" />
          </section>
        )}

        {niche.analysis_html && (
          <section className={styles.section}>
            <div className={styles.body} dangerouslySetInnerHTML={{ __html: niche.analysis_html }} />
          </section>
        )}

        <div className={styles.cta}>
          <h2 className={styles.ctaTitle}>See where you rank in {niche.display_name}</h2>
          <a href="/score" className={styles.ctaBtn}>Score my channel</a>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}

function BenchmarkTable({ rows, label }) {
  if (!rows.length) return null;
  return (
    <div className={styles.benchTable}>
      <h3 className={styles.benchLabel}>{label}</h3>
      <table className={styles.table}>
        <thead><tr><th>Tier</th><th>Platform</th><th>CPM range</th><th>Typical rate</th></tr></thead>
        <tbody>
          {TIER_ORDER.flatMap(tier => rows.filter(r => r.audience_tier === tier).map((r, i) => (
            <tr key={`${tier}-${r.platform}-${i}`}>
              <td>{tier}</td>
              <td>{r.platform}</td>
              <td>{r.currency === 'GBP' ? '\u00A3' : '$'}{r.cpm_low}-{r.cpm_high}</td>
              <td>{r.typical_rate_low && r.typical_rate_high ? `${r.currency === 'GBP' ? '\u00A3' : '$'}${r.typical_rate_low}-${r.typical_rate_high}` : '-'}</td>
            </tr>
          )))}
        </tbody>
      </table>
    </div>
  );
}

export function RatePage() {
  const { country, niche } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.get(`/rates/${country}/${niche}`).then(setData).catch(() => setError(true));
  }, [country, niche]);

  if (error) return <NotFound msg="Rate data not available for this combination." />;
  if (!data) return <Loading />;

  const countryLabel = country === 'uk' ? 'UK' : country === 'us' ? 'US' : country.toUpperCase();

  return (
    <div className={styles.page}>
      <PageMeta title={`${data.niche_name} creator rates in the ${countryLabel}`} description={`What do brands pay ${data.niche_name} creators in the ${countryLabel}? Rate ranges by subscriber tier for YouTube and Twitch.`} canonical={`https://creatrbase.com/rates/${country}/${niche}`} />
      <PublicNav variant="v2" />
      <main className={styles.main}>
        <header className={styles.hero}>
          <span className={styles.eyebrow}>Rate guide</span>
          <h1 className={styles.title}>{data.niche_name} creator rates in the {countryLabel}</h1>
          <p className={styles.desc}>What brands pay {data.niche_name} creators in the {countryLabel}, broken down by subscriber tier.</p>
        </header>
        <BenchmarkTable rows={data.benchmarks} label={countryLabel} />
        <div className={styles.cta}>
          <h2 className={styles.ctaTitle}>Get your personalised rate estimate</h2>
          <a href="/score" className={styles.ctaBtn}>Score my channel</a>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}

export function ThresholdPage() {
  const { metric } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.get(`/threshold/${metric}`).then(d => setData(d.page)).catch(() => setError(true));
  }, [metric]);

  if (error) return <NotFound msg="Threshold page not found." />;
  if (!data) return <Loading />;

  return (
    <div className={styles.page}>
      <PageMeta title={data.title} description={data.meta_description} canonical={`https://creatrbase.com/threshold/${data.slug}`} />
      <PublicNav variant="v2" />
      <main className={styles.main}>
        <header className={styles.hero}>
          <span className={styles.eyebrow}>Commercial threshold</span>
          <h1 className={styles.title}>{data.title}</h1>
        </header>
        <div className={styles.body} dangerouslySetInnerHTML={{ __html: data.content_html }} />
        <div className={styles.cta}>
          <h2 className={styles.ctaTitle}>See where you stand</h2>
          <a href="/score" className={styles.ctaBtn}>Score my channel</a>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}

export function ResearchPage() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.get(`/research/${slug}`).then(d => setData(d.report)).catch(() => setError(true));
  }, [slug]);

  if (error) return <NotFound msg="Report not found." />;
  if (!data) return <Loading />;

  const findings = data.key_findings || [];

  return (
    <div className={styles.page}>
      <PageMeta title={data.title} description={data.meta_description} canonical={`https://creatrbase.com/research/${data.slug}`} />
      <PublicNav variant="v2" />
      <main className={styles.main}>
        <header className={styles.hero}>
          <span className={styles.eyebrow}>Research</span>
          <h1 className={styles.title}>{data.title}</h1>
          <div className={styles.metaRow}>
            {data.sample_size && <span>Sample: {data.sample_size.toLocaleString()} creators</span>}
            {data.period_start && data.period_end && <span>Period: {data.period_start} to {data.period_end}</span>}
          </div>
        </header>

        <div className={styles.body} dangerouslySetInnerHTML={{ __html: data.summary_html }} />

        {findings.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Key findings</h2>
            <div className={styles.findingsGrid}>
              {findings.map((f, i) => (
                <div key={i} className={styles.findingCard}>
                  <div className={styles.findingNum}>{i + 1}</div>
                  <p>{typeof f === 'string' ? f : f.text || f.finding}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {data.pdf_url && (
          <div className={styles.cta}>
            <h2 className={styles.ctaTitle}>Download the full report</h2>
            <a href={data.pdf_url} className={styles.ctaBtn} target="_blank" rel="noopener">Download PDF</a>
          </div>
        )}
      </main>
      <MarketingFooter />
    </div>
  );
}

function Loading() {
  return (
    <div className={styles.page}>
      <PublicNav variant="v2" />
      <main className={styles.main}><p className={styles.loading}>Loading...</p></main>
    </div>
  );
}

function NotFound({ msg }) {
  return (
    <div className={styles.page}>
      <PublicNav variant="v2" />
      <main className={styles.main}>
        <div className={styles.notFound}>
          <h1>Not found</h1>
          <p>{msg}</p>
          <Link to="/" className={styles.backLink}>Back to home</Link>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
