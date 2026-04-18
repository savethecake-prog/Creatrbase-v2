'use strict';

const Stripe = require('stripe');
const { getPrisma } = require('../../lib/prisma');

function getStripe() {
  return Stripe(process.env.STRIPE_SECRET_KEY);
}

const TRIAL_DAYS = 14;

// ─── Stripe customer ──────────────────────────────────────────────────────────

async function createStripeCustomer(email, name) {
  const customer = await getStripe().customers.create({ email, name });
  return customer.id;
}

// ─── Trial subscription ───────────────────────────────────────────────────────
// Called after signup — no card required.
// Accepts an optional Prisma transaction client (tx); falls back to global prisma.

async function createTrialSubscription({ tenantId, stripeCustomerId }, tx) {
  const db   = tx ?? getPrisma();
  const plan = await db.subscriptionPlan.findFirst({
    where: { name: 'core', currency: 'GBP' },
  });

  if (!plan) throw new Error('Core plan not found — run migration 011');

  const now      = new Date();
  const trialEnd = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  await db.subscription.upsert({
    where:  { tenantId },
    update: {},   // already exists — do nothing (idempotent)
    create: {
      tenantId,
      planId:          plan.id,
      stripeCustomerId,
      status:          'trialling',
      trialStart:      now,
      trialEnd,
    },
  });
}

// ─── Free subscription ────────────────────────────────────────────────────
// Called at signup — creates a free-tier subscription with no Stripe involvement.

async function createFreeSubscription({ tenantId }, tx) {
  const db   = tx ?? getPrisma();
  const plan = await db.subscriptionPlan.findFirst({
    where: { name: 'free' },
  });

  if (!plan) throw new Error('Free plan not found - run migration 024');

  await db.subscription.upsert({
    where:  { tenantId },
    update: {},
    create: {
      tenantId,
      planId: plan.id,
      status: 'active',
    },
  });
}

// ─── Checkout session ─────────────────────────────────────────────────────────

async function createCheckoutSession({ stripeCustomerId, priceId, tenantId, successUrl, cancelUrl }) {
  const session = await getStripe().checkout.sessions.create({
    customer:              stripeCustomerId,
    mode:                  'subscription',
    line_items:            [{ price: priceId, quantity: 1 }],
    success_url:           successUrl,
    cancel_url:            cancelUrl,
    allow_promotion_codes: true,
    metadata:              { tenantId },
    subscription_data:     { metadata: { tenantId } },
  });
  return session.url;
}

// ─── Customer portal ──────────────────────────────────────────────────────────

async function createPortalSession({ stripeCustomerId, returnUrl }) {
  const session = await getStripe().billingPortal.sessions.create({
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
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const e = new Error(`Webhook signature verification failed: ${err.message}`);
    e.statusCode = 400;
    throw e;
  }

  const prisma = getPrisma();

  // Log every event (idempotent — unique constraint on stripe_event_id)
  await prisma.billingEvent.upsert({
    where:  { stripeEventId: event.id },
    update: {},
    create: { stripeEventId: event.id, eventType: event.type, payload: event },
  });

  switch (event.type) {
    case 'checkout.session.completed':
      await onCheckoutComplete(prisma, event.data.object);
      break;
    case 'customer.subscription.updated':
      await onSubscriptionUpdated(prisma, event.data.object);
      break;
    case 'customer.subscription.deleted':
      await onSubscriptionDeleted(prisma, event.data.object);
      break;
    case 'invoice.payment_failed':
      await onPaymentFailed(prisma, event.data.object);
      break;
  }

  await prisma.billingEvent.update({
    where: { stripeEventId: event.id },
    data:  { processed: true, processedAt: new Date() },
  });

  return { received: true };
}

async function onCheckoutComplete(prisma, session) {
  const tenantId = session.metadata?.tenantId;
  if (!tenantId || !session.subscription) return;

  const sub = await getStripe().subscriptions.retrieve(session.subscription);

  await prisma.subscription.update({
    where: { tenantId },
    data:  {
      stripeSubscriptionId: sub.id,
      status:               'active',
      currentPeriodStart:   new Date(sub.current_period_start * 1000),
      currentPeriodEnd:     new Date(sub.current_period_end   * 1000),
    },
  });
}

async function onSubscriptionUpdated(prisma, sub) {
  const tenantId = sub.metadata?.tenantId;
  if (!tenantId) return;

  const statusMap = {
    active:     'active',
    past_due:   'past_due',
    canceled:   'cancelled',
    paused:     'paused',
    incomplete: 'incomplete',
    trialing:   'trialling',
  };

  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: sub.id },
    data:  {
      status:             statusMap[sub.status] ?? sub.status,
      currentPeriodStart: new Date(sub.current_period_start * 1000),
      currentPeriodEnd:   new Date(sub.current_period_end   * 1000),
      cancelAtPeriodEnd:  sub.cancel_at_period_end,
    },
  });
}

async function onSubscriptionDeleted(prisma, sub) {
  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: sub.id },
    data:  { status: 'cancelled', cancelledAt: new Date() },
  });
}

async function onPaymentFailed(prisma, invoice) {
  if (!invoice.subscription) return;
  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: invoice.subscription },
    data:  { status: 'past_due' },
  });
}

// ─── Read helpers ─────────────────────────────────────────────────────────────

async function getSubscription(tenantId) {
  return getPrisma().subscription.findUnique({
    where:   { tenantId },
    include: { plan: { select: { name: true, amountMonthly: true, features: true } } },
  });
}

module.exports = {
  createStripeCustomer,
  createTrialSubscription,
  createFreeSubscription,
  createCheckoutSession,
  createPortalSession,
  handleWebhook,
  getSubscription,
};
