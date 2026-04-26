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
  const changeText    = scoreDelta != null ? ` <span style="color:${scoreDelta >= 0 ? '#9EFFD8' : '#FFBFA3'}">(${formatChange(scoreDelta)} this week)</span>` : '';
  const milestoneHtml = milestone
    ? `<p style="margin:0 0 8px">Next milestone: <strong style="color:#C8AAFF">${milestone.label}</strong></p>`
    : '';
  const recHtml = recommendation
    ? `
      <tr>
        <td style="padding:24px 32px">
          <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#7B7A8E">THIS WEEK'S TASK</p>
          <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#F5F4FF">${escHtml(recommendation.title)}</p>
          <p style="margin:0 0 16px;font-size:14px;color:#9B99B0;line-height:1.6">${escHtml(recommendation.specificAction)}</p>
          <a href="${APP_URL}/tasks" style="display:inline-block;background:#9EFFD8;color:#05040A;font-size:13px;font-weight:700;padding:10px 22px;border-radius:999px;text-decoration:none">View task →</a>
        </td>
      </tr>`
    : `
      <tr>
        <td style="padding:24px 32px">
          <p style="margin:0 0 8px;font-size:14px;color:#9B99B0">No task recommendation yet — your next sync will generate one.</p>
          <a href="${APP_URL}/dashboard" style="display:inline-block;background:#9EFFD8;color:#05040A;font-size:13px;font-weight:700;padding:10px 22px;border-radius:999px;text-decoration:none">Go to dashboard →</a>
        </td>
      </tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Your Creatrbase Weekly Digest</title>
</head>
<body style="margin:0;padding:0;background:#05040A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding:32px 16px">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%">

          <!-- Header -->
          <tr>
            <td style="padding:0 0 24px">
              <p style="margin:0;font-size:22px;font-weight:900;color:#9EFFD8;letter-spacing:-0.02em">creatrbase</p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:0 0 24px">
              <p style="margin:0 0 4px;font-size:26px;font-weight:800;color:#F5F4FF">Your weekly digest</p>
              <p style="margin:0;font-size:15px;color:#9B99B0">Hey ${escHtml(displayName)} — here's where you stand this week.</p>
            </td>
          </tr>

          <!-- Score card -->
          <tr>
            <td style="padding:0 0 16px">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#111019;border:1px solid rgba(255,255,255,0.08);border-radius:16px">
                <tr>
                  <td style="padding:24px 32px">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#7B7A8E">COMMERCIAL VIABILITY SCORE</p>
                    <p style="margin:0 0 8px;font-size:42px;font-weight:900;color:#F5F4FF;line-height:1">${score ?? '–'}<span style="font-size:20px;color:#7B7A8E">/100</span>${changeText}</p>
                    <p style="margin:0 0 8px;display:inline-block;background:rgba(158,255,216,0.1);color:#9EFFD8;font-size:12px;font-weight:700;padding:4px 12px;border-radius:999px">${tierLabel}</p>
                    ${milestoneHtml}
                    <p style="margin:0;font-size:13px;color:#7B7A8E">Primary gap: <strong style="color:#FFBFA3">${dimLabel}</strong></p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Recommendation -->
          <tr>
            <td style="padding:0 0 16px">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#111019;border:1px solid rgba(255,255,255,0.08);border-radius:16px">
                ${recHtml}
              </table>
            </td>
          </tr>

          <!-- Active tasks -->
          ${activeTaskCount > 0 ? `
          <tr>
            <td style="padding:0 0 16px">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#111019;border:1px solid rgba(255,255,255,0.08);border-radius:16px">
                <tr>
                  <td style="padding:20px 32px">
                    <p style="margin:0;font-size:14px;color:#9B99B0">You have <strong style="color:#F5F4FF">${activeTaskCount} active task${activeTaskCount !== 1 ? 's' : ''}</strong> in progress. <a href="${APP_URL}/tasks" style="color:#9EFFD8;text-decoration:none">View tasks →</a></p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>` : ''}

          <!-- Footer -->
          <tr>
            <td style="padding:24px 0 0">
              <p style="margin:0;font-size:12px;color:#4A4860;text-align:center">You're receiving this because you signed up for Creatrbase. ${unsubUrl ? `<a href="${unsubUrl}" style="color:#4A4860">Unsubscribe</a>` : ''}</p>
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
