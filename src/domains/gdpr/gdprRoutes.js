'use strict';

const { authenticate } = require('../../middleware/authenticate');
const { getPrisma }    = require('../../lib/prisma');
const { getPool }      = require('../../db/pool');
const { randomUUID }   = require('crypto');

async function gdprRoutes(app) {

  // ── GET /api/gdpr/status ────────────────────────────────────────────────────
  // Returns a summary of the categories of data we hold for the requesting user.
  app.get('/api/gdpr/status', { preHandler: authenticate }, async (req, reply) => {
    const prisma    = getPrisma();
    const pool      = getPool();
    const tenantId  = req.user.tenantId;
    const userId    = req.user.userId;

    const [
      userRow,
      platformCount,
      snapshotCount,
      taskCount,
      outreachCount,
      recommendationCount,
      sessionCount,
      newsletterRow,
    ] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { email: true, createdAt: true } }),
      prisma.creatorPlatformProfile.count({ where: { tenantId } }),
      prisma.platformMetricsSnapshot.count({ where: { tenantId } }),
      prisma.task.count({ where: { tenantId } }),
      pool.query('SELECT COUNT(*) FROM outreach_contacts WHERE tenant_id = $1', [tenantId]).catch(() => ({ rows: [{ count: '0' }] })),
      prisma.recommendation.count({ where: { tenantId } }),
      prisma.session.count({ where: { tenantId } }),
      pool.query('SELECT 1 FROM newsletter_subscriber_attribution WHERE LOWER(email) = LOWER($1)', [req.user.email]).catch(() => ({ rows: [] })),
    ]);

    return {
      ok: true,
      categories: [
        { category: 'Account',          description: 'Email address, display name, hashed password', records: 1 },
        { category: 'Platform profiles', description: 'Connected social media accounts and OAuth tokens', records: platformCount },
        { category: 'Metrics snapshots', description: 'Historical channel/profile metric readings', records: snapshotCount },
        { category: 'Tasks',             description: 'Your growth tasks and completion records', records: taskCount },
        { category: 'Outreach',          description: 'Brand contact records and outreach activity', records: parseInt(outreachCount.rows[0]?.count || '0', 10) },
        { category: 'Recommendations',   description: 'Generated platform recommendations', records: recommendationCount },
        { category: 'Sessions',          description: 'Active login sessions', records: sessionCount },
        { category: 'Newsletter',        description: 'Newsletter subscription record', records: newsletterRow.rows.length },
      ],
      account_created: userRow?.createdAt,
    };
  });

  // ── POST /api/gdpr/export ───────────────────────────────────────────────────
  // Returns a JSON export of all personal data for the requesting tenant.
  app.post('/api/gdpr/export', { preHandler: authenticate }, async (req, reply) => {
    const prisma   = getPrisma();
    const pool     = getPool();
    const tenantId = req.user.tenantId;
    const userId   = req.user.userId;

    // Log the request
    await pool.query(
      `INSERT INTO gdpr_requests (tenant_id, user_id, request_type, status)
       VALUES ($1, $2, 'export', 'pending')`,
      [tenantId, userId]
    ).catch(() => {}); // non-fatal if table not yet migrated

    const [
      userRow,
      creators,
      platformProfiles,
      snapshots,
      tasks,
      recommendations,
      subscription,
      newsletterRow,
    ] = await Promise.all([
      prisma.user.findUnique({
        where:  { id: userId },
        select: { id: true, email: true, createdAt: true, updatedAt: true, emailVerified: true },
      }),
      prisma.creator.findMany({
        where:  { tenantId },
        select: { id: true, displayName: true, onboardingStep: true, createdAt: true },
      }),
      prisma.creatorPlatformProfile.findMany({
        where:  { tenantId },
        select: {
          id: true, platform: true, platformUsername: true, platformDisplayName: true,
          platformUrl: true, connectedAt: true, lastSyncedAt: true, syncStatus: true,
          subscriberCount: true, totalViewCount: true, videoCount: true,
        },
      }),
      prisma.platformMetricsSnapshot.findMany({
        where:   { tenantId },
        orderBy: { recordedAt: 'desc' },
        take:    500,
        select: {
          id: true, platform: true, subscriberCount: true, totalViewCount: true,
          videoCount: true, recordedAt: true,
        },
      }),
      prisma.task.findMany({
        where:  { tenantId },
        select: { id: true, title: true, status: true, dueDate: true, createdAt: true, completedAt: true },
        take:   1000,
      }),
      prisma.recommendation.findMany({
        where:  { tenantId },
        select: { id: true, type: true, status: true, createdAt: true },
        take:   200,
      }),
      prisma.subscription.findFirst({
        where:  { tenantId },
        select: { status: true, billingInterval: true, trialStart: true, trialEnd: true, cancelAtPeriodEnd: true },
      }),
      pool.query(
        'SELECT email, source, initial_segments, marketing_consent, consent_at, subscribed_at FROM newsletter_subscriber_attribution WHERE LOWER(email) = LOWER($1)',
        [req.user.email]
      ).catch(() => ({ rows: [] })),
    ]);

    // Outreach contacts
    let outreach = [];
    try {
      const res = await pool.query(
        'SELECT id, brand_name, contact_name, contact_email, status, created_at FROM outreach_contacts WHERE tenant_id = $1 LIMIT 500',
        [tenantId]
      );
      outreach = res.rows;
    } catch (_) {}

    // Negotiations
    let negotiations = [];
    try {
      const res = await pool.query(
        'SELECT id, brand_name, status, deal_value, currency, created_at FROM negotiations WHERE tenant_id = $1 LIMIT 200',
        [tenantId]
      );
      negotiations = res.rows;
    } catch (_) {}

    const exportData = {
      export_generated_at: new Date().toISOString(),
      export_format:       'creatrbase-gdpr-export-v1',
      account:             userRow,
      creators,
      platform_profiles:   platformProfiles,
      metrics_snapshots:   snapshots,
      tasks,
      recommendations,
      subscription:        subscription || null,
      outreach,
      negotiations,
      newsletter:          newsletterRow.rows[0] || null,
    };

    // Mark request complete
    await pool.query(
      `UPDATE gdpr_requests SET status = 'complete', completed_at = NOW()
       WHERE tenant_id = $1 AND user_id = $2 AND request_type = 'export' AND status = 'pending'
       ORDER BY requested_at DESC LIMIT 1`,
      [tenantId, userId]
    ).catch(() => {});

    return reply
      .header('Content-Disposition', 'attachment; filename="creatrbase-data-export.json"')
      .header('Content-Type', 'application/json')
      .send(exportData);
  });

  // ── POST /api/gdpr/delete ───────────────────────────────────────────────────
  // Soft-deletes the account: anonymises PII, sets tenant status to 'deletion_pending'.
  // Hard delete is a future manual/scheduled process after 30 days.
  app.post('/api/gdpr/delete', { preHandler: authenticate }, async (req, reply) => {
    const prisma   = getPrisma();
    const pool     = getPool();
    const tenantId = req.user.tenantId;
    const userId   = req.user.userId;
    const email    = req.user.email;

    // Prevent double-deletion
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { status: true } });
    if (tenant?.status === 'deletion_pending' || tenant?.status === 'deleted') {
      return reply.code(409).send({ error: 'already_requested', message: 'A deletion request is already in progress for this account.' });
    }

    const anonEmail = `deleted_${randomUUID()}@deleted.invalid`;
    const anonName  = 'Deleted User';

    // Log the request
    await pool.query(
      `INSERT INTO gdpr_requests (tenant_id, user_id, request_type, status, metadata)
       VALUES ($1, $2, 'delete', 'pending', $3)`,
      [tenantId, userId, JSON.stringify({ original_email: email, requested_at: new Date().toISOString() })]
    ).catch(() => {});

    // Log to admin action log for audit trail
    await pool.query(
      `INSERT INTO admin_action_log (actor_user_id, action_type, action_target, metadata)
       VALUES ($1, 'gdpr_delete_requested', $2, $3)`,
      [userId, `tenant:${tenantId}`, JSON.stringify({ email, tenant_id: tenantId })]
    ).catch(() => {});

    // Soft delete: anonymise PII and mark status
    await prisma.$transaction([
      // Anonymise user email and display name
      prisma.user.update({
        where: { id: userId },
        data:  { email: anonEmail },
      }),

      // Anonymise creator display name
      prisma.creator.updateMany({
        where: { tenantId },
        data:  { displayName: anonName },
      }),

      // Set tenant status to deletion_pending
      prisma.tenant.update({
        where: { id: tenantId },
        data:  { status: 'deletion_pending', deletedAt: new Date(), deletedBy: userId },
      }),
    ]);

    // Remove newsletter subscription attribution (user has requested deletion)
    await pool.query(
      'DELETE FROM newsletter_subscriber_attribution WHERE LOWER(email) = LOWER($1)',
      [email]
    ).catch(() => {});

    // Invalidate all sessions immediately
    await prisma.session.deleteMany({ where: { tenantId } });

    // Mark GDPR request complete
    await pool.query(
      `UPDATE gdpr_requests SET status = 'complete', completed_at = NOW()
       WHERE tenant_id = $1 AND user_id = $2 AND request_type = 'delete' AND status = 'pending'`,
      [tenantId, userId]
    ).catch(() => {});

    return {
      ok:      true,
      message: 'Your deletion request has been received. Your account PII has been anonymised immediately. All data will be permanently deleted within 30 days. You have been logged out.',
    };
  });

}

module.exports = { gdprRoutes };
