/**
 * PageMeta — React 19 document metadata hoisting.
 * Renders <title>, <meta>, <link> elements that React 19 automatically
 * hoists into <head>. No external dependency required.
 *
 * Props:
 *   title       — page-specific title (appended with " | Creatrbase")
 *   description — page description (truncated to 155 chars)
 *   canonical   — full canonical URL (https://creatrbase.com/...)
 *   ogImage     — Open Graph image URL. Relative paths are auto-resolved
 *                 to absolute against SITE_ORIGIN — social crawlers (FB,
 *                 LinkedIn) do not reliably resolve relative og:image URLs.
 *   ogType      — Open Graph type. Defaults to "website". Set to "article"
 *                 for blog posts and other editorial content.
 *   noIndex     — if true, adds noindex,nofollow (use on all auth pages)
 */

const SITE_NAME    = 'Creatrbase';
const SITE_ORIGIN  = 'https://creatrbase.com';
const DEFAULT_DESC = 'Know your Commercial Viability Score. Track your gap to brand deals. Represent yourself directly — without an agency.';
const DEFAULT_OG   = `${SITE_ORIGIN}/og-image.png`;

function toAbsoluteUrl(url) {
  if (!url) return DEFAULT_OG;
  // Already absolute (http, https, or protocol-relative)
  if (/^https?:\/\//i.test(url) || url.startsWith('//')) return url;
  // Site-relative path → resolve against origin
  if (url.startsWith('/')) return `${SITE_ORIGIN}${url}`;
  // Anything else (data: URI, etc.) — leave as is
  return url;
}

function buildFullTitle(title) {
  if (!title) return `${SITE_NAME} — Commercial Intelligence for Creators`;
  // If the caller already worked the brand name into their title (e.g.
  // "About Creatrbase — Creator commercial intelligence"), don't append
  // " | Creatrbase" — that yielded titles like "Pricing — Creatrbase | Creatrbase".
  if (title.toLowerCase().includes(SITE_NAME.toLowerCase())) return title;
  return `${title} | ${SITE_NAME}`;
}

export function PageMeta({ title, description, canonical, ogImage, ogType = 'website', noIndex = false }) {
  const fullTitle = buildFullTitle(title);

  const rawDesc  = description ?? DEFAULT_DESC;
  const desc     = rawDesc.length > 155 ? rawDesc.slice(0, 152) + '...' : rawDesc;
  const imageUrl = toAbsoluteUrl(ogImage);

  return (
    <>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      {canonical && <link rel="canonical" href={canonical} />}

      {/* Open Graph */}
      <meta property="og:type"        content={ogType} />
      <meta property="og:site_name"   content={SITE_NAME} />
      <meta property="og:title"       content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:image"       content={imageUrl} />
      {canonical && <meta property="og:url" content={canonical} />}

      {/* Twitter / X */}
      <meta name="twitter:card"        content="summary_large_image" />
      <meta name="twitter:title"       content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image"       content={imageUrl} />

      {noIndex && <meta name="robots" content="noindex,nofollow" />}
    </>
  );
}
