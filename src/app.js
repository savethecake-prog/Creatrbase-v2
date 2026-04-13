'use strict';

require('dotenv').config();
const path = require('path');
const Fastify = require('fastify');

const app = Fastify({ logger: true });

// ── Plugins ───────────────────────────────────────────────────────────────────

app.register(require('@fastify/helmet'), {
  contentSecurityPolicy: false, // will tighten once frontend is stable
});

app.register(require('@fastify/cors'), {
  origin:      process.env.NODE_ENV === 'production' ? 'https://creatrbase.com' : true,
  credentials: true,
});

app.register(require('@fastify/cookie'));

app.register(require('@fastify/jwt'), {
  secret: process.env.JWT_SECRET || process.env.SESSION_SECRET,
  cookie: {
    cookieName: 'cb_session',
    signed:     false,
  },
});

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/health', async () => ({ status: 'ok' }));

app.register(require('./domains/auth/authRoutes'));

const { billingRoutes, webhookRoute } = require('./domains/billing/billingRoutes');
app.register(billingRoutes);
app.register(webhookRoute);

app.register(require('./domains/platforms/platformConnectRoutes'));
app.register(require('./domains/gapTracker/gapTrackerRoutes'));
app.register(require('./domains/creator/nicheRoutes'));
app.register(require('./domains/creator/scoreRoutes'));

// ── Background workers ────────────────────────────────────────────────────────

require('./jobs/workers/platformSync').startPlatformSyncWorker();
require('./jobs/workers/contentAnalysis').startContentAnalysisWorker();
require('./jobs/workers/viabilityScoring').startViabilityScoringWorker();

// ── Static frontend (production only) ────────────────────────────────────────

if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'dist', 'client');

  app.register(require('@fastify/static'), {
    root:   clientDist,
    prefix: '/',
  });

  app.setNotFoundHandler(async (req, reply) => {
    if (req.url.startsWith('/api/')) {
      return reply.code(404).send({ error: 'Not Found', statusCode: 404 });
    }
    // Block common credential-scanning paths — return 404, never serve index.html
    const blocked = /\.(env|git|aws|pem|key|crt|p12|pfx|htpasswd|bash_history|ssh)(\/|$)|wp-(admin|login|includes)|xmlrpc\.php/i;
    if (blocked.test(req.url)) {
      return reply.code(404).send({ error: 'Not Found', statusCode: 404 });
    }
    return reply.sendFile('index.html');
  });
}

// ── Error handler ─────────────────────────────────────────────────────────────

app.setErrorHandler((err, req, reply) => {
  const status = err.statusCode ?? err.status ?? 500;
  app.log.error(err);
  return reply.code(status).send({
    error:      err.message || 'Internal Server Error',
    statusCode: status,
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────

const start = async () => {
  try {
    await app.listen({ port: process.env.PORT || 3000, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
