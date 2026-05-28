#!/usr/bin/env node
// scripts/test-ratelimit.js
// Verifies the @fastify/rate-limit allowList correctly exempts localhost.
// Boots a Fastify app on a real TCP port, hammers it via http.request,
// and asserts:
//   1. 250 requests from 127.0.0.1 all succeed (allowList works)
//   2. 250 requests with a non-allowlisted key get capped at 200
//
// This is the bug fix for app.js: localhost (prerender script source) must
// bypass the 200 req/min limiter so it cannot poison the prerender cache
// with 429 responses.

const Fastify = require('fastify');
const http    = require('http');

function request(port, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, path, method: 'GET', headers },
      (res) => {
        res.on('data', () => {});
        res.on('end', () => resolve(res.statusCode));
      },
    );
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  // Match production config exactly: IP-based key, localhost in allowList.
  const app = Fastify({ logger: false, trustProxy: true });
  await app.register(require('@fastify/rate-limit'), {
    global:     true,
    max:        200,
    timeWindow: '1 minute',
    keyGenerator: (req) => req.ip,
    allowList:  ['127.0.0.1', '::1', '::ffff:127.0.0.1'],
  });
  app.get('/probe', async () => ({ ok: true }));

  await app.listen({ port: 0, host: '127.0.0.1' });
  const port = app.server.address().port;

  let ok = 0, limited = 0;
  for (let i = 0; i < 250; i++) {
    const code = await request(port, '/probe');
    if (code === 200) ok++;
    else if (code === 429) limited++;
  }
  await app.close();

  console.log(`localhost (127.0.0.1): 200=${ok}, 429=${limited}`);
  if (limited !== 0) {
    console.error('FAIL: localhost was rate-limited (allowList not honoured).');
    process.exit(1);
  }
  if (ok !== 250) {
    console.error(`FAIL: expected 250 OKs from localhost, got ${ok}.`);
    process.exit(1);
  }

  // ── Sanity: same app config, but key forced to a non-allowlisted value ────
  const app2 = Fastify({ logger: false });
  await app2.register(require('@fastify/rate-limit'), {
    global:     true,
    max:        200,
    timeWindow: '1 minute',
    // Force a key that is NOT in the allowList.
    keyGenerator: () => 'sim-public-ip',
    allowList:  ['127.0.0.1', '::1', '::ffff:127.0.0.1'],
  });
  app2.get('/probe', async () => ({ ok: true }));
  await app2.listen({ port: 0, host: '127.0.0.1' });
  const port2 = app2.server.address().port;

  let ok2 = 0, limited2 = 0;
  for (let i = 0; i < 250; i++) {
    const code = await request(port2, '/probe');
    if (code === 200) ok2++;
    else if (code === 429) limited2++;
  }
  await app2.close();

  console.log(`forced public key:     200=${ok2}, 429=${limited2}`);
  if (limited2 === 0) {
    console.error('FAIL: non-allowlisted key was NOT rate-limited.');
    process.exit(1);
  }
  if (ok2 !== 200) {
    console.error(`FAIL: expected exactly 200 OKs before limit, got ${ok2}.`);
    process.exit(1);
  }

  console.log('PASS: rate-limit allowList correctly bypasses localhost while still capping others at 200/min.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
