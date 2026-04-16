import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { LogoWordmark } from '../../components/ui/LogoWordmark';
import { PageMeta } from '../../components/PageMeta/PageMeta';
import styles from './BlogIndex.module.css';

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function PostCard({ post, featured = false }) {
  return (
    <Link to={`/blog/${post.slug}`} className={[styles.card, featured ? styles.cardFeatured : ''].filter(Boolean).join(' ')}>
      {post.coverImageUrl && (
        <div className={styles.cardImg}>
          <img src={post.coverImageUrl} alt={post.title} loading="lazy" />
        </div>
      )}
      <div className={styles.cardBody}>
        {post.category && (
          <span className={styles.cardCategory}>{post.category.name}</span>
        )}
        <h2 className={styles.cardTitle}>{post.title}</h2>
        {post.excerpt && <p className={styles.cardExcerpt}>{post.excerpt}</p>}
        <div className={styles.cardMeta}>
          <span>{post.authorName}</span>
          {post.publishedAt && (
            <>
              <span className={styles.dot}>·</span>
              <span>{fmtDate(post.publishedAt)}</span>
            </>
          )}
          {post.readingTimeMin && (
            <>
              <span className={styles.dot}>·</span>
              <span>{post.readingTimeMin} min read</span>
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
        title="Blog"
        description="Creator economy insights, brand deal tactics, platform guides, and growth strategies from the Creatrbase team."
        canonical="https://creatrbase.com/blog"
      />

      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <Link to="/"><LogoWordmark className={styles.logo} /></Link>
          <div className={styles.navActions}>
            <Link to="/login"  className={styles.navLink}>Log in</Link>
            <Link to="/signup" className={styles.navCta}>Get started free</Link>
          </div>
        </div>
      </nav>

      <main className={styles.main}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>Creatrbase Blog</p>
          <h1 className={styles.heroTitle}>Creator economy intelligence</h1>
          <p className={styles.heroDesc}>
            Brand deal tactics, growth strategies, platform guides, and data on the creator economy.
          </p>
        </header>

        {/* Featured */}
        {!activecat && featured.length > 0 && (
          <section className={styles.featuredSection}>
            <div className={styles.featuredGrid}>
              {featured.map(p => <PostCard key={p.id} post={p} featured />)}
            </div>
          </section>
        )}

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

        {/* Post grid */}
        {loading ? (
          <p className={styles.loading}>Loading…</p>
        ) : posts.length === 0 ? (
          <p className={styles.empty}>No posts yet — check back soon.</p>
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
              ← Previous
            </button>
            <span className={styles.pageInfo}>{page} / {totalPages}</span>
            <button
              className={styles.pageBtn}
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              Next →
            </button>
          </div>
        )}
      </main>

      <footer className={styles.footer}>
        <p className={styles.footerText}>
          &copy; {new Date().getFullYear()} Creatrbase &mdash;{' '}
          <Link to="/privacy" className={styles.footerLink}>Privacy</Link>{' '}
          &middot;{' '}
          <Link to="/terms" className={styles.footerLink}>Terms</Link>
        </p>
      </footer>
    </div>
  );
}
