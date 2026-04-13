'use strict';

const {
  createCheckoutSession,
  createPortalSession,
  handleWebhook,
  getSubscription,
} = require('./billingService');
const { authenticate } = require('../../middleware/authenticate');

const APP_URL = process.env.APP_URL || 'https://creatrbase.com';

const PRICE_IDS = {
  core: process.env.STRIPE_PRICE_CORE,
  pro:  process.env.STRIPE_PRICE_PRO,
};

async function billingRoutes(app) {
  // ── POST /api/billing/checkout ──────────────────────────────────────────────
  app.post('/api/billing/checkout', { preHandler: authenticate }, async (req, reply) => {
    const { plan } = req.body ?? {};
    const priceId = PRICE_IDS[plan];

    if (!priceId) {
      return reply.code(400).send({ error: 'Invalid plan. Must be "core" or "pro".' });
    }

    const sub = await getSubscription(req.user.tenantId);
    if (!sub) {
      return reply.code(404).send({ error: 'No subscription found.' });
    }

    const url = await createCheckoutSession({
      stripeCustomerId: sub.stripe_customer_id,
      priceId,
      tenantId:    req.user.tenantId,
      successUrl:  `${APP_URL}/dashboard?upgraded=1`,
      cancelUrl:   `${APP_URL}/dashboard`,
    });

    return { url };
  });

  // ── POST /api/billing/portal ────────────────────────────────────────────────
  app.post('/api/billing/portal', { preHandler: authenticate }, async (req, reply) => {
    const sub = await getSubscription(req.user.tenantId);
    if (!sub) {
      return reply.code(404).send({ error: 'No subscription found.' });
    }

    const url = await createPortalSession({
      stripeCustomerId: sub.stripe_customer_id,
      returnUrl:        `${APP_URL}/dashboard`,
    });

    return { url };
  });

  // ── GET /api/billing/subscription ───────────────────────────────────────────
  app.get('/api/billing/subscription', { preHandler: authenticate }, async (req) => {
    const sub = await getSubscription(req.user.tenantId);
    if (!sub) return { subscription: null };

    const trialDaysLeft = sub.trialEnd
      ? Math.max(0, Math.ceil((new Date(sub.trialEnd) - new Date()) / (1000 * 60 * 60 * 24)))
      : null;

    return {
      subscription: {
        status:        sub.status,
        planName:      sub.plan?.name,
        trialEnd:      sub.trialEnd,
        trialDaysLeft,
        features:      sub.plan?.features,
        periodEnd:     sub.currentPeriodEnd,
      },
    };
  });

  // ── POST /api/billing/webhook ───────────────────────────────────────────────
  // Needs raw body — scoped parser only affects this encapsulated plugin
}

// Webhook needs its own encapsulated scope to parse raw body
async function webhookRoute(app) {
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    req.rawBody = body;
    try {
      done(null, JSON.parse(body));
    } catch (err) {
      done(err);
    }
  });

  app.post('/api/billing/webhook', async (req, reply) => {
    const signature = req.headers['stripe-signature'];
    if (!signature) {
      return reply.code(400).send({ error: 'Missing Stripe signature' });
    }
    const result = await handleWebhook(req.rawBody, signature);
    return result;
  });
}

module.exports = { billingRoutes, webhookRoute };
