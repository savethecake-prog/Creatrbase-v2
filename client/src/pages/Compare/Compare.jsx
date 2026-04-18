import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { PublicNav } from '../../components/PublicNav/PublicNav';
import { MarketingFooter } from '../../components/MarketingFooter/MarketingFooter';
import { PageMeta } from '../../components/PageMeta/PageMeta';
import styles from './Compare.module.css';

export function Compare() {
  const { competitor } = useParams();
  const [page, setPage] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setPage(null);
    setError(false);
    api.get(`/compare/${competitor}`)
      .then(r => setPage(r.comparison))
      .catch(() => setError(true));
  }, [competitor]);

  if (error) {
    return (
      <div className={styles.page}>
        <PublicNav variant="v2" />
        <main className={styles.main}>
          <div className={styles.notFound}>
            <h1>Comparison not found</h1>
            <p>We haven't published a comparison for this tool yet.</p>
            <Link to="/blog" className={styles.backLink}>Browse the blog instead</Link>
          </div>
        </main>
        <MarketingFooter />
      </div>
    );
  }

  if (!page) {
    return (
      <div className={styles.page}>
        <PublicNav variant="v2" />
        <main className={styles.main}><p className={styles.loading}>Loading...</p></main>
      </div>
    );
  }

  const table = page.comparison_table || [];

  return (
    <div className={styles.page}>
      <PageMeta
        title={page.title}
        description={page.meta_description}
        canonical={`https://creatrbase.com/compare/${page.slug}`}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'Article',
        headline: page.title,
        description: page.meta_description,
        author: { '@type': 'Person', name: 'Anthony Saulderson', url: 'https://creatrbase.com/author/anthony-saulderson' },
        publisher: { '@type': 'Organization', name: 'Creatrbase', url: 'https://creatrbase.com' },
        dateModified: page.updated_at,
        datePublished: page.published_at,
        url: `https://creatrbase.com/compare/${page.slug}`,
      }) }} />

      <PublicNav variant="v2" />

      <main className={styles.main}>
        <header className={styles.hero}>
          <span className={styles.eyebrow}><span className={styles.eyebrowDot} /> Comparison</span>
          <h1 className={styles.title}>{page.title}</h1>
          <p className={styles.meta}>Last updated: {new Date(page.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </header>

        {table.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Creatrbase</th>
                  <th>{page.competitor_name}</th>
                </tr>
              </thead>
              <tbody>
                {table.map((row, i) => (
                  <tr key={i}>
                    <td className={styles.featureCell}>{row.feature}</td>
                    <td className={row.winner === 'creatrbase' ? styles.winCell : ''}>{row.creatrbase}</td>
                    <td className={row.winner === 'competitor' ? styles.winCell : ''}>{row.competitor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className={styles.body} dangerouslySetInnerHTML={{ __html: page.content_html }} />

        <div className={styles.cta}>
          <h2 className={styles.ctaTitle}>Try Creatrbase free</h2>
          <p className={styles.ctaDesc}>Connect your channel, see your commercial viability score, decide for yourself.</p>
          <a href="/score" className={styles.ctaBtn}>Score my channel</a>
        </div>

        <p className={styles.disclaimer}>
          This page was last reviewed {new Date(page.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}. Creatrbase is the publisher. {page.competitor_name} is not affiliated with Creatrbase and the comparison reflects our honest evaluation.
        </p>
      </main>

      <MarketingFooter />
    </div>
  );
}
