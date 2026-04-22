'use strict';

// ── Sentry error tracking ─────────────────────────────────────────────────────
// Set SENTRY_DSN in .env to activate. No-ops silently when unset.

const Sentry = require('@sentry/node');

function initSentry() {
  if (!process.env.SENTRY_DSN) return;

  Sentry.init({
    dsn:         process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release:     process.env.npm_package_version,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
  });

  console.log('[sentry] Error tracking initialised');
}

function captureException(err, context = {}) {
  if (!process.env.SENTRY_DSN) return;
  Sentry.withScope(scope => {
    Object.entries(context).forEach(([k, v]) => scope.setExtra(k, v));
    Sentry.captureException(err);
  });
}

module.exports = { initSentry, captureException };
