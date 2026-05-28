#!/usr/bin/env node
// scripts/test-not-found.js
// Verifies the setNotFoundHandler logic in src/app.js — specifically that:
//   1. Unknown public URLs get HTTP 404 (no more soft 404 for SEO)
//   2. SPA app/auth routes still get HTTP 200 (so browsers don't treat
//      /dashboard, /login, etc. as broken responses)
//   3. /api/* and blocked patterns get a 404 JSON body, no HTML
//
// We don't boot the full src/app.js (it needs DB) — we replicate the same
// handler logic against a stub Fastify app.

const Fastify = require('fastify');
const http    = require('http');

const SPA_ROUTE_PREFIXES = [
  '/dashboard', '/gap', '/tasks', '/outreach', '/negotiations',
  '/connections', '/settings', '/community', '/toolkit', '/power',
  '/onboarding', '/admin', '/login', '/signup',
];

const BLOCKED = /\.(env|git|aws|pem|key|crt|p12|pfx|htpasswd|bash_history|ssh)(\/|$)|wp-(admin|login|includes)|xmlrpc\.php/i;

function request(port, path) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, path, method: 'GET' },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({
          code: res.statusCode,
          contentType: res.headers['content-type'],
          body: Buffer.concat(chunks).toString(),
        }));
      },
    );
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  const app = Fastify({ logger: false });

  app.setNotFoundHandler(async (req, reply) => {
    if (req.url.startsWith('/api/')) {
      return reply.code(404).send({ error: 'Not Found', statusCode: 404 });
    }
    if (BLOCKED.test(req.url)) {
      return reply.code(404).send({ error: 'Not Found', statusCode: 404 });
    }
    const cleanPath = req.url.split('?')[0].split('#')[0];
    const isSpaAppRoute = SPA_ROUTE_PREFIXES.some(
      (p) => cleanPath === p || cleanPath.startsWith(p + '/'),
    );
    if (isSpaAppRoute) {
      return reply.code(200).type('text/html').send('<html>SPA</html>');
    }
    return reply.code(404).type('text/html').send('<html>NotFound</html>');
  });

  await app.listen({ port: 0, host: '127.0.0.1' });
  const port = app.server.address().port;

  const cases = [
    // [path, expectedCode, expectedBodyHint]
    ['/api/nonexistent',            404, 'Not Found'],
    ['/api/v1/missing',             404, 'Not Found'],
    ['/.env',                       404, 'Not Found'],
    ['/wp-admin/setup',             404, 'Not Found'],
    ['/dashboard',                  200, 'SPA'],
    ['/dashboard/sub-page',         200, 'SPA'],
    ['/login',                      200, 'SPA'],
    ['/signup',                     200, 'SPA'],
    ['/admin',                      200, 'SPA'],
    ['/admin/skills',               200, 'SPA'],
    ['/settings',                   200, 'SPA'],
    ['/community',                  200, 'SPA'],
    // These are public unknown URLs — the prerender hook would already serve
    // valid ones with 200, so anything reaching here should be 404.
    ['/this-page-does-not-exist',   404, 'NotFound'],
    ['/blog/nonexistent-post',      404, 'NotFound'],
    ['/random-garbage',             404, 'NotFound'],
    ['/some/nested/junk',           404, 'NotFound'],
  ];

  let failed = 0;
  for (const [path, expectedCode, hint] of cases) {
    const res = await request(port, path);
    const passCode = res.code === expectedCode;
    const passBody = res.body.includes(hint);
    if (!passCode || !passBody) {
      console.error(
        `FAIL ${path} → ${res.code} ${res.body.slice(0, 60)} ` +
        `(expected ${expectedCode} containing "${hint}")`,
      );
      failed++;
    }
  }

  await app.close();

  if (failed > 0) {
    console.error(`${failed} case(s) failed.`);
    process.exit(1);
  }
  console.log(`PASS: ${cases.length} cases — app routes return 200, unknown URLs return 404.`);
}

run().catch((err) => { console.error(err); process.exit(1); });
