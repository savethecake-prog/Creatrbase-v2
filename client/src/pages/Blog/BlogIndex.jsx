import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { PublicNav } from '../../components/PublicNav/PublicNav';
import { MarketingFooter } from '../../components/MarketingFooter/MarketingFooter';
import { PageMeta } from '../../components/PageMeta/PageMeta';
import styles from './BlogIndex.module.css';

const CATEGORY_EMOJI = {
  'scoring-explained': '📊',
  'brand-deals': '🤝',
  'creator-growth': '🚀',
  'pricing-rates': '💰',
  'platform-updates': '⚡',
};
const FALLBACK_GRADIENTS = [
  'linear-gradient(135deg, #F0E4FF, #D5FAE8)',
  'linear-gradient(135deg, #FFE8DC, #F0E4FF)',
  'linear-gradient(135deg, #D5FAE8, #F0E4FF)',
  'linear-gradient(135deg, #F0E4FF, #FFE8DC)',
];

function getCardFallback(post) {
  const emoji = (post.category && CATEGORY_EMOJI[post.category.slug]) || '✦';
  const hash = (post.title || '').length % FALLBACK_GRADIENTS.length;
  return { emoji, gradient: FALLBACK_GRADIENTS[hash] };
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function PostCard({ post, featured = false }) {
  const fb = getCardFallback(post);
  return (
    <Link to={`/blog/${post.slug}`} className={[styles.card, featured ? styles.cardFeatured : ''].filter(Boolean).join(' ')}>
      <div className={styles.cardImg}>
        {post.coverImageUrl ? (
          <img src={post.coverImageUrl} alt={post.title} loading="lazy" />
        ) : (
          <div className={styles.cardImgFallback} style={{ background: fb.gradient }}>
            <span className={styles.fallbackEmoji}>{fb.emoji}</span>
          </div>
        )}
      </div>
      <div className={styles.cardBody}>
        {post.category && (
          <span className={styles.cardCategory}>{post.category.name}</span>
        )}
        <h2 className={styles.cardTitle}>{post.title}</h2>
        {post.excerpt && <p className={styles.cardExcerpt}>{post.excerpt}</p>}
        <div className={styles.cardMeta}>
          {post.readingTimeMin && <span>{post.readingTimeMin} min read</span>}
          {post.publishedAt && (
            <>
              <span className={styles.dot}>&middot;</span>
              <span>{fmtDate(post.publishedAt)}</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

export function BlogIndex() {
  const [categories,  setCategories]  = useState([]);
  const [posts,       setPosts]       = useState([]);
  const [featured,    setFeatured]    = useState([]);
  const [activecat,   setActivecat]   = useState(null);
  const [page,        setPage]        = useState(1);
  const [total,       setTotal]       = useState(0);
  const [loading,     setLoading]     = useState(true);

  const PAGE_SIZE = 12;

  useEffect(() => {
    api.get('/blog/categories').then(r => setCategories(r.categories)).catch(() => {});
    api.get('/blog/featured').then(r => setFeatured(r.posts)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: PAGE_SIZE });
    if (activecat) params.set('category', activecat);
    api.get(`/blog/posts?${params}`)
      .then(r => { setPosts(r.posts); setTotal(r.total); })
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, [activecat, page]);

  function handleCategory(slug) {
    setActivecat(slug === activecat ? null : slug);
    setPage(1);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className={styles.page}>
      <PageMeta
        title="The Creatrbase Blog — Commercial intelligence for independent creators"
        description="Scoring guides, brand deal strategy, and creator economy insight for independent creators on YouTube and Twitch."
        canonical="https://creatrbase.com/blog"
        ogImage="/brand/og-image-with-tagline.png"
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'Blog',
        name: 'The Creatrbase Blog', url: 'https://creatrbase.com/blog',
        description: 'Scoring guides, brand deal strategy, and creator economy insight for independent creators on YouTube and Twitch.',
        publisher: { '@type': 'Organization', name: 'Creatrbase', url: 'https://creatrbase.com' },
      }) }} />

      <PublicNav variant="v2" />

      <main className={styles.main}>
        <header className={styles.hero}>
          <span className={styles.eyebrow}><span className={styles.eyebrowDot} /> Blog</span>
          <h1 className={styles.heroTitle}>The Creatrbase Blog</h1>
          <p className={styles.heroDesc}>
            Commercial intelligence for independent creators
          </p>
        </header>

        {/* Category filter */}
        {categories.length > 0 && (
          <div className={styles.catFilter}>
            <button
              className={[styles.catBtn, !activecat ? styles.catBtnActive : ''].filter(Boolean).join(' ')}
              onClick={() => handleCategory(null)}
            >
              All
            </button>
            {categories.map(c => (
              <button
                key={c.slug}
                className={[styles.catBtn, activecat === c.slug ? styles.catBtnActive : ''].filter(Boolean).join(' ')}
                onClick={() => handleCategory(c.slug)}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {/* Featured */}
        {!activecat && featured.length > 0 && (
          <section className={styles.featuredSection}>
            {featured.map(p => <PostCard key={p.id} post={p} featured />)}
          </section>
        )}

        {/* Post grid */}
        {loading ? (
          <p className={styles.loading}>Loading&hellip;</p>
        ) : posts.length === 0 ? (
          <p className={styles.empty}>No posts in this category yet. Check back soon.</p>
        ) : (
          <div className={styles.grid}>
            {posts.map(p => <PostCard key={p.id} post={p} />)}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className={styles.pagination}>
            <button
              className={styles.pageBtn}
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              &larr; Previous
            </button>
            <span className={styles.pageInfo}>Page {page} of {totalPages}</span>
            <button
              className={styles.pageBtn}
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              Next &rarr;
            </button>
          </div>
        )}
      </main>

      <MarketingFooter />
    </div>
  );
}
