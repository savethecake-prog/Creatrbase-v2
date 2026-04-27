'use strict';

// ─── Email digest worker ───────────────────────────────────────────────────────
// Two job types:
//
//   digest:send-all  {}
//     Daily dispatcher: queries all creators where digest_send_day matches
//     today's ISO weekday (1=Mon … 7=Sun), enqueues digest:send-one for each.
//     Registered as a Bull repeatable job (08:00 UTC daily).
//
//   digest:send-one  { creatorId }
//     Fetches score, recommendation, tasks, milestones for one creator and
//     sends a personalised weekly digest email via Resend.
// ─────────────────────────────────────────────────────────────────────────────

const { Resend }             = require('resend');
const { getPrisma }          = require('../../lib/prisma');
const { getDataCollectionQueue } = require('../queue');
const { generateToken, isOptedOut } = require('../../services/unsubscribeToken');

const APP_URL = process.env.APP_URL || 'https://creatrbase.com';

const TIER_LABELS = {
  pre_commercial: 'Pre-commercial',
  emerging:       'Emerging',
  viable:         'Viable',
  established:    'Established',
};

const DIMENSION_LABELS = {
  subscriber_momentum:    'Subscriber Momentum',
  engagement_quality:     'Engagement Quality',
  niche_commercial_value: 'Niche Commercial Value',
  audience_geo_alignment: 'Audience Geo Alignment',
  content_consistency:    'Content Consistency',
  content_brand_alignment:'Content Brand Alignment',
};

const MILESTONE_LABELS = {
  giftable:               'Giftable',
  outreach_ready:         'Outreach Ready',
  paid_integration_viable:'Paid Integration Viable',
  rate_negotiation_power: 'Rate Negotiation Power',
  portfolio_creator:      'Portfolio Creator',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getResend() {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set');
  return new Resend(process.env.RESEND_API_KEY);
}

function todayISOWeekday() {
  // ISO weekday: 1 = Monday, 7 = Sunday
  const day = new Date().getDay();
  return day === 0 ? 7 : day;
}

function scoreChange(current, previous) {
  if (current == null || previous == null) return null;
  return current - previous;
}

function formatChange(delta) {
  if (delta == null) return '';
  if (delta > 0)  return `+${delta}`;
  if (delta < 0)  return `${delta}`;
  return '→ no change';
}

function nextMilestone(milestones) {
  const order = [
    'giftable', 'outreach_ready', 'paid_integration_viable',
    'rate_negotiation_power', 'portfolio_creator',
  ];
  for (const type of order) {
    const m = milestones.find(m => m.milestoneType === type);
    if (!m || m.status !== 'crossed') {
      return { type, label: MILESTONE_LABELS[type] ?? type, status: m?.status ?? 'not_started' };
    }
  }
  return null;
}

// ─── Email HTML builder ───────────────────────────────────────────────────────

function buildUnsubUrl(userId) {
  const token = generateToken(userId);
  return `${APP_URL}/api/unsubscribe?token=${token}&uid=${encodeURIComponent(userId)}`;
}

function buildEmailHtml({ displayName, score, tier, scoreDelta, weakestDimension, recommendation, activeTaskCount, milestone, unsubUrl }) {
  const tierLabel     = TIER_LABELS[tier] ?? tier ?? 'Unknown';
  const dimLabel      = DIMENSION_LABELS[weakestDimension] ?? weakestDimension ?? 'Unknown';
  const changeColor   = scoreDelta != null ? (scoreDelta >= 0 ? '#4FB893' : '#C56D45') : '#A69BB8';
  const changeText    = scoreDelta != null
    ? ` <span style="font-size:18px;color:${changeColor};font-family:'DM Sans',system-ui,sans-serif">(${formatChange(scoreDelta)} this week)</span>`
    : '';
  const milestoneHtml = milestone
    ? `<p style="margin:6px 0 0;font-size:13px;color:#76688F;font-family:'DM Sans',system-ui,sans-serif">Next milestone: <strong style="color:#1B1040">${milestone.label}</strong></p>`
    : '';
  const recHtml = recommendation
    ? `
      <tr>
        <td style="padding:24px 32px;border-top:1px solid #E8E1D4">
          <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#76688F;font-family:'DM Sans',system-ui,sans-serif">THIS WEEK'S TASK</p>
          <p style="margin:0 0 8px;font-family:'Outfit','DM Sans',system-ui,sans-serif;font-size:18px;font-weight:700;color:#1B1040;line-height:1.3">${escHtml(recommendation.title)}</p>
          <p style="margin:0 0 20px;font-size:14px;color:#76688F;line-height:1.6;font-family:'DM Sans',system-ui,sans-serif">${escHtml(recommendation.specificAction)}</p>
          <a href="${APP_URL}/tasks" style="display:inline-block;background:#9EFFD8;color:#1B1040;font-family:'DM Sans',system-ui,sans-serif;font-size:14px;font-weight:700;padding:12px 26px;border-radius:9999px;text-decoration:none;box-shadow:3px 3px 0 #1B1040">View task →</a>
        </td>
      </tr>`
    : `
      <tr>
        <td style="padding:24px 32px;border-top:1px solid #E8E1D4">
          <p style="margin:0 0 16px;font-size:14px;color:#76688F;font-family:'DM Sans',system-ui,sans-serif">No task recommendation yet — your next sync will generate one.</p>
          <a href="${APP_URL}/dashboard" style="display:inline-block;background:#9EFFD8;color:#1B1040;font-family:'DM Sans',system-ui,sans-serif;font-size:14px;font-weight:700;padding:12px 26px;border-radius:9999px;text-decoration:none;box-shadow:3px 3px 0 #1B1040">Go to dashboard →</a>
        </td>
      </tr>`;

  const footerUnsub = unsubUrl
    ? `You're receiving this because you signed up for Creatrbase. <a href="${unsubUrl}" style="color:#A69BB8;text-decoration:underline">Unsubscribe</a>`
    : `You're receiving this because you signed up for Creatrbase.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Your Creatrbase Weekly Digest</title>
  <style>@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Outfit:wght@600;700&display=swap');</style>
</head>
<body style="margin:0;padding:0;background:#FAF6EF;font-family:'DM Sans',system-ui,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding:40px 16px">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%">

          <!-- Wordmark -->
          <tr>
            <td style="padding:0 0 28px">
              <img src="https://creatrbase.com/brand/wordmark-light.png" width="160" alt="creatrbase" style="display:block;border:0">
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:0 0 20px">
              <p style="margin:0 0 4px;font-family:'Outfit','DM Sans',system-ui,sans-serif;font-size:28px;font-weight:700;color:#1B1040;letter-spacing:-0.02em">Your weekly digest</p>
              <p style="margin:0;font-size:15px;color:#76688F;font-family:'DM Sans',system-ui,sans-serif">Hey ${escHtml(displayName)} — here's where you stand this week.</p>
            </td>
          </tr>

          <!-- Score card -->
          <tr>
            <td style="padding:0 0 16px">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFFFFF;border:1px solid #E8E1D4;border-radius:14px">
                <tr>
                  <td style="padding:28px 32px">
                    <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#A69BB8;font-family:'DM Sans',system-ui,sans-serif">COMMERCIAL VIABILITY SCORE</p>
                    <p style="margin:0 0 10px;font-family:'Outfit','DM Sans',system-ui,sans-serif;font-size:48px;font-weight:700;color:#1B1040;line-height:1;letter-spacing:-0.02em">${score ?? '–'}<span style="font-size:22px;color:#A69BB8;font-family:'DM Sans',system-ui,sans-serif">/100</span>${changeText}</p>
                    <span style="display:inline-block;background:#9EFFD8;color:#1B1040;font-size:11px;font-weight:700;padding:3px 12px;border-radius:9999px;letter-spacing:0.04em;font-family:'DM Sans',system-ui,sans-serif">${tierLabel}</span>
                    ${milestoneHtml}
                    <p style="margin:8px 0 0;font-size:13px;color:#76688F;font-family:'DM Sans',system-ui,sans-serif">Primary gap: <strong style="color:#C56D45">${dimLabel}</strong></p>
                  </td>
                </tr>
                ${recHtml}
              </table>
            </td>
          </tr>

          <!-- Active tasks -->
          ${activeTaskCount > 0 ? `
          <tr>
            <td style="padding:0 0 16px">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFFFFF;border:1px solid #E8E1D4;border-radius:14px">
                <tr>
                  <td style="padding:18px 32px">
                    <p style="margin:0;font-size:14px;color:#76688F;font-family:'DM Sans',system-ui,sans-serif">You have <strong style="color:#1B1040">${activeTaskCount} active task${activeTaskCount !== 1 ? 's' : ''}</strong> in progress. <a href="${APP_URL}/tasks" style="color:#4FB893;text-decoration:none;font-weight:600">View tasks →</a></p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>` : ''}

          <!-- Footer -->
          <tr>
            <td style="padding:20px 0 0">
              <p style="margin:0;font-size:12px;color:#A69BB8;text-align:center;font-family:'DM Sans',system-ui,sans-serif">${footerUnsub}</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Worker registration ──────────────────────────────────────────────────────

function startEmailDigestWorker() {
  const queue  = getDataCollectionQueue();
  const prisma = getPrisma();

  // ── digest:send-one ────────────────────────────────────────────────────────

  queue.process('digest:send-one', async (job) => {
    const { creatorId } = job.data;
    if (!creatorId) throw new Error('digest:send-one missing creatorId');

    if (!process.env.RESEND_API_KEY) {
      job.log('RESEND_API_KEY not set — skipping digest send');
      return;
    }

    job.log(`Sending digest for creator ${creatorId}`);

    // Load creator + user email
    const creator = await prisma.creator.findUnique({
      where:  { id: creatorId },
      select: {
        id:          true,
        userId:      true,
        displayName: true,
        user: {
          select: { email: true },
        },
      },
    });
    if (!creator) throw new Error(`Creator ${creatorId} not found`);

    const email = creator.user?.email;
    if (!email) {
      job.log(`No email for creator ${creatorId} — skipping`);
      return;
    }

    if (await isOptedOut(prisma, creatorId)) {
      job.log(`Creator ${creatorId} has opted out — skipping digest`);
      return;
    }

    const unsubUrl = buildUnsubUrl(creator.userId);

    // Load commercial profile
    const commercialProfile = await prisma.creatorCommercialProfile.findUnique({
      where:  { creatorId },
      select: {
        commercialViabilityScore: true,
        commercialTier:           true,
        gapPrimaryConstraint:     true,
      },
    });

    // Load last two score history entries to compute week-over-week delta
    const scoreHistory = await prisma.dimensionScoreHistory.findMany({
      where:   { creatorId },
      orderBy: { scoredAt: 'desc' },
      take:    2,
      select:  { overallScore: true, scoredAt: true },
    });

    const currentScore  = scoreHistory[0]?.overallScore ?? commercialProfile?.commercialViabilityScore ?? null;
    const previousScore = scoreHistory[1]?.overallScore ?? null;
    const scoreDelta    = scoreChange(currentScore, previousScore);

    // Load top pending recommendation
    const recommendation = await prisma.recommendation.findFirst({
      where:   { creatorId, status: 'pending' },
      orderBy: { generatedAt: 'desc' },
      select:  { title: true, specificAction: true },
    });

    // Load active tasks count
    const activeTaskCount = await prisma.task.count({
      where: { creatorId, status: { in: ['pending', 'in_progress'] } },
    });

    // Load milestones
    const milestones = await prisma.creatorMilestone.findMany({
      where:  { creatorId },
      select: { milestoneType: true, status: true },
    });

    const milestone = nextMilestone(milestones);

    // Build and send email
    const subject = `Your weekly digest — score ${currentScore ?? '?'}/100`;
    const html    = buildEmailHtml({
      displayName:      creator.displayName,
      score:            currentScore,
      tier:             commercialProfile?.commercialTier ?? null,
      scoreDelta,
      weakestDimension: commercialProfile?.gapPrimaryConstraint ?? null,
      recommendation,
      activeTaskCount,
      milestone,
      unsubUrl,
    });

    const resend = getResend();
    const result = await resend.emails.send({
      from:    'Creatrbase <digest@dashboard.creatrbase.com>',
      to:      email,
      subject,
      html,
      headers: {
        'List-Unsubscribe':      `<${unsubUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });

    job.log(`Digest sent to ${email} — Resend ID: ${result.data?.id ?? 'unknown'}`);
    console.log(`[emailDigest] creator=${creatorId} email=${email} resend_id=${result.data?.id}`);
  });

  // ── digest:send-all (daily dispatcher) ────────────────────────────────────

  queue.process('digest:send-all', async (job) => {
    const weekday = todayISOWeekday();
    job.log(`Dispatching digests for weekday ${weekday}`);

    const creators = await prisma.creator.findMany({
      where: { digestSendDay: weekday },
      select: { id: true },
    });

    job.log(`Found ${creators.length} creator(s) scheduled for today`);

    for (const { id } of creators) {
      await queue.add('digest:send-one', { creatorId: id }, {
        attempts: 2,
        backoff:  { type: 'exponential', delay: 5000 },
      });
    }
  });

  // Register daily repeatable dispatcher at 08:00 UTC
  queue.add('digest:send-all', {}, {
    repeat: { cron: '0 8 * * *' },
    jobId:  'digest-send-all-daily',
  });

  console.log('[emailDigest] worker registered — daily dispatcher at 08:00 UTC');
}

module.exports = { startEmailDigestWorker };
