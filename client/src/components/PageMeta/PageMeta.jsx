/**
 * PageMeta — React 19 document metadata hoisting.
 * Renders <title>, <meta>, <link> elements that React 19 automatically
 * hoists into <head>. No external dependency required.
 *
 * Props:
 *   title       — page-specific title (appended with " | Creatrbase")
 *   description — page description (truncated to 155 chars)
 *   canonical   — full canonical URL (https://creatrbase.com/...)
 *   ogImage     — Open Graph image URL (defaults to /og-image.png)
 *   noIndex     — if true, adds noindex,nofollow (use on all auth pages)
 */

const SITE_NAME    = 'Creatrbase';
const DEFAULT_DESC = 'Know your Commercial Viability Score. Track your gap to brand deals. Represent yourself directly — without an agency.';
const DEFAULT_OG   = 'https://creatrbase.com/og-image.png';

export function PageMeta({ title, description, canonical, ogImage, noIndex = false }) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — Commercial Intelligence for Creators`;

  const rawDesc  = description ?? DEFAULT_DESC;
  const desc     = rawDesc.length > 155 ? rawDesc.slice(0, 152) + '...' : rawDesc;
  const imageUrl = ogImage || DEFAULT_OG;

  return (
    <>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      {canonical && <link rel="canonical" href={canonical} />}

      {/* Open Graph */}
      <meta property="og:type"        content="website" />
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
