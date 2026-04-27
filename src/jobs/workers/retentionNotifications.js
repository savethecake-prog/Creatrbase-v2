'use strict';

// ─── Retention notifications worker ──────────────────────────────────────────
//
// Job types:
//
//   notifications:deal-nudge        {}
//     Daily: finds deals stuck in negotiating/outreach_sent for 7+ days,
//     emails the creator a nudge to follow up.
//
//   notifications:milestone-alert   { creatorId }
//     Triggered after every scoring run. Sends an email if any milestone
//     was crossed in the last 25 hours (daily job catches same-day crossings).
//
//   notifications:score-change      { creatorId }
//     Triggered after every scoring run. Sends email if score changed by
//     5+ points since the previous score entry.
//
//   notifications:brand-match       { creatorId }
//     Triggered after every scoring run. Emails the creator if they've newly
//     crossed the eligibility threshold for brands in their niche.
//
// ─────────────────────────────────────────────────────────────────────────────

const { Resend }             = require('resend');
const { getPrisma }          = require('../../lib/prisma');
const { getPool }            = require('../../db/pool');
const { getDataCollectionQueue } = require('../queue');
const { generateToken, isOptedOut } = require('../../services/unsubscribeToken');

const APP_URL = process.env.APP_URL || 'https://creatrbase.com';

// ─── Shared helpers ───────────────────────────────────────────────────────────

function getResend() {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY not set');
  return new Resend(process.env.RESEND_API_KEY);
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildUnsubUrl(userId) {
  const token = generateToken(userId);
  return `${APP_URL}/api/unsubscribe?token=${token}&uid=${encodeURIComponent(userId)}`;
}

function emailWrapper(subject, bodyHtml, unsubUrl, billingEmail = false) {
  const footerText = billingEmail
    ? 'This is a billing notification from Creatrbase.'
    : "You're receiving this from Creatrbase.";
  const footerLink = unsubUrl
    ? `${footerText} <a href="${unsubUrl}" style="color:#A69BB8;text-decoration:underline">Unsubscribe</a>`
    : footerText;
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escHtml(subject)}</title>
<style>@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Outfit:wght@600;700&display=swap');</style></head>
<body style="margin:0;padding:0;background:#FAF6EF;font-family:'DM Sans',system-ui,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td align="center" style="padding:40px 16px">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%">
        <tr><td style="padding:0 0 28px">
          <img src="https://creatrbase.com/brand/wordmark-light.png" width="160" alt="creatrbase" style="display:block;border:0">
        </td></tr>
        ${bodyHtml}
        <tr><td style="padding:20px 0 0">
          <p style="margin:0;font-size:12px;color:#A69BB8;text-align:center;font-family:'DM Sans',system-ui,sans-serif">
            ${footerLink}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function card(html) {
  return `<tr><td style="padding:0 0 16px">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
      style="background:#FFFFFF;border:1px solid #E8E1D4;border-radius:14px">
      <tr><td style="padding:28px 32px">${html}</td></tr>
    </table>
  </td></tr>`;
}

function ctaButton(text, href, variant) {
  const bg = variant === 'peach' ? '#FFBFA3' : '#9EFFD8';
  return `<a href="${href}" style="display:inline-block;background:${bg};color:#1B1040;font-family:'DM Sans',system-ui,sans-serif;font-size:14px;font-weight:700;padding:12px 26px;border-radius:9999px;text-decoration:none;box-shadow:3px 3px 0 #1B1040">${escHtml(text)}</a>`;
}

async function getCreatorEmailInfo(prisma, creatorId) {
  return prisma.creator.findUnique({
    where:  { id: creatorId },
    select: {
      id:          true,
      userId:      true,
      displayName: true,
      user:        { select: { email: true } },
    },
  });
}

// ─── 1. Deal activity nudge ───────────────────────────────────────────────────

async function sendDealNudge(prisma, resend, creatorId, brandName, daysSince) {
  const creator = await getCreatorEmailInfo(prisma, creatorId);
  if (!creator?.user?.email) return;
  if (await isOptedOut(prisma, creatorId)) return;

  const unsubUrl = buildUnsubUrl(creator.userId);
  const subject  = `Any update on your deal with ${brandName}?`;

  const body = card(`
    <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#76688F;font-family:'DM Sans',system-ui,sans-serif">DEAL UPDATE</p>
    <p style="margin:0 0 10px;font-family:'Outfit','DM Sans',system-ui,sans-serif;font-size:22px;font-weight:700;color:#1B1040;line-height:1.2;letter-spacing:-0.01em">Any update on your deal with ${escHtml(brandName)}?</p>
    <p style="margin:0 0 20px;font-size:15px;color:#76688F;line-height:1.6;font-family:'DM Sans',system-ui,sans-serif">
      It's been <strong style="color:#C56D45">${daysSince} days</strong> since your last activity on this deal.
      Staying on top of open negotiations keeps momentum — even a quick follow-up can move things forward.
    </p>
    ${ctaButton('Log an update →', `${APP_URL}/negotiations`)}
  `);

  await resend.emails.send({
    from:    'Creatrbase <notifications@dashboard.creatrbase.com>',
    to:      creator.user.email,
    subject,
    html:    emailWrapper(subject, body, unsubUrl),
    headers: {
      'List-Unsubscribe':      `<${unsubUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  });

  console.log(`[retentionNotifications] deal nudge sent: creator=${creatorId} brand=${brandName}`);
}

// ─── 2. Milestone alert ───────────────────────────────────────────────────────

const MILESTONE_LABELS = {
  giftable:               'Giftable',
  outreach_ready:         'Outreach Ready',
  paid_integration_viable:'Paid Integration Viable',
  rate_negotiation_power: 'Rate Negotiation Power',
  portfolio_creator:      'Portfolio Creator',
};

const MILESTONE_DESCRIPTIONS = {
  giftable:                'Brands can now consider you for gifting campaigns. Add some brands to your outreach list and start building relationships.',
  outreach_ready:          'Your metrics are strong enough to pitch brands directly. Start with brands in your niche — your pitch will land.',
  paid_integration_viable: 'You\'re now in range for paid integration deals. Time to put a rate card together and go after it.',
  rate_negotiation_power:  'You have enough leverage to negotiate rates with confidence. Don\'t undersell yourself.',
  portfolio_creator:       'You\'ve reached portfolio creator status. Agencies and brand managers will be looking at you.',
};

async function sendMilestoneAlert(prisma, resend, creatorId, milestoneType) {
  const creator = await getCreatorEmailInfo(prisma, creatorId);
  if (!creator?.user?.email) return;
  if (await isOptedOut(prisma, creatorId)) return;

  const unsubUrl = buildUnsubUrl(creator.userId);
  const label    = MILESTONE_LABELS[milestoneType] ?? milestoneType;
  const desc     = MILESTONE_DESCRIPTIONS[milestoneType] ?? 'Keep up the momentum.';
  const subject  = `You just unlocked: ${label}`;

  const body = card(`
    <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#4FB893;font-family:'DM Sans',system-ui,sans-serif">MILESTONE UNLOCKED</p>
    <p style="margin:0 0 10px;font-family:'Outfit','DM Sans',system-ui,sans-serif;font-size:26px;font-weight:700;color:#1B1040;line-height:1.2;letter-spacing:-0.01em">${escHtml(label)} 🎯</p>
    <p style="margin:0 0 20px;font-size:15px;color:#76688F;line-height:1.6;font-family:'DM Sans',system-ui,sans-serif">${escHtml(desc)}</p>
    ${ctaButton('See your score →', `${APP_URL}/dashboard`)}
  `);

  await resend.emails.send({
    from:    'Creatrbase <notifications@dashboard.creatrbase.com>',
    to:      creator.user.email,
    subject,
    html:    emailWrapper(`Milestone unlocked: ${label}`, body, unsubUrl),
    headers: {
      'List-Unsubscribe':      `<${unsubUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  });

  console.log(`[retentionNotifications] milestone alert sent: creator=${creatorId} milestone=${milestoneType}`);
}

// ─── 3. Score change notification ────────────────────────────────────────────

async function sendScoreChangeAlert(prisma, resend, creatorId, currentScore, previousScore) {
  const creator = await getCreatorEmailInfo(prisma, creatorId);
  if (!creator?.user?.email) return;
  if (await isOptedOut(prisma, creatorId)) return;

  const unsubUrl  = buildUnsubUrl(creator.userId);
  const delta     = currentScore - previousScore;
  const direction = delta > 0 ? 'up' : 'down';
  const color     = delta > 0 ? '#9EFFD8' : '#FFBFA3';
  const emoji     = delta > 0 ? '📈' : '📉';
  const verb      = delta > 0 ? 'increased' : 'dropped';
  const subject   = `Your score ${verb} by ${Math.abs(delta)} points`;

  const textColor = delta > 0 ? '#4FB893' : '#C56D45';
  const body = card(`
    <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#76688F;font-family:'DM Sans',system-ui,sans-serif">SCORE UPDATE</p>
    <p style="margin:0 0 12px;font-family:'Outfit','DM Sans',system-ui,sans-serif;font-size:26px;font-weight:700;color:#1B1040;line-height:1.2;letter-spacing:-0.01em">Your score ${verb} ${emoji}</p>
    <p style="margin:0 0 4px;font-family:'Outfit','DM Sans',system-ui,sans-serif;font-size:48px;font-weight:700;color:#1B1040;line-height:1;letter-spacing:-0.02em">
      ${currentScore}<span style="font-size:22px;color:#A69BB8;font-family:'DM Sans',system-ui,sans-serif">/100</span>
      <span style="font-size:20px;color:${textColor};font-family:'DM Sans',system-ui,sans-serif">(${delta > 0 ? '+' : ''}${delta})</span>
    </p>
    <p style="margin:16px 0 20px;font-size:15px;color:#76688F;line-height:1.6;font-family:'DM Sans',system-ui,sans-serif">
      Your commercial viability score ${verb} by <strong style="color:${textColor}">${Math.abs(delta)} points</strong> since your last sync.
      ${direction === 'up' ? 'Keep it going — check your dashboard to see what moved.' : 'Check your dashboard to see what changed and what to focus on next.'}
    </p>
    ${ctaButton('View breakdown →', `${APP_URL}/dashboard`)}
  `);

  await resend.emails.send({
    from:    'Creatrbase <notifications@dashboard.creatrbase.com>',
    to:      creator.user.email,
    subject,
    html:    emailWrapper(`Score update: ${currentScore}/100`, body, unsubUrl),
    headers: {
      'List-Unsubscribe':      `<${unsubUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  });

  console.log(`[retentionNotifications] score change alert sent: creator=${creatorId} delta=${delta}`);
}

// ─── 4. Brand match alert ─────────────────────────────────────────────────────

async function sendBrandMatchAlert(prisma, resend, creatorId, brandCount, niche) {
  const creator = await getCreatorEmailInfo(prisma, creatorId);
  if (!creator?.user?.email) return;
  if (await isOptedOut(prisma, creatorId)) return;

  const unsubUrl = buildUnsubUrl(creator.userId);
  const subject  = `${brandCount} brand${brandCount !== 1 ? 's' : ''} in your niche are now within reach`;

  const body = card(`
    <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#4FB893;font-family:'DM Sans',system-ui,sans-serif">BRAND MATCH</p>
    <p style="margin:0 0 10px;font-family:'Outfit','DM Sans',system-ui,sans-serif;font-size:24px;font-weight:700;color:#1B1040;line-height:1.2;letter-spacing:-0.01em">
      ${brandCount} brand${brandCount !== 1 ? 's' : ''} in your niche are now within reach
    </p>
    <p style="margin:0 0 20px;font-size:15px;color:#76688F;line-height:1.6;font-family:'DM Sans',system-ui,sans-serif">
      Your score has crossed the eligibility threshold for <strong style="color:#1B1040">${brandCount} ${escHtml(niche ?? 'niche')} brand${brandCount !== 1 ? 's' : ''}</strong>.
      Now is a good time to review your outreach list and start pitching.
    </p>
    ${ctaButton('View brands →', `${APP_URL}/outreach`)}
  `);

  await resend.emails.send({
    from:    'Creatrbase <notifications@dashboard.creatrbase.com>',
    to:      creator.user.email,
    subject,
    html:    emailWrapper('Brand match alert', body, unsubUrl),
    headers: {
      'List-Unsubscribe':      `<${unsubUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  });

  console.log(`[retentionNotifications] brand match alert sent: creator=${creatorId} brands=${brandCount}`);
}

// ─── Worker registration ──────────────────────────────────────────────────────

function startRetentionNotificationsWorker() {
  const queue  = getDataCollectionQueue();
  const prisma = getPrisma();
  const pool   = getPool();

  // ── notifications:deal-nudge ───────────────────────────────────────────────

  queue.process('notifications:deal-nudge', async (job) => {
    if (!process.env.RESEND_API_KEY) { job.log('RESEND_API_KEY not set — skipping'); return; }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Find the latest interaction per brand per creator where:
    // - stage is outreach_sent or negotiating
    // - last activity was 7+ days ago
    // - no more recent interaction exists
    const { rows } = await pool.query(`
      SELECT DISTINCT ON (bci.creator_id, bci.brand_id)
        bci.creator_id,
        bci.brand_id,
        bci.interaction_type,
        bci.created_at,
        b.brand_name,
        c.tenant_id
      FROM brand_creator_interactions bci
      JOIN brands b    ON b.id = bci.brand_id
      JOIN creators c  ON c.id = bci.creator_id
      WHERE bci.interaction_type IN ('outreach_sent', 'negotiating')
      ORDER BY bci.creator_id, bci.brand_id, bci.created_at DESC
    `);

    // Filter to ones with no recent activity
    const stale = rows.filter(r => new Date(r.created_at) < sevenDaysAgo);

    job.log(`Found ${stale.length} stale deal(s) to nudge`);

    const resend = getResend();
    for (const row of stale) {
      const daysSince = Math.floor((Date.now() - new Date(row.created_at).getTime()) / 86_400_000);
      try {
        await sendDealNudge(prisma, resend, row.creator_id, row.brand_name, daysSince);
      } catch (err) {
        job.log(`Failed to send nudge for creator=${row.creator_id}: ${err.message}`);
      }
    }
  });

  // ── notifications:milestone-alert ─────────────────────────────────────────

  queue.process('notifications:milestone-alert', async (job) => {
    const { creatorId } = job.data;
    if (!creatorId) throw new Error('notifications:milestone-alert missing creatorId');
    if (!process.env.RESEND_API_KEY) { job.log('RESEND_API_KEY not set — skipping'); return; }

    // Find milestones crossed in the last 25 hours
    const since = new Date(Date.now() - 25 * 60 * 60 * 1000);

    const milestones = await prisma.creatorMilestone.findMany({
      where: {
        creatorId,
        status:    'crossed',
        crossedAt: { gte: since },
      },
      select: { milestoneType: true },
    });

    if (milestones.length === 0) {
      job.log('No new milestones to notify');
      return;
    }

    const resend = getResend();
    // Notify for the highest-value milestone crossed (avoid email flood)
    const order = ['portfolio_creator', 'rate_negotiation_power', 'paid_integration_viable', 'outreach_ready', 'giftable'];
    const topMilestone = order.find(m => milestones.some(x => x.milestoneType === m));
    if (topMilestone) {
      await sendMilestoneAlert(prisma, resend, creatorId, topMilestone);
    }
  });

  // ── notifications:score-change ────────────────────────────────────────────

  queue.process('notifications:score-change', async (job) => {
    const { creatorId } = job.data;
    if (!creatorId) throw new Error('notifications:score-change missing creatorId');
    if (!process.env.RESEND_API_KEY) { job.log('RESEND_API_KEY not set — skipping'); return; }

    // Get last two score entries
    const history = await prisma.dimensionScoreHistory.findMany({
      where:   { creatorId },
      orderBy: { scoredAt: 'desc' },
      take:    2,
      select:  { overallScore: true },
    });

    if (history.length < 2) { job.log('Not enough score history — skipping'); return; }

    const current  = history[0].overallScore;
    const previous = history[1].overallScore;
    const delta    = current - previous;

    if (Math.abs(delta) < 5) {
      job.log(`Score delta ${delta} below threshold — skipping`);
      return;
    }

    const resend = getResend();
    await sendScoreChangeAlert(prisma, resend, creatorId, current, previous);
  });

  // ── notifications:brand-match ─────────────────────────────────────────────

  queue.process('notifications:brand-match', async (job) => {
    const { creatorId, previousScore } = job.data;
    if (!creatorId) throw new Error('notifications:brand-match missing creatorId');
    if (!process.env.RESEND_API_KEY) { job.log('RESEND_API_KEY not set — skipping'); return; }

    // Get current score + niche
    const profile = await prisma.creatorCommercialProfile.findUnique({
      where:  { creatorId },
      select: { commercialViabilityScore: true, primaryNicheSpecific: true, primaryNicheCategory: true },
    });
    if (!profile?.commercialViabilityScore) { job.log('No score — skipping'); return; }

    const currentScore = profile.commercialViabilityScore;
    const niche = profile.primaryNicheSpecific ?? profile.primaryNicheCategory;

    // Only notify if score crossed a meaningful threshold (30 = giftable, 50 = outreach ready)
    const THRESHOLDS = [30, 50, 65, 80];
    const crossed = THRESHOLDS.filter(t => (previousScore ?? 0) < t && currentScore >= t);
    if (crossed.length === 0) { job.log('No threshold crossed — skipping'); return; }

    // Count brands in niche the creator hasn't outreached to
    const { rows } = await pool.query(`
      SELECT COUNT(*) AS cnt
      FROM brands b
      WHERE (b.category ILIKE $1 OR b.sub_category ILIKE $1)
        AND b.id NOT IN (
          SELECT brand_id FROM brand_creator_interactions WHERE creator_id = $2
        )
    `, [niche ? `%${niche}%` : '%', creatorId]);

    const brandCount = parseInt(rows[0]?.cnt ?? '0', 10);
    if (brandCount === 0) { job.log('No uncontacted brands in niche — skipping'); return; }

    const resend = getResend();
    await sendBrandMatchAlert(prisma, resend, creatorId, brandCount, niche);
  });

  // ── notifications:trial-warning ───────────────────────────────────────────
  // Daily cron: finds trials expiring within 3 days that haven't been warned yet.

  queue.process('notifications:trial-warning', async (job) => {
    if (!process.env.RESEND_API_KEY) { job.log('RESEND_API_KEY not set — skipping'); return; }

    const soon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const subs  = await prisma.subscription.findMany({
      where: {
        status:          'trialling',
        trialWarningSent: false,
        trialEnd:        { lte: soon, gt: new Date() },
      },
      select: { id: true, tenantId: true, trialEnd: true },
    });

    job.log(`Found ${subs.length} trial(s) ending within 3 days`);
    const resend = getResend();

    for (const sub of subs) {
      const creator = await prisma.creator.findFirst({
        where:  { tenantId: sub.tenantId },
        select: { id: true, userId: true, displayName: true, user: { select: { email: true } } },
      });
      if (!creator?.user?.email) continue;

      const daysLeft = Math.max(1, Math.ceil((new Date(sub.trialEnd) - Date.now()) / 86_400_000));
      const unsubUrl = buildUnsubUrl(creator.userId);
      const subject  = `Your Creatrbase trial ends in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`;

      const body = card(`
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#C56D45;font-family:'DM Sans',system-ui,sans-serif">TRIAL ENDING SOON</p>
        <p style="margin:0 0 10px;font-family:'Outfit','DM Sans',system-ui,sans-serif;font-size:26px;font-weight:700;color:#1B1040;line-height:1.2;letter-spacing:-0.01em">Your trial ends in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} ⏱</p>
        <p style="margin:0 0 20px;font-size:15px;color:#76688F;line-height:1.6;font-family:'DM Sans',system-ui,sans-serif">
          After your trial, you'll drop to the free plan and lose access to score tracking, gap analysis, and deal management.
          Upgrade now to keep everything.
        </p>
        ${ctaButton('Upgrade to Core →', `${APP_URL}/dashboard`)}
      `);

      try {
        await resend.emails.send({
          from:    'Creatrbase <notifications@dashboard.creatrbase.com>',
          to:      creator.user.email,
          subject,
          html:    emailWrapper(subject, body, unsubUrl),
          headers: {
            'List-Unsubscribe':      `<${unsubUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        });
        await prisma.subscription.update({
          where: { id: sub.id },
          data:  { trialWarningSent: true },
        });
        console.log(`[retentionNotifications] trial warning sent: creator=${creator.id}`);
      } catch (err) {
        job.log(`Failed to send trial warning for creator=${creator.id}: ${err.message}`);
      }
    }
  });

  // ── notifications:onboarding-welcome ─────────────────────────────────────
  // Queued 30 min after signup. Sends welcome + connect-channel email.

  queue.process('notifications:onboarding-welcome', async (job) => {
    const { tenantId } = job.data;
    if (!tenantId) throw new Error('notifications:onboarding-welcome missing tenantId');
    if (!process.env.RESEND_API_KEY) { job.log('RESEND_API_KEY not set — skipping'); return; }

    const sub = await prisma.subscription.findUnique({
      where:  { tenantId },
      select: { id: true, onboardingEmailsSent: true },
    });
    if (!sub) { job.log(`No subscription for tenantId=${tenantId}`); return; }

    const sent = (sub.onboardingEmailsSent && typeof sub.onboardingEmailsSent === 'object') ? sub.onboardingEmailsSent : {};
    if (sent.welcome) { job.log('Welcome email already sent — skipping'); return; }

    const creator = await prisma.creator.findFirst({
      where:  { tenantId },
      select: { id: true, userId: true, displayName: true, notificationsOptOut: true, user: { select: { email: true } } },
    });
    if (!creator?.user?.email) return;
    if (creator.notificationsOptOut) { job.log('Creator opted out'); return; }

    const unsubUrl = buildUnsubUrl(creator.userId);
    const subject  = 'Connect your channel to get your score';

    const body = card(`
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#4FB893;font-family:'DM Sans',system-ui,sans-serif">WELCOME TO CREATRBASE</p>
      <p style="margin:0 0 10px;font-family:'Outfit','DM Sans',system-ui,sans-serif;font-size:26px;font-weight:700;color:#1B1040;line-height:1.2;letter-spacing:-0.01em">Hey ${escHtml(creator.displayName ?? 'there')} — you're in 👋</p>
      <p style="margin:0 0 20px;font-size:15px;color:#76688F;line-height:1.6;font-family:'DM Sans',system-ui,sans-serif">
        One step left: connect your YouTube or Twitch channel to generate your Commercial Viability Score.
        It takes 30 seconds and tells you exactly where you stand with brands.
      </p>
      ${ctaButton('Connect your channel →', `${APP_URL}/connections`)}
    `);

    const resend = getResend();
    await resend.emails.send({
      from:    'Creatrbase <notifications@dashboard.creatrbase.com>',
      to:      creator.user.email,
      subject,
      html:    emailWrapper(subject, body, unsubUrl),
      headers: {
        'List-Unsubscribe':      `<${unsubUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });

    await prisma.subscription.update({
      where: { id: sub.id },
      data:  { onboardingEmailsSent: { ...sent, welcome: true } },
    });

    // Queue day-3 follow-up
    await queue.add('notifications:onboarding-day3', { tenantId }, {
      delay:    47.5 * 60 * 60 * 1000,
      attempts: 2,
      backoff:  { type: 'exponential', delay: 5000 },
    });

    console.log(`[retentionNotifications] onboarding welcome sent: creator=${creator.id}`);
  });

  // ── notifications:onboarding-day3 ────────────────────────────────────────
  // Queued 47.5h after the welcome email.

  queue.process('notifications:onboarding-day3', async (job) => {
    const { tenantId } = job.data;
    if (!tenantId) throw new Error('notifications:onboarding-day3 missing tenantId');
    if (!process.env.RESEND_API_KEY) { job.log('RESEND_API_KEY not set — skipping'); return; }

    const sub = await prisma.subscription.findUnique({
      where:  { tenantId },
      select: { id: true, onboardingEmailsSent: true },
    });
    if (!sub) { job.log(`No subscription for tenantId=${tenantId}`); return; }

    const sent = (sub.onboardingEmailsSent && typeof sub.onboardingEmailsSent === 'object') ? sub.onboardingEmailsSent : {};
    if (sent.day3) { job.log('Day-3 email already sent — skipping'); return; }

    const creator = await prisma.creator.findFirst({
      where:  { tenantId },
      select: { id: true, userId: true, displayName: true, notificationsOptOut: true, user: { select: { email: true } } },
    });
    if (!creator?.user?.email) return;
    if (creator.notificationsOptOut) { job.log('Creator opted out'); return; }

    const unsubUrl = buildUnsubUrl(creator.userId);
    const subject  = 'Check your Creatrbase score this week';

    const body = card(`
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#7A5CBF;font-family:'DM Sans',system-ui,sans-serif">YOUR SCORE IS READY</p>
      <p style="margin:0 0 10px;font-family:'Outfit','DM Sans',system-ui,sans-serif;font-size:26px;font-weight:700;color:#1B1040;line-height:1.2;letter-spacing:-0.01em">See what's holding you back</p>
      <p style="margin:0 0 20px;font-size:15px;color:#76688F;line-height:1.6;font-family:'DM Sans',system-ui,sans-serif">
        Your Commercial Viability Score breaks down the 6 dimensions brands actually care about — and shows you exactly which one is holding back your deals.
        Check your dashboard to see where to focus this week.
      </p>
      ${ctaButton('View your dashboard →', `${APP_URL}/dashboard`)}
    `);

    const resend = getResend();
    await resend.emails.send({
      from:    'Creatrbase <notifications@dashboard.creatrbase.com>',
      to:      creator.user.email,
      subject,
      html:    emailWrapper(subject, body, unsubUrl),
      headers: {
        'List-Unsubscribe':      `<${unsubUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });

    await prisma.subscription.update({
      where: { id: sub.id },
      data:  { onboardingEmailsSent: { ...sent, day3: true } },
    });

    console.log(`[retentionNotifications] onboarding day-3 sent: creator=${creator.id}`);
  });

  // ── notifications:upgrade-nudge ───────────────────────────────────────────
  // Daily cron: free users who joined 7+ days ago and haven't been nudged yet.

  queue.process('notifications:upgrade-nudge', async (job) => {
    if (!process.env.RESEND_API_KEY) { job.log('RESEND_API_KEY not set — skipping'); return; }

    const freePlans = await prisma.subscriptionPlan.findMany({
      where:  { name: 'free' },
      select: { id: true },
    });
    if (!freePlans.length) { job.log('No free plan found — skipping'); return; }
    const freePlanIds = freePlans.map(p => p.id);

    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const subs   = await prisma.subscription.findMany({
      where: {
        planId:            { in: freePlanIds },
        status:            'active',
        upgradeNudgeSentAt: null,
        createdAt:         { lte: cutoff },
      },
      select: { id: true, tenantId: true, createdAt: true },
    });

    job.log(`Found ${subs.length} free user(s) eligible for upgrade nudge`);
    const resend = getResend();

    for (const sub of subs) {
      const creator = await prisma.creator.findFirst({
        where:  { tenantId: sub.tenantId },
        select: { id: true, userId: true, displayName: true, notificationsOptOut: true, user: { select: { email: true } } },
      });
      if (!creator?.user?.email) continue;
      if (creator.notificationsOptOut) continue;

      const daysSince = Math.floor((Date.now() - new Date(sub.createdAt).getTime()) / 86_400_000);
      const unsubUrl  = buildUnsubUrl(creator.userId);
      const subject   = `What you're missing on the free plan`;

      const body = card(`
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#7A5CBF;font-family:'DM Sans',system-ui,sans-serif">UPGRADE AVAILABLE</p>
        <p style="margin:0 0 10px;font-family:'Outfit','DM Sans',system-ui,sans-serif;font-size:26px;font-weight:700;color:#1B1040;line-height:1.2;letter-spacing:-0.01em">You've been on Creatrbase for ${daysSince} day${daysSince !== 1 ? 's' : ''}</p>
        <p style="margin:0 0 12px;font-size:15px;color:#76688F;line-height:1.6;font-family:'DM Sans',system-ui,sans-serif">
          The free plan shows your score. Core unlocks the things that actually move the needle:
        </p>
        <ul style="margin:0 0 20px;padding-left:20px;color:#76688F;font-size:15px;line-height:2;font-family:'DM Sans',system-ui,sans-serif">
          <li>Weekly digest with your score trend and top action</li>
          <li>Gap Tracker — see your 6 scoring dimensions over time</li>
          <li>Deal management and brand outreach tools</li>
          <li>Milestone alerts when you hit brand-readiness thresholds</li>
        </ul>
        ${ctaButton('Start your Core trial →', `${APP_URL}/dashboard`)}
      `);

      try {
        await resend.emails.send({
          from:    'Creatrbase <notifications@dashboard.creatrbase.com>',
          to:      creator.user.email,
          subject,
          html:    emailWrapper(subject, body, unsubUrl),
          headers: {
            'List-Unsubscribe':      `<${unsubUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        });
        await prisma.subscription.update({
          where: { id: sub.id },
          data:  { upgradeNudgeSentAt: new Date() },
        });
        console.log(`[retentionNotifications] upgrade nudge sent: creator=${creator.id}`);
      } catch (err) {
        job.log(`Failed to send upgrade nudge for creator=${creator.id}: ${err.message}`);
      }
    }
  });

  // ── Scheduled daily deal nudge at 09:00 UTC ───────────────────────────────
  queue.add('notifications:deal-nudge', {}, {
    repeat:           { cron: '0 9 * * *' },
    removeOnComplete: 5,
    removeOnFail:     10,
  });

  // ── Scheduled daily trial warning at 02:00 UTC ───────────────────────────
  queue.add('notifications:trial-warning', {}, {
    repeat:           { cron: '0 2 * * *' },
    removeOnComplete: 5,
    removeOnFail:     10,
  });

  // ── Scheduled daily upgrade nudge at 10:00 UTC ───────────────────────────
  queue.add('notifications:upgrade-nudge', {}, {
    repeat:           { cron: '0 10 * * *' },
    removeOnComplete: 5,
    removeOnFail:     10,
  });

  console.log('[retentionNotifications] worker registered');
  console.log('[retentionNotifications] deal nudge scheduled at 09:00 UTC');
  console.log('[retentionNotifications] trial warning scheduled at 02:00 UTC');
  console.log('[retentionNotifications] upgrade nudge scheduled at 10:00 UTC');
}

module.exports = { startRetentionNotificationsWorker };
