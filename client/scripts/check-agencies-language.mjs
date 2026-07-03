#!/usr/bin/env node
// check-agencies-language.mjs — mechanical banned-language check over the agencies-route
// page copy (CB-KD-01 v1.1.1 s.10; CB-KD-06 s.6 "checked mechanically against the
// banned-language list before deployment"). Same matcher as the service's
// scripts/check-language.js (word/phrase boundaries, case-insensitive); the banned list
// (scripts/banned-language.json) is vendored from the service config so the check runs
// from this repo with no cross-repo path coupling. Re-copy that file if the list changes.
//
// Usage: node scripts/check-agencies-language.mjs   (scans src/pages/Agencies/**)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const { banned } = JSON.parse(fs.readFileSync(path.join(__dirname, 'banned-language.json'), 'utf8'));

const TARGET_DIR = path.join(ROOT, 'src', 'pages', 'Agencies');

function termRegex(term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`, 'gi');
}
const matchers = banned.map((b) => ({ term: b.term, reason: b.reason, re: termRegex(b.term) }));

function collect(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const s = fs.statSync(full);
    if (s.isDirectory()) out.push(...collect(full));
    else if (/\.(jsx?|css|md|txt)$/i.test(entry)) out.push(full);
  }
  return out;
}

const files = collect(TARGET_DIR);
let hits = 0;
for (const file of files) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const m of matchers) {
      m.re.lastIndex = 0;
      if (m.re.test(line)) {
        hits += 1;
        console.error(`${path.relative(ROOT, file)}:${i + 1}: banned term "${m.term}" — ${m.reason}\n    ${line.trim()}`);
      }
    }
  });
}

if (hits > 0) {
  console.error(`\ncheck-agencies-language: FAIL — ${hits} hit(s) across ${files.length} file(s).`);
  process.exit(1);
}
console.log(`check-agencies-language: PASS — 0 banned-language hits across ${files.length} file(s).`);
