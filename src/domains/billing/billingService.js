'use strict';

const Stripe = require('stripe');
const { getPool } = require('../../db/pool');

function getStripe() {
  return Stripe(process.env.STRIPE_SECRET_KEY);
}

const TRIAL_DAYS = 14;

// ─── Stripe customer ──────────────────────────────────────────────────────────

async function createStripeCustomer(email, name) {
  const stripe = getStripe();
  const customer = await stripe.customers.create({ email, name });
  return customer.id;
}

// ─── Trial subscription (called at signup — no card required) ─────────────────

async function createTrialSubscription(client, { tenantId, stripeCustomerId }) {
  const pool = getPool();
  const db = client ?? pool;

  const { rows: [plan] } = await db.query(
    `SELECT id FROM subscription_plans WHERE name = 'core' AND currency = 'GBP' LIMIT 1`
  );

  if (!plan) throw new Error('Core plan not found — run migration 011');

  const now = new Date();
  const trialEnd = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  await db.query(
    `INSERT INTO subscriptions
       (tenant_id, plan_id, stripe_customer_id, status, trial_start, trial_end)
     VALUES ($1, $2, $3, 'trialling', $4, $5)
     ON CONFLICT (tenant_id) DO NOTHING`,
    [tenantId, plan.id, stripeCustomerId, now, trialEnd]
  );
}

// ─── Checkout session ─────────────────────────────────────────────────────────

async function createCheckoutSession({ stripeCustomerId, priceId, tenantId, successUrl, cancelUrl }) {
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    customer:                stripeCustomerId,
    mode:                    'subscription',
    line_items:              [{ price: priceId, quantity: 1 }],
    success_url:             successUrl,
    cancel_url:              cancelUrl,
    allow_promotion_codes:   true,
    metadata:                { tenantId },
    subscription_data: {
      metadata: { tenantId },
    },
  });

  return session.url;
}

// ─── Customer portal ──────────────────────────────────────────────────────────

async function createPortalSession({ stripeCustomerId, returnUrl }) {
  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer:   stripeCustomerId,
    return_url: returnUrl,
  });
  return session.url;
}

// ─── Webhook handler ──────────────────────────────────────────────────────────

async function handleWebhook(rawBody, signature) {
  const stripe = getStripe();
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    const e = new Error(`Webhook signature verification failed: ${err.message}`);
    e.statusCode = 400;
    throw e;
  }

  const pool = getPool();

  // Log every event (idempotent)
  await pool.query(
    `INSERT INTO billing_events (stripe_event_id, event_type, payload)
     VALUES ($1, $2, $3)
     ON CONFLICT (stripe_event_id) DO NOTHING`,
    [event.id, event.type, JSON.stringify(event)]
  );

  switch (event.type) {
    case 'checkout.session.completed':
      await onCheckoutComplete(pool, event.data.object);
      break;
    case 'customer.subscription.updated':
      await onSubscriptionUpdated(pool, event.data.object);
      break;
    case 'customer.subscription.deleted':
      await onSubscriptionDeleted(pool, event.data.object);
      break;
    case 'invoice.payment_failed':
      await onPaymentFailed(pool, event.data.object);
      break;
  }

  // Mark processed
  await pool.query(
    `UPDATE billing_events SET processed = TRUE, processed_at = NOW()
     WHERE stripe_event_id = $1`,
    [event.id]
  );

  return { received: true };
}

async function onCheckoutComplete(pool, session) {
  const tenantId = session.metadata?.tenantId;
  if (!tenantId || !session.subscription) return;

  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(session.subscription);

  await pool.query(
    `UPDATE subscriptions SET
       stripe_subscription_id = $1,
       status                 = 'active',
       current_period_start   = to_timestamp($2),
       current_period_end     = to_timestamp($3),
       updated_at             = NOW()
     WHERE tenant_id = $4`,
    [
      sub.id,
      sub.current_period_start,
      sub.current_period_end,
      tenantId,
    ]
  );
}

async function onSubscriptionUpdated(pool, sub) {
  const tenantId = sub.metadata?.tenantId;
  if (!tenantId) return;

  const statusMap = {
    active:    'active',
    past_due:  'past_due',
    canceled:  'cancelled',
    paused:    'paused',
    incomplete:'incomplete',
    trialing:  'trialling',
  };

  await pool.query(
    `UPDATE subscriptions SET
       status               = $1,
       current_period_start = to_timestamp($2),
       current_period_end   = to_timestamp($3),
       cancel_at_period_end = $4,
       updated_at           = NOW()
     WHERE stripe_subscription_id = $5`,
    [
      statusMap[sub.status] ?? sub.status,
      sub.current_period_start,
      sub.current_period_end,
      sub.cancel_at_period_end,
      sub.id,
    ]
  );
}

async function onSubscriptionDeleted(pool, sub) {
  await pool.query(
    `UPDATE subscriptions SET
       status       = 'cancelled',
       cancelled_at = NOW(),
       updated_at   = NOW()
     WHERE stripe_subscription_id = $1`,
    [sub.id]
  );
}

async function onPaymentFailed(pool, invoice) {
  if (!invoice.subscription) return;
  await pool.query(
    `UPDATE subscriptions SET status = 'past_due', updated_at = NOW()
     WHERE stripe_subscription_id = $1`,
    [invoice.subscription]
  );
}

// ─── Read helpers ─────────────────────────────────────────────────────────────

async function getSubscription(tenantId) {
  const { rows } = await getPool().query(
    `SELECT s.*, sp.name AS plan_name, sp.amount_monthly, sp.features
     FROM subscriptions s
     JOIN subscription_plans sp ON sp.id = s.plan_id
     WHERE s.tenant_id = $1`,
    [tenantId]
  );
  return rows[0] ?? null;
}

module.exports = {
  createStripeCustomer,
  createTrialSubscription,
  createCheckoutSession,
  createPortalSession,
  handleWebhook,
  getSubscription,
};
