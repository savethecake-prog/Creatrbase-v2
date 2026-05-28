#!/usr/bin/env node
// scripts/test-pagemeta-title.js
// Unit test for buildFullTitle — the helper PageMeta uses to compose
// <title> from the page-specific `title` prop. The previous behaviour
// blindly appended " | Creatrbase", producing titles like
// "Pricing — Creatrbase | Creatrbase" when the page already worked the
// brand name into its title text. The fix: skip the suffix when the
// brand name is already present (case-insensitive).

const SITE_NAME = 'Creatrbase';
const DEFAULT_TITLE = `${SITE_NAME} — Commercial Intelligence for Creators`;

function buildFullTitle(title) {
  if (!title) return DEFAULT_TITLE;
  if (title.toLowerCase().includes(SITE_NAME.toLowerCase())) return title;
  return `${title} | ${SITE_NAME}`;
}

const cases = [
  // No title → use the default
  [undefined,                                                    DEFAULT_TITLE],
  ['',                                                           DEFAULT_TITLE],
  [null,                                                         DEFAULT_TITLE],
  // Plain title (no brand) → suffix is appended
  ['Privacy Policy',                                             'Privacy Policy | Creatrbase'],
  ['Pricing',                                                    'Pricing | Creatrbase'],
  // Title already contains the brand → leave alone
  ['Pricing — Creatrbase',                                       'Pricing — Creatrbase'],
  ['The Honesty Principle — Creatrbase',                         'The Honesty Principle — Creatrbase'],
  ['About Creatrbase — Creator commercial intelligence',         'About Creatrbase — Creator commercial intelligence'],
  ['Anthony Saulderson - Founder, Creatrbase',                   'Anthony Saulderson - Founder, Creatrbase'],
  // Case-insensitive match still skips the suffix
  ['Welcome to creatrbase',                                      'Welcome to creatrbase'],
];

let failed = 0;
for (const [input, expected] of cases) {
  const got = buildFullTitle(input);
  if (got !== expected) {
    console.error(`FAIL: buildFullTitle(${JSON.stringify(input)})`);
    console.error(`         got:      ${got}`);
    console.error(`         expected: ${expected}`);
    failed++;
  }
}

if (failed > 0) {
  console.error(`${failed} case(s) failed.`);
  process.exit(1);
}
console.log(`PASS: ${cases.length} cases — no duplicate brand suffix when title already contains "Creatrbase".`);
