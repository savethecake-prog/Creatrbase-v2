import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { LogoWordmark } from '../../components/ui/LogoWordmark';
import { PageMeta } from '../../components/PageMeta/PageMeta';
import styles from './BlogArticle.module.css';

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

export function BlogArticle() {
  const { slug }     = useParams();
  const navigate     = useNavigate();
  const [post,  setPost]  = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setPost(null);
    setError(false);
    api.get(`/blog/posts/${slug}`)
      .then(r => setPost(r.post))
      .catch(() => setError(true));
  }, [slug]);

  if (error) {
    return (
      <div className={styles.page}>
        <PageMeta title="Post not found" noIndex={true} />
        <nav className={styles.nav}>
          <div className={styles.navInner}>
            <Link to="/"><LogoWordmark className={styles.logo} /></Link>
          </div>
        </nav>
        <main className={styles.main}>
          <div className={styles.notFound}>
            <p className={styles.notFoundTitle}>Post not found</p>
            <Link to="/blog" className={styles.backLink}>← Back to blog</Link>
          </div>
        </main>
      </div>
    );
  }

  if (!post) {
    return (
      <div className={styles.page}>
        <nav className={styles.nav}>
          <div className={styles.navInner}>
            <Link to="/"><LogoWordmark className={styles.logo} /></Link>
          </div>
        </nav>
        <main className={styles.main}>
          <p className={styles.loading}>Loading…</p>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <PageMeta
        title={post.title}
        description={post.excerpt}
        canonical={`https://creatrbase.com/blog/${post.slug}`}
        ogImage={post.coverImageUrl}
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
        <div className={styles.breadcrumb}>
          <Link to="/blog" className={styles.breadLink}>Blog</Link>
          {post.category && (
            <>
              <span className={styles.breadSep}>›</span>
              <Link to={`/blog?category=${post.category.slug}`} className={styles.breadLink}>{post.category.name}</Link>
            </>
          )}
        </div>

        <article className={styles.article}>
          <header className={styles.articleHeader}>
            {post.category && (
              <span className={styles.category}>{post.category.name}</span>
            )}
            <h1 className={styles.title}>{post.title}</h1>
            {post.excerpt && (
              <p className={styles.excerpt}>{post.excerpt}</p>
            )}
            <div className={styles.meta}>
              {post.authorAvatar && (
                <img src={post.authorAvatar} alt={post.authorName} className={styles.avatar} />
              )}
              <div className={styles.metaText}>
                <span className={styles.authorName}>{post.authorName}</span>
                <span className={styles.metaSecondary}>
                  {fmtDate(post.publishedAt)}
                  {post.readingTimeMin && ` · ${post.readingTimeMin} min read`}
                </span>
              </div>
            </div>
          </header>

          {post.coverImageUrl && (
            <div className={styles.cover}>
              <img src={post.coverImageUrl} alt={post.title} />
            </div>
          )}

          <div
            className={styles.body}
            dangerouslySetInnerHTML={{ __html: post.bodyHtml || '<p>Content coming soon.</p>' }}
          />
        </article>

        <div className={styles.footer}>
          <Link to="/blog" className={styles.backLink}>← Back to blog</Link>
          <Link to="/signup" className={styles.footerCta}>
            Try Creatrbase free →
          </Link>
        </div>
      </main>

      <footer className={styles.pageFooter}>
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
