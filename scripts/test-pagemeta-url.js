#!/usr/bin/env node
// scripts/test-pagemeta-url.js
// Unit test for the toAbsoluteUrl helper that PageMeta uses to convert
// relative og:image paths to absolute URLs. Social crawlers (FB, LinkedIn)
// do not reliably resolve relative paths against the page origin, so
// every og:image and twitter:image MUST be an absolute URL.

const SITE_ORIGIN = 'https://creatrbase.com';
const DEFAULT_OG  = `${SITE_ORIGIN}/og-image.png`;

function toAbsoluteUrl(url) {
  if (!url) return DEFAULT_OG;
  if (/^https?:\/\//i.test(url) || url.startsWith('//')) return url;
  if (url.startsWith('/')) return `${SITE_ORIGIN}${url}`;
  return url;
}

const cases = [
  // [input, expected]
  ['/brand/og-image-with-tagline.png', 'https://creatrbase.com/brand/og-image-with-tagline.png'],
  ['/og-image.png',                    'https://creatrbase.com/og-image.png'],
  ['https://example.com/x.png',        'https://example.com/x.png'],
  ['http://example.com/x.png',         'http://example.com/x.png'],
  ['//cdn.example.com/x.png',          '//cdn.example.com/x.png'],
  [undefined,                          DEFAULT_OG],
  [null,                               DEFAULT_OG],
  ['',                                 DEFAULT_OG],
];

let failed = 0;
for (const [input, expected] of cases) {
  const got = toAbsoluteUrl(input);
  if (got !== expected) {
    console.error(`FAIL: toAbsoluteUrl(${JSON.stringify(input)}) → ${got} (expected ${expected})`);
    failed++;
  }
}

if (failed > 0) {
  console.error(`${failed} case(s) failed.`);
  process.exit(1);
}
console.log(`PASS: ${cases.length} cases — relative paths resolve, absolute pass through, missing falls back to DEFAULT_OG.`);
