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

  const newStatus  = statusMap[sub.status] ?? sub.status;
  const updateData = {
    status:             newStatus,
    currentPeriodStart: new Date(sub.current_period_start * 1000),
    currentPeriodEnd:   new Date(sub.current_period_end   * 1000),
    cancelAtPeriodEnd:  sub.cancel_at_period_end,
  };

  // Reset payment-failed email flag when subscription recovers to active
  if (newStatus === 'active') updateData.paymentFailedEmailSent = false;

  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: sub.id },
    data:  updateData,
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

  const sub = await prisma.subscription.findFirst({
    where:  { stripeSubscriptionId: invoice.subscription },
    select: { id: true, tenantId: true, paymentFailedEmailSent: true },
  });
  if (!sub) return;

  await prisma.subscription.update({
    where: { id: sub.id },
    data:  { status: 'past_due' },
  });

  if (!sub.paymentFailedEmailSent && process.env.RESEND_API_KEY) {
    try {
      await sendPaymentFailedEmail(prisma, sub.tenantId, invoice.customer);
      await prisma.subscription.update({
        where: { id: sub.id },
        data:  { paymentFailedEmailSent: true },
      });
    } catch (err) {
      console.error('[billingService] payment failed email error:', err.message);
    }
  }
}

async function sendPaymentFailedEmail(prisma, tenantId, stripeCustomerId) {
  const APP_URL = process.env.APP_URL || 'https://creatrbase.com';

  const creator = await prisma.creator.findFirst({
    where:  { tenantId },
    select: { userId: true, displayName: true, user: { select: { email: true } } },
  });
  if (!creator?.user?.email) return;

  // Generate a direct portal link if possible
  let portalUrl = `${APP_URL}/dashboard`;
  try {
    const portal = await getStripe().billingPortal.sessions.create({
      customer:   stripeCustomerId,
      return_url: `${APP_URL}/dashboard`,
    });
    portalUrl = portal.url;
  } catch (_) {}

  const { Resend }         = require('resend');
  const { generateToken }  = require('../../services/unsubscribeToken');
  const token    = generateToken(creator.userId);
  const unsubUrl = `${APP_URL}/api/unsubscribe?token=${token}&uid=${encodeURIComponent(creator.userId)}`;
  const name     = String(creator.displayName ?? 'there').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from:    'Creatrbase <notifications@dashboard.creatrbase.com>',
    to:      creator.user.email,
    subject: 'Payment failed — update your card to keep access',
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Payment failed</title></head>
<body style="margin:0;padding:0;background:#05040A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td align="center" style="padding:32px 16px">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%">
        <tr><td style="padding:0 0 24px"><p style="margin:0;font-size:22px;font-weight:900;color:#9EFFD8;letter-spacing:-0.02em">creatrbase</p></td></tr>
        <tr><td style="padding:0 0 16px">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#111019;border:1px solid rgba(255,255,255,0.08);border-radius:16px">
            <tr><td style="padding:24px 32px">
              <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#FFBFA3">PAYMENT FAILED</p>
              <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#F5F4FF">Your payment didn't go through</p>
              <p style="margin:0 0 16px;font-size:14px;color:#9B99B0;line-height:1.6">Hey ${name} — your latest Creatrbase payment failed. Update your payment method to keep your Core subscription active.</p>
              <a href="${portalUrl}" style="display:inline-block;background:#FFBFA3;color:#05040A;font-size:13px;font-weight:700;padding:10px 22px;border-radius:999px;text-decoration:none">Update payment method →</a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:24px 0 0">
          <p style="margin:0;font-size:12px;color:#4A4860;text-align:center">This is a billing notification from Creatrbase. <a href="${unsubUrl}" style="color:#4A4860">Unsubscribe</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
    headers: {
      'List-Unsubscribe':      `<${unsubUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  });

  console.log(`[billingService] payment failed email sent: tenantId=${tenantId}`);
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
