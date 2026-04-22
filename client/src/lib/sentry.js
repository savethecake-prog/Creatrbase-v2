import * as Sentry from '@sentry/react';

// Set VITE_SENTRY_DSN in .env (client-side vars must be prefixed VITE_)
// No-ops silently when unset.

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: import.meta.env.PROD ? 0.05 : 0,
  });
}

export function captureException(err, context = {}) {
  if (!import.meta.env.VITE_SENTRY_DSN) return;
  Sentry.withScope(scope => {
    Object.entries(context).forEach(([k, v]) => scope.setExtra(k, v));
    Sentry.captureException(err);
  });
}
