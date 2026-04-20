#!/usr/bin/env node
// scripts/export-logos.js
// Exports brand assets to PNG at all sizes needed for app stores, OAuth consent
// screens, TikTok portal, and social profiles.
//
// Icon (square): trajectory mark from favicon.svg — dark and light variants
// Wordmark (wide): trajectory mark + "creatrbase" in Cunia — dark and light
//
// Output: client/public/brand/
// Usage:  node scripts/export-logos.js

const puppeteer = require('puppeteer');
const fs        = require('fs');
const path      = require('path');

const FAVICON_SVG = path.join(__dirname, '../client/public/favicon.svg');
const CUNIA_TTF   = path.join(__dirname, '../client/public/fonts/Cunia.ttf');
const OUT_DIR     = path.join(__dirname, '../client/public/brand');

// base64-encode Cunia so Puppeteer can use it without a file server
const cuniaB64 = fs.readFileSync(CUNIA_TTF).toString('base64');
const CUNIA_CSS = `@font-face {
  font-family: 'Cunia';
  src: url('data:font/truetype;base64,${cuniaB64}') format('truetype');
  font-weight: 400;
  font-style: normal;
}`;

const faviconSvgSrc = fs.readFileSync(FAVICON_SVG, 'utf8');

// ── Helpers ───────────────────────────────────────────────────────────────────

function iconHtml(size, dark) {
  const bg     = dark ? '#1B1040' : '#FAF6EF';
  const stroke = dark ? '#9EFFD8' : '#1B1040';
  const innerOpacity = dark ? 0.75 : 0.15;
  const rx     = Math.round(size * 14 / 56); // proportional to favicon's rx="14" at 56px

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${size}px; height: ${size}px; overflow: hidden; background: ${bg}; }
  svg { display: block; width: ${size}px; height: ${size}px; }
</style>
</head>
<body>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" width="${size}" height="${size}" fill="none">
  <rect x="2" y="2" width="52" height="52" rx="14" fill="${bg}"/>
  <rect x="5" y="5" width="46" height="46" rx="11" fill="none" stroke="${stroke}" stroke-width="2" opacity="${innerOpacity}"/>
  <path d="M11 40 L21 32 L28 36 L40 18" stroke="${stroke}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M33.1 19.4 L40 18 L41.4 24.9" stroke="${stroke}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
</body>
</html>`;
}

function wordmarkHtml(height, dark) {
  const bg        = dark ? '#1B1040' : '#FAF6EF';
  const textColor = dark ? '#FAF6EF' : '#1B1040';
  const markColor = dark ? '#9EFFD8' : '#1B1040';
  const innerOp   = dark ? 0.75 : 0.15;
  const markSize  = height;
  const fontSize  = Math.round(height * 0.78);
  const gap       = Math.round(height * 0.28);
  const totalW    = markSize + gap + Math.round(fontSize * 9) + Math.round(height * 0.4); // approx text width

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  ${CUNIA_CSS}
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: ${totalW}px;
    height: ${height}px;
    overflow: hidden;
    background: ${bg};
    display: flex;
    align-items: center;
  }
  .wrap {
    display: flex;
    align-items: center;
    gap: ${gap}px;
    padding: 0 ${Math.round(height * 0.3)}px 0 ${Math.round(height * 0.2)}px;
    white-space: nowrap;
  }
  svg { display: block; flex-shrink: 0; }
  span {
    font-family: 'Cunia', sans-serif;
    font-size: ${fontSize}px;
    font-weight: 400;
    letter-spacing: -0.08em;
    color: ${textColor};
    line-height: 1;
    user-select: none;
  }
</style>
</head>
<body>
<div class="wrap">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" width="${markSize}" height="${markSize}" fill="none">
    <rect x="2" y="2" width="52" height="52" rx="14" fill="${bg}"/>
    <rect x="5" y="5" width="46" height="46" rx="11" fill="none" stroke="${markColor}" stroke-width="2" opacity="${innerOp}"/>
    <path d="M11 40 L21 32 L28 36 L40 18" stroke="${markColor}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M33.1 19.4 L40 18 L41.4 24.9" stroke="${markColor}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
  <span>creatrbase</span>
</div>
</body>
</html>`;
}

// ── Export list ───────────────────────────────────────────────────────────────

const ICON_EXPORTS = [
  { name: 'logo-512.png',       size: 512, dark: true,  note: 'Google OAuth, TikTok portal' },
  { name: 'logo-512-light.png', size: 512, dark: false, note: 'Google OAuth light variant' },
  { name: 'logo-400.png',       size: 400, dark: true,  note: 'Twitter/X profile picture' },
  { name: 'logo-300.png',       size: 300, dark: true,  note: 'LinkedIn page logo' },
  { name: 'logo-256.png',       size: 256, dark: true,  note: 'General' },
  { name: 'logo-128.png',       size: 128, dark: true,  note: 'General' },
  // Keep existing favicon sizes in sync
  { name: 'favicon-96.png',      size: 96,  dark: true,  note: 'Favicon' },
  { name: 'favicon-96-light.png',size: 96,  dark: false, note: 'Favicon light' },
  { name: 'favicon-32.png',      size: 32,  dark: true,  note: 'Favicon' },
  { name: 'favicon-32-light.png',size: 32,  dark: false, note: 'Favicon light' },
  { name: 'favicon-16.png',      size: 16,  dark: true,  note: 'Favicon' },
  { name: 'favicon-16-light.png',size: 16,  dark: false, note: 'Favicon light' },
];

const WORDMARK_EXPORTS = [
  { name: 'wordmark-dark.png',  height: 56, dark: true,  note: 'Full wordmark dark' },
  { name: 'wordmark-light.png', height: 56, dark: false, note: 'Full wordmark light' },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    // Icons
    console.log('Exporting icons...');
    for (const { name, size, dark, note } of ICON_EXPORTS) {
      const page = await browser.newPage();
      await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
      await page.setContent(iconHtml(size, dark), { waitUntil: 'domcontentloaded' });
      const out = path.join(OUT_DIR, name);
      await page.screenshot({ path: out, type: 'png' });
      console.log(`  ${name.padEnd(24)} ${size}×${size}  ${note}`);
      await page.close();
    }

    // Wordmarks
    console.log('Exporting wordmarks...');
    for (const { name, height, dark, note } of WORDMARK_EXPORTS) {
      const html  = wordmarkHtml(height, dark);
      // Parse approximate width from the html style
      const wMatch = html.match(/width: (\d+)px/);
      const width  = wMatch ? parseInt(wMatch[1]) : 400;

      const page = await browser.newPage();
      await page.setViewport({ width, height, deviceScaleFactor: 2 }); // 2x for crispness
      await page.setContent(html, { waitUntil: 'networkidle0' });
      await new Promise(r => setTimeout(r, 300)); // font paint
      const out = path.join(OUT_DIR, name);
      await page.screenshot({ path: out, type: 'png' });
      console.log(`  ${name.padEnd(24)} ${width}×${height}  ${note}`);
      await page.close();
    }
  } finally {
    await browser.close();
  }

  console.log(`\nAll exports written to ${OUT_DIR}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
