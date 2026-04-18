import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { PublicNav } from '../../components/PublicNav/PublicNav';
import { MarketingFooter } from '../../components/MarketingFooter/MarketingFooter';
import { PageMeta } from '../../components/PageMeta/PageMeta';
import { NewsletterSignup } from '../../components/NewsletterSignup/NewsletterSignup';
import styles from './BlogArticle.module.css';

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

export function BlogArticle() {
  const { slug }     = useParams();
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
        <PublicNav variant="v2" />
        <main className={styles.main}>
          <div className={styles.notFound}>
            <p className={styles.notFoundTitle}>Post not found</p>
            <Link to="/blog" className={styles.backLink}>&larr; Back to blog</Link>
          </div>
        </main>
        <MarketingFooter />
      </div>
    );
  }

  if (!post) {
    return (
      <div className={styles.page}>
        <PublicNav variant="v2" />
        <main className={styles.main}>
          <p className={styles.loading}>Loading&hellip;</p>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <PageMeta
        title={post.title}
        description={post.excerpt || post.meta_description}
        canonical={`https://creatrbase.com/blog/${post.slug}`}
        ogImage={post.coverImageUrl || '/brand/og-image-with-tagline.png'}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'Article',
        headline: post.title,
        description: post.excerpt || post.meta_description || '',
        author: { '@type': 'Organization', name: 'Creatrbase' },
        publisher: { '@type': 'Organization', name: 'Creatrbase', url: 'https://creatrbase.com', logo: { '@type': 'ImageObject', url: 'https://creatrbase.com/brand/og-image.png' } },
        datePublished: post.publishedAt,
        dateModified: post.updatedAt || post.publishedAt,
        url: `https://creatrbase.com/blog/${post.slug}`,
        image: post.coverImageUrl || 'https://creatrbase.com/brand/og-image-with-tagline.png',
      }) }} />

      <PublicNav variant="v2" />

      <main className={styles.main}>
        <div className={styles.breadcrumb}>
          <Link to="/blog" className={styles.breadLink}>Blog</Link>
          {post.category && (
            <>
              <span className={styles.breadSep}>&rsaquo;</span>
              <span className={styles.breadCurrent}>{post.category.name}</span>
            </>
          )}
        </div>

        <article className={styles.article}>
          <header className={styles.articleHeader}>
            {post.category && (
              <span className={styles.category}>{post.category.name}</span>
            )}
            <h1 className={styles.title}>{post.title}</h1>
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

          {/* Mid-article CTA */}
          <div className={styles.midCta}>
            <h3 className={styles.midCtaTitle}>Score your channel in under a minute</h3>
            <a href="/#score" className={styles.midCtaBtn}>Get my score &rarr;</a>
          </div>
        </article>

        <div style={{ margin: '40px 0' }}>
          <NewsletterSignup
            source="blog"
            sourceDetail={slug}
            variant="block"
            copy={{ eyebrow: 'Keep reading', title: 'Subscribe to the Creatrbase newsletter.', body: 'Commercial intelligence for independent creators. Three sends per week, opt out of any segment.', cta: 'Subscribe' }}
          />
        </div>

        <div className={styles.articleFooter}>
          <Link to="/blog" className={styles.backLink}>&larr; Back to blog</Link>
          <a href="/#score" className={styles.footerCta}>Score my channel &rarr;</a>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
