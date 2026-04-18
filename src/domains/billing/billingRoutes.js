'use strict';

const {
  createCheckoutSession,
  createPortalSession,
  createStripeCustomer,
  createTrialSubscription,
  handleWebhook,
  getSubscription,
} = require('./billingService');
const { authenticate } = require('../../middleware/authenticate');
const { resolveTier }  = require('../../services/tierResolver');

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

    // Create Stripe customer if free-tier user upgrading directly
    let stripeCustomerId = sub.stripeCustomerId;
    if (!stripeCustomerId) {
      stripeCustomerId = await createStripeCustomer(req.user.email, req.user.displayName);
    }

    const url = await createCheckoutSession({
      stripeCustomerId,
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
      stripeCustomerId: sub.stripeCustomerId,
      returnUrl:        `${APP_URL}/dashboard`,
    });

    return { url };
  });

  // ── POST /api/billing/start-trial ────────────────────────────────────────────
  // For free-tier users to start a 14-day trial on core plan.
  // Creates Stripe customer if needed, then creates trial subscription.
  app.post('/api/billing/start-trial', { preHandler: authenticate }, async (req, reply) => {
    const { tier } = await resolveTier(req.user.tenantId);
    if (tier !== 'free') {
      return reply.code(409).send({ error: 'You already have an active subscription.' });
    }

    const sub = await getSubscription(req.user.tenantId);
    let stripeCustomerId = sub?.stripeCustomerId;

    // Create Stripe customer if this user doesn't have one
    if (!stripeCustomerId) {
      stripeCustomerId = await createStripeCustomer(req.user.email, req.user.displayName);
    }

    await createTrialSubscription({ tenantId: req.user.tenantId, stripeCustomerId });

    return { success: true, tier: 'core', trialDays: 14 };
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
