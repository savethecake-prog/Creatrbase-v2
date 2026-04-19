'use strict';

require('dotenv').config();
const path = require('path');
const fs   = require('fs');
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
app.register(require('./domains/support/supportRoutes').supportRoutes);
app.register(require('./domains/gmail/gmailRoutes').gmailRoutes);
app.register(require('./domains/gapTracker/gapTrackerRoutes'));
app.register(require('./domains/creator/nicheRoutes'));
app.register(require('./domains/creator/scoreRoutes'));
app.register(require('./domains/creator/recommendationRoutes'));
app.register(require('./domains/creator/taskRoutes'));
app.register(require('./domains/creator/tagRoutes'));
app.register(require('./domains/brands/brandsRoutes'));
app.register(require('./domains/negotiations/negotiationsRoutes'));
app.register(require('./domains/signals/signalRoutes'));
app.register(require('./domains/admin/adminRoutes').adminRoutes);
app.register(require('./domains/newsletter/newsletterRoutes').newsletterRoutes);
app.register(require('./domains/compare/compareRoutes').compareRoutes);
app.register(require('./domains/programmatic/programmaticRoutes').programmaticRoutes);
app.register(require('./domains/public/publicRoutes'));
app.register(require('./domains/public/scoreCardRoutes').scoreCardRoutes);
app.register(require('./domains/public/claimRoutes').claimRoutes);
app.register(require('./domains/public/ogImage').ogImageRoutes);
app.register(require('./domains/blog/blogRoutes'));

// ── Background workers ────────────────────────────────────────────────────────

require('./jobs/workers/platformSync').startPlatformSyncWorker();
require('./jobs/workers/contentAnalysis').startContentAnalysisWorker();
require('./jobs/workers/viabilityScoring').startViabilityScoringWorker();
require('./jobs/workers/recommendationEngine').startRecommendationEngineWorker();
require('./jobs/workers/emailDigest').startEmailDigestWorker();
require('./jobs/workers/gmailSync').startGmailSyncWorker();
require('./jobs/workers/taskCadence').startTaskCadenceWorker();
require('./jobs/workers/tagDetection').startTagDetectionWorker();
require('./jobs/workers/retentionNotifications').startRetentionNotificationsWorker();
require('./jobs/workers/ingestionFetcher').startIngestionFetcherWorker();
require('./jobs/workers/newsletterDigests').startNewsletterDigestWorkers();
require('./jobs/workers/signalProcessor').startSignalProcessorWorker();

// ── Static frontend (production only) ────────────────────────────────────────

if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'dist', 'client');
  const prerenderedDir = path.join(clientDist, '_prerendered');

  // Pre-rendered HTML hook: check before static files are served
  app.addHook('onRequest', async (req, reply) => {
    // Only intercept GET requests for HTML pages (not assets, API, etc.)
    if (req.method !== 'GET') return;
    if (req.url.startsWith('/api/')) return;
    if (/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|webp|map|txt|xml)(\?|$)/i.test(req.url)) return;

    const cleanPath = req.url.split('?')[0].split('#')[0];
    const prerenderedPath = cleanPath === '/'
      ? path.join(prerenderedDir, 'index.html')
      : path.join(prerenderedDir, cleanPath, 'index.html');

    if (fs.existsSync(prerenderedPath)) {
      const html = fs.readFileSync(prerenderedPath, 'utf8');
      reply.type('text/html').send(html);
    }
  });

  app.register(require('@fastify/static'), {
    root:   clientDist,
    prefix: '/',
  });

  app.setNotFoundHandler(async (req, reply) => {
    if (req.url.startsWith('/api/')) {
      return reply.code(404).send({ error: 'Not Found', statusCode: 404 });
    }
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
