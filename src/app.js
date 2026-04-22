'use strict';

require('dotenv').config();
const path = require('path');
const fs   = require('fs');
const Fastify = require('fastify');
const { initSentry } = require('./lib/sentry');

initSentry();

// ── Startup validation ────────────────────────────────────────────────────────
// Fail fast rather than surfacing crypto errors mid-request
try {
  const { encrypt } = require('./lib/crypto');
  encrypt('startup-check'); // validates ENCRYPTION_KEY at boot
} catch (err) {
  console.error('[startup] Encryption key validation failed:', err.message);
  process.exit(1);
}

const app = Fastify({ logger: true });

// ── Plugins ───────────────────────────────────────────────────────────────────

app.register(require('@fastify/helmet'), {
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      scriptSrc: [
        "'self'",
        'https://plausible.io',
        'https://js.stripe.com',
        // Hashes for inline scripts in client/index.html
        "'sha256-Ebt84R/xi8miDnxS/0/bkTjVgDRKQpWS1eI09TLbNkg='", // plausible init
        "'sha256-bd5mhxix5nvOwxvyJuVf/HSQa6XelRbC3Ze3lH97gaw='", // theme init
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",              // CSS modules inject inline styles
        'https://fonts.googleapis.com',
      ],
      fontSrc:   ["'self'", 'https://fonts.gstatic.com'],
      imgSrc:    ["'self'", 'data:', 'https:'],  // avatars from YouTube/Twitch vary by channel
      connectSrc: [
        "'self'",
        'https://plausible.io',
        'https://js.stripe.com',
        'https://api.stripe.com',
        'https://accounts.google.com',
        'https://oauth2.googleapis.com',
        'https://www.googleapis.com',
        'https://youtubeanalytics.googleapis.com',
        'https://gmail.googleapis.com',
        'https://id.twitch.tv',
        'https://api.twitch.tv',
        'https://open.tiktokapis.com',
        'https://graph.instagram.com',
        'https://api.instagram.com',
      ],
      frameSrc:       ['https://js.stripe.com', 'https://hooks.stripe.com'],
      frameAncestors: ["'none'"],
      formAction:     ["'self'"],
      baseUri:        ["'self'"],
    },
  },
});

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Global default: 200 req/min per IP. Sensitive routes override below.

app.register(require('@fastify/rate-limit'), {
  global:     true,
  max:        200,
  timeWindow: '1 minute',
  keyGenerator: (req) => req.ip,
  errorResponseBuilder: () => ({
    statusCode: 429,
    error:      'Too Many Requests',
    message:    'Rate limit exceeded. Please slow down.',
  }),
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
app.register(require('./domains/webhooks/gmailWebhookRoutes').gmailWebhookRoutes);
app.register(require('./domains/admin/adminRoutes').adminRoutes);
app.register(require('./domains/admin/contentRoutes').contentRoutes);
app.register(require('./domains/admin/tokenCleanupRoutes').tokenCleanupRoutes);
app.register(require('./domains/admin/acquisitionRoutes').acquisitionRoutes);
app.register(require('./domains/newsletter/newsletterRoutes').newsletterRoutes);
app.register(require('./domains/compare/compareRoutes').compareRoutes);
app.register(require('./domains/programmatic/programmaticRoutes').programmaticRoutes);
app.register(require('./domains/public/publicRoutes'));
app.register(require('./domains/public/scoreCardRoutes').scoreCardRoutes);
app.register(require('./domains/public/claimRoutes').claimRoutes);
app.register(require('./domains/public/ogImage').ogImageRoutes);
app.register(require('./domains/blog/blogRoutes'));
app.register(require('./domains/gdpr/gdprRoutes').gdprRoutes);
app.register(require('./domains/apikeys/apiKeyRoutes').apiKeyRoutes);
app.register(require('./domains/roadmap/roadmapRoutes').roadmapRoutes);
app.register(require('./domains/community/communityRoutes').communityRoutes);
app.register(require('./domains/contacts/contactRoutes').contactRoutes);
app.register(require('./domains/commercialCoach/auditRoutes'));
app.register(require('./domains/commercialCoach/coachRoutes'));

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
require('./jobs/workers/contentResearch').startContentResearchWorkers();
require('./jobs/workers/contactDiscovery').startContactDiscoveryWorker();
require('./jobs/workers/gdprHardDelete').startGdprHardDeleteWorker();

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

  const uploadsDir = path.join(__dirname, '..', 'uploads');
  app.register(require('@fastify/static'), {
    root:        uploadsDir,
    prefix:      '/uploads/',
    decorateReply: false,
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
