#!/usr/bin/env node
// scripts/test-score-ratelimit.js
// Unit test for the in-memory score rate limiter in scoreCardRoutes.js.
// Two assertions:
//   1. Caps 5 requests per IP per hour (existing behaviour preserved)
//   2. Bounded memory: after simulating many one-shot IPs followed by a
//      forced time advance and one more request, the sweep prunes the
//      expired entries instead of growing forever.

const WINDOW_MS    = 3600_000;
const MAX_PER_HOUR = 5;
const SWEEP_AT     = 1000;

// Replicate the helper with an injectable "now" so we can fast-forward.
function makeLimiter() {
  const scoreRateLimit = new Map();

  function check(ip, nowOverride) {
    const now    = nowOverride ?? Date.now();
    const cutoff = now - WINDOW_MS;

    const existing = scoreRateLimit.get(ip);
    const times    = existing ? existing.filter((t) => t > cutoff) : [];

    if (times.length >= MAX_PER_HOUR) {
      scoreRateLimit.set(ip, times);
      return false;
    }
    times.push(now);
    scoreRateLimit.set(ip, times);

    if (scoreRateLimit.size > SWEEP_AT) {
      for (const [k, v] of scoreRateLimit) {
        if (v.every((t) => t <= cutoff)) scoreRateLimit.delete(k);
      }
    }
    return true;
  }

  return { check, size: () => scoreRateLimit.size };
}

let failed = 0;

// ── Case 1: per-IP cap holds at MAX_PER_HOUR ─────────────────────────────────
{
  const { check } = makeLimiter();
  const t0 = 1_000_000;
  const results = [];
  for (let i = 0; i < 7; i++) results.push(check('10.0.0.1', t0 + i));
  const expected = [true, true, true, true, true, false, false];
  if (JSON.stringify(results) !== JSON.stringify(expected)) {
    console.error(`FAIL case 1: got ${JSON.stringify(results)}, expected ${JSON.stringify(expected)}`);
    failed++;
  } else {
    console.log('PASS case 1: per-IP cap enforced at 5 within window.');
  }
}

// ── Case 2: window resets after WINDOW_MS ────────────────────────────────────
{
  const { check } = makeLimiter();
  const t0 = 2_000_000;
  for (let i = 0; i < 5; i++) check('10.0.0.2', t0 + i);
  // Same IP, just past the window — should be allowed again
  const after = check('10.0.0.2', t0 + WINDOW_MS + 1);
  if (after !== true) {
    console.error('FAIL case 2: request after window should be allowed.');
    failed++;
  } else {
    console.log('PASS case 2: window resets after 1 hour.');
  }
}

// ── Case 3: sweep prunes stale entries (memory bound) ────────────────────────
{
  const { check, size } = makeLimiter();
  // 1200 unique IPs, all stamping at t0. Map grows to 1200.
  const t0 = 3_000_000;
  for (let i = 0; i < 1200; i++) check(`192.168.0.${i}`, t0);

  const sizeBefore = size();
  if (sizeBefore !== 1200) {
    console.error(`FAIL case 3 setup: expected 1200 entries before sweep, got ${sizeBefore}`);
    failed++;
  }

  // Now advance time past the window and trigger one more request from a
  // NEW IP. The sweep runs (size > SWEEP_AT) and should prune the 1200
  // expired entries, leaving only the new one.
  check('203.0.113.1', t0 + WINDOW_MS + 10);

  const sizeAfter = size();
  if (sizeAfter > 5) {
    console.error(`FAIL case 3: sweep did not prune. Size after = ${sizeAfter} (expected ~1)`);
    failed++;
  } else {
    console.log(`PASS case 3: sweep pruned ${sizeBefore} → ${sizeAfter} after window expiry.`);
  }
}

if (failed > 0) {
  console.error(`${failed} case(s) failed.`);
  process.exit(1);
}
console.log('PASS: in-memory score rate limiter caps per IP and stays bounded.');
