import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PublicNav } from '../../components/PublicNav/PublicNav';
import { MarketingFooter } from '../../components/MarketingFooter/MarketingFooter';
import { PageMeta } from '../../components/PageMeta/PageMeta';
import { api } from '../../lib/api';
import styles from './Author.module.css';

export function Author() {
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    api.get('/blog/posts?limit=50').then(r => setPosts(r.posts || [])).catch(err => console.error('[Author]', err));
  }, []);

  return (
    <div className={styles.page}>
      <PageMeta
        title="Anthony Saulderson - Founder, Creatrbase"
        description="Anthony Saulderson is the founder of Creatrbase, a commercial intelligence platform for independent YouTube and Twitch creators. Background in agency strategy and creator economy."
        canonical="https://creatrbase.com/author/anthony-saulderson"
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'Person',
        name: 'Anthony Saulderson',
        url: 'https://creatrbase.com/author/anthony-saulderson',
        jobTitle: 'Founder',
        worksFor: { '@type': 'Organization', name: 'Creatrbase', url: 'https://creatrbase.com' },
        sameAs: ['https://www.linkedin.com/in/anthonysaulderson/'],
      }) }} />

      <PublicNav variant="v2" />

      <main className={styles.main}>
        <header className={styles.hero}>
          <div className={styles.avatar}>AS</div>
          <div>
            <h1 className={styles.name}>Anthony Saulderson</h1>
            <p className={styles.role}>Founder, Creatrbase</p>
          </div>
        </header>

        <section className={styles.bio}>
          <p>Anthony built Creatrbase after years working in agency strategy, watching independent creators get undervalued by a system designed around agencies and mega-influencers. The platform exists to give creators with 1k-100k subscribers the same commercial intelligence that agencies keep behind closed doors.</p>
          <p>He writes about the creator economy, brand deal mechanics, and how AI is changing the tools available to independent creators.</p>
        </section>

        <div className={styles.links}>
          <a href="https://www.linkedin.com/in/anthonysaulderson/" target="_blank" rel="noopener" className={styles.socialLink}>LinkedIn</a>
        </div>

        <section className={styles.articles}>
          <h2 className={styles.sectionTitle}>Articles</h2>
          {posts.map(p => (
            <Link key={p.id} to={`/blog/${p.slug}`} className={styles.articleRow}>
              <span className={styles.articleTitle}>{p.title}</span>
              <span className={styles.articleDate}>{p.publishedAt ? new Date(p.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</span>
            </Link>
          ))}
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
