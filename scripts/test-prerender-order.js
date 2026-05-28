#!/usr/bin/env node
// scripts/test-prerender-order.js
// Verifies that an onRequest hook registered BEFORE @fastify/rate-limit
// fires first and can short-circuit the request via reply.send(), even when
// the rate-limit budget is already exhausted.
//
// This is the second half of BUG-01's fix: even if some IP hammers the
// server and hits the global limit, requests for pre-rendered static HTML
// (which the early hook serves directly) should still succeed — they should
// never be 429'd.

const Fastify = require('fastify');
const http    = require('http');

function request(port, path) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, path, method: 'GET' },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({ code: res.statusCode, body: Buffer.concat(chunks).toString() }));
      },
    );
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  const app = Fastify({ logger: false });

  // ── Early onRequest hook (mirrors the pre-render serving hook in src/app.js)
  // It short-circuits requests for /prerendered/* and serves a fixed string,
  // identical to how the real one serves /dist/client/_prerendered/... HTML.
  app.addHook('onRequest', async (req, reply) => {
    if (req.url.startsWith('/prerendered/')) {
      reply.type('text/html').send('<html>PRERENDERED</html>');
    }
  });

  // ── Rate limit AFTER the early hook ───────────────────────────────────────
  app.register(require('@fastify/rate-limit'), {
    global:     true,
    max:        5,     // very tight, so we can exhaust it quickly
    timeWindow: '1 minute',
    keyGenerator: () => 'shared-test-key',
  });

  app.register(async function routes(instance) {
    instance.get('/dynamic', async () => ({ ok: true }));
  });

  await app.listen({ port: 0, host: '127.0.0.1' });
  const port = app.server.address().port;

  // Step 1: exhaust the rate limit on /dynamic
  for (let i = 0; i < 10; i++) await request(port, '/dynamic');

  // Step 2: confirm /dynamic is now rate-limited
  const dyn = await request(port, '/dynamic');
  if (dyn.code !== 429) {
    console.error(`FAIL: expected /dynamic to be 429 after exhaustion, got ${dyn.code}.`);
    await app.close();
    process.exit(1);
  }

  // Step 3: /prerendered/* should STILL serve, because the early hook ran first
  const pre = await request(port, '/prerendered/whatever');
  if (pre.code !== 200 || !pre.body.includes('PRERENDERED')) {
    console.error(`FAIL: expected /prerendered/* to short-circuit with HTML 200, got ${pre.code}: ${pre.body}`);
    await app.close();
    process.exit(1);
  }

  await app.close();
  console.log('PASS: early onRequest hook serves pre-rendered HTML even when rate limit is exhausted.');
}

run().catch((err) => { console.error(err); process.exit(1); });
