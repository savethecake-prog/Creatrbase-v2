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

function emailWrapper(subject, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#05040A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td align="center" style="padding:32px 16px">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%">
        <tr><td style="padding:0 0 24px">
          <p style="margin:0;font-size:22px;font-weight:900;color:#9EFFD8;letter-spacing:-0.02em">creatrbase</p>
        </td></tr>
        ${bodyHtml}
        <tr><td style="padding:24px 0 0">
          <p style="margin:0;font-size:12px;color:#4A4860;text-align:center">
            You're receiving this from Creatrbase. <a href="${APP_URL}/connections" style="color:#4A4860">Manage preferences</a>
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
      style="background:#111019;border:1px solid rgba(255,255,255,0.08);border-radius:16px">
      <tr><td style="padding:24px 32px">${html}</td></tr>
    </table>
  </td></tr>`;
}

function ctaButton(text, href) {
  return `<a href="${href}" style="display:inline-block;background:#9EFFD8;color:#05040A;font-size:13px;font-weight:700;padding:10px 22px;border-radius:999px;text-decoration:none">${escHtml(text)}</a>`;
}

async function getCreatorEmailInfo(prisma, creatorId) {
  return prisma.creator.findUnique({
    where:  { id: creatorId },
    select: {
      id:          true,
      displayName: true,
      user:        { select: { email: true } },
    },
  });
}

// ─── 1. Deal activity nudge ───────────────────────────────────────────────────

async function sendDealNudge(prisma, resend, creatorId, brandName, daysSince) {
  const creator = await getCreatorEmailInfo(prisma, creatorId);
  if (!creator?.user?.email) return;

  const body = card(`
    <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#7B7A8E">DEAL UPDATE</p>
    <p style="margin:0 0 8px;font-size:20px;font-weight:800;color:#F5F4FF">Any update on your deal with ${escHtml(brandName)}?</p>
    <p style="margin:0 0 16px;font-size:14px;color:#9B99B0;line-height:1.6">
      It's been <strong style="color:#FFBFA3">${daysSince} days</strong> since your last activity on this deal.
      Staying on top of open negotiations keeps momentum — even a quick follow-up can move things forward.
    </p>
    ${ctaButton('Log an update →', `${APP_URL}/negotiations`)}
  `);

  await resend.emails.send({
    from:    'Creatrbase <notifications@dashboard.creatrbase.com>',
    to:      creator.user.email,
    subject: `Any update on your deal with ${brandName}?`,
    html:    emailWrapper(`Any update on your deal with ${brandName}?`, body),
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

  const label = MILESTONE_LABELS[milestoneType] ?? milestoneType;
  const desc  = MILESTONE_DESCRIPTIONS[milestoneType] ?? 'Keep up the momentum.';

  const body = card(`
    <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9EFFD8">MILESTONE UNLOCKED</p>
    <p style="margin:0 0 8px;font-size:24px;font-weight:900;color:#F5F4FF">${escHtml(label)} 🎯</p>
    <p style="margin:0 0 16px;font-size:14px;color:#9B99B0;line-height:1.6">${escHtml(desc)}</p>
    ${ctaButton('See your score →', `${APP_URL}/dashboard`)}
  `);

  await resend.emails.send({
    from:    'Creatrbase <notifications@dashboard.creatrbase.com>',
    to:      creator.user.email,
    subject: `You just unlocked: ${label}`,
    html:    emailWrapper(`Milestone unlocked: ${label}`, body),
  });

  console.log(`[retentionNotifications] milestone alert sent: creator=${creatorId} milestone=${milestoneType}`);
}

// ─── 3. Score change notification ────────────────────────────────────────────

async function sendScoreChangeAlert(prisma, resend, creatorId, currentScore, previousScore) {
  const creator = await getCreatorEmailInfo(prisma, creatorId);
  if (!creator?.user?.email) return;

  const delta     = currentScore - previousScore;
  const direction = delta > 0 ? 'up' : 'down';
  const color     = delta > 0 ? '#9EFFD8' : '#FFBFA3';
  const emoji     = delta > 0 ? '📈' : '📉';
  const verb      = delta > 0 ? 'increased' : 'dropped';

  const body = card(`
    <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#7B7A8E">SCORE UPDATE</p>
    <p style="margin:0 0 8px;font-size:24px;font-weight:900;color:#F5F4FF">
      Your score ${verb} ${emoji}
    </p>
    <p style="margin:0 0 4px;font-size:42px;font-weight:900;color:#F5F4FF;line-height:1">
      ${currentScore}<span style="font-size:20px;color:#7B7A8E">/100</span>
      <span style="font-size:20px;color:${color}">(${delta > 0 ? '+' : ''}${delta})</span>
    </p>
    <p style="margin:16px 0;font-size:14px;color:#9B99B0;line-height:1.6">
      Your commercial viability score ${verb} by <strong style="color:${color}">${Math.abs(delta)} points</strong> since your last sync.
      ${direction === 'up' ? 'Keep it going — check your dashboard to see what moved.' : 'Check your dashboard to see what changed and what to focus on next.'}
    </p>
    ${ctaButton('View breakdown →', `${APP_URL}/dashboard`)}
  `);

  await resend.emails.send({
    from:    'Creatrbase <notifications@dashboard.creatrbase.com>',
    to:      creator.user.email,
    subject: `Your score ${verb} by ${Math.abs(delta)} points`,
    html:    emailWrapper(`Score update: ${currentScore}/100`, body),
  });

  console.log(`[retentionNotifications] score change alert sent: creator=${creatorId} delta=${delta}`);
}

// ─── 4. Brand match alert ─────────────────────────────────────────────────────

async function sendBrandMatchAlert(prisma, resend, creatorId, brandCount, niche) {
  const creator = await getCreatorEmailInfo(prisma, creatorId);
  if (!creator?.user?.email) return;

  const body = card(`
    <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9EFFD8">BRAND MATCH</p>
    <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#F5F4FF">
      ${brandCount} brand${brandCount !== 1 ? 's' : ''} in your niche are now within reach
    </p>
    <p style="margin:0 0 16px;font-size:14px;color:#9B99B0;line-height:1.6">
      Your score has crossed the eligibility threshold for <strong style="color:#F5F4FF">${brandCount} ${escHtml(niche ?? 'niche')} brand${brandCount !== 1 ? 's' : ''}</strong>.
      Now is a good time to review your outreach list and start pitching.
    </p>
    ${ctaButton('View brands →', `${APP_URL}/outreach`)}
  `);

  await resend.emails.send({
    from:    'Creatrbase <notifications@dashboard.creatrbase.com>',
    to:      creator.user.email,
    subject: `${brandCount} brand${brandCount !== 1 ? 's' : ''} in your niche are now within reach`,
    html:    emailWrapper('Brand match alert', body),
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

  // ── Scheduled daily deal nudge at 09:00 UTC ───────────────────────────────
  queue.add('notifications:deal-nudge', {}, {
    repeat:           { cron: '0 9 * * *' },
    removeOnComplete: 5,
    removeOnFail:     10,
  });

  console.log('[retentionNotifications] worker registered');
  console.log('[retentionNotifications] deal nudge scheduled at 09:00 UTC');
}

module.exports = { startRetentionNotificationsWorker };
