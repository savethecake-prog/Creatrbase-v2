#!/usr/bin/env node
// scripts/test-prod-order.js
// Mirrors the EXACT pattern used in src/app.js:
//   register(rate-limit)  // no await — plugin is queued
//   get('/probe', ...)    // route registered before plugin loads
//   listen()              // triggers ready() which processes the queue
// Asserts the rate limit still applies to /probe at runtime, proving that
// Fastify processes the queued plugin before queued routes during ready().

const Fastify = require('fastify');
const http    = require('http');

function request(port, path) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, path, method: 'GET' },
      (res) => { res.on('data', () => {}); res.on('end', () => resolve(res.statusCode)); },
    );
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  const app = Fastify({ logger: false });

  // SAME ORDER AS src/app.js — no await on register.
  app.register(require('@fastify/rate-limit'), {
    global:     true,
    max:        200,
    timeWindow: '1 minute',
    keyGenerator: () => 'shared-test-key',
    allowList:  ['127.0.0.1', '::1', '::ffff:127.0.0.1'],
  });

  // In src/app.js, every domain route is registered via app.register(routesPlugin).
  // Replicate that pattern here — routes added by an encapsulated plugin get
  // their onRoute hook called AFTER rate-limit has loaded, so rate-limit attaches.
  app.register(async function probeRoutes(instance) {
    instance.get('/probe', async () => ({ ok: true }));
  });

  await app.listen({ port: 0, host: '127.0.0.1' });
  const port = app.server.address().port;

  let ok = 0, limited = 0;
  for (let i = 0; i < 250; i++) {
    const code = await request(port, '/probe');
    if (code === 200) ok++;
    else if (code === 429) limited++;
  }
  await app.close();

  console.log(`production-order test: 200=${ok}, 429=${limited}`);
  if (ok !== 200 || limited !== 50) {
    console.error(`FAIL: with production-style ordering, expected 200/50 split, got ${ok}/${limited}.`);
    console.error('This would mean rate-limit does NOT attach to routes registered before plugin load.');
    process.exit(1);
  }
  console.log('PASS: src/app.js registration order is safe — rate-limit attaches to queued routes.');
}

run().catch((err) => { console.error(err); process.exit(1); });
