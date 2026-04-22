'use strict';

// ─── GDPR hard-delete worker ──────────────────────────────────────────────────
//
// Job types:
//
//   gdpr:hard-delete   {}
//     Daily at 02:00 UTC. Permanently deletes all data for tenants that have
//     been in deletion_pending status for 30+ days.
//
// ─────────────────────────────────────────────────────────────────────────────

const { getPrisma }              = require('../../lib/prisma');
const { getPool }                = require('../../db/pool');
const { getDataCollectionQueue } = require('../queue');

const RETENTION_DAYS = 30;

async function hardDeleteTenant(prisma, pool, tenantId) {
  // Delete raw-SQL tables first (no Prisma model / no cascade)
  const rawTables = [
    ['brand_creator_interactions', 'tenant_id'],
    ['outreach_contacts',          'tenant_id'],
    ['tenant_brand_watchlist',     'tenant_id'],
    ['signal_events',              'tenant_id'],
    ['dimension_score_history',    'tenant_id'],
    ['gdpr_requests',              'tenant_id'],
    ['newsletter_subscriber_attribution', null], // keyed by email — already wiped at soft-delete
  ];

  for (const [table, col] of rawTables) {
    if (!col) continue;
    await pool.query(`DELETE FROM ${table} WHERE ${col} = $1`, [tenantId]).catch(() => {});
  }

  // Delete Prisma-managed models in safe dependency order
  await prisma.$transaction([
    prisma.session.deleteMany({ where: { tenantId } }),
    prisma.recommendation.deleteMany({ where: { tenantId } }),
    prisma.task.deleteMany({ where: { tenantId } }),
    prisma.platformMetricsSnapshot.deleteMany({ where: { tenantId } }),
    prisma.creatorPlatformProfile.deleteMany({ where: { tenantId } }),
    prisma.creatorCommercialProfile.deleteMany({ where: { creator: { tenantId } } }),
    prisma.creator.deleteMany({ where: { tenantId } }),
    prisma.subscription.deleteMany({ where: { tenantId } }),
    prisma.user.deleteMany({ where: { tenantId } }),
    prisma.tenant.delete({ where: { id: tenantId } }),
  ]);
}

function startGdprHardDeleteWorker() {
  const queue = getDataCollectionQueue();

  queue.process('gdpr:hard-delete', async (job) => {
    const prisma = getPrisma();
    const pool   = getPool();

    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

    const due = await prisma.tenant.findMany({
      where: {
        status:    'deletion_pending',
        deletedAt: { lte: cutoff },
      },
      select: { id: true, deletedAt: true },
    });

    if (due.length === 0) {
      job.log('No tenants due for hard delete');
      return { deleted: 0 };
    }

    job.log(`Hard-deleting ${due.length} tenant(s)`);
    let deleted = 0;
    const errors = [];

    for (const tenant of due) {
      try {
        await hardDeleteTenant(prisma, pool, tenant.id);
        deleted++;
        job.log(`Deleted tenant ${tenant.id} (pending since ${tenant.deletedAt?.toISOString()})`);
      } catch (err) {
        errors.push({ tenantId: tenant.id, error: err.message });
        job.log(`Failed to delete tenant ${tenant.id}: ${err.message}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Hard-delete completed with ${errors.length} error(s): ${JSON.stringify(errors)}`);
    }

    return { deleted };
  });

  // ── Scheduled daily at 02:00 UTC ─────────────────────────────────────────
  queue.add('gdpr:hard-delete', {}, {
    repeat:           { cron: '0 2 * * *' },
    removeOnComplete: 5,
    removeOnFail:     10,
  });

  console.log('[gdprHardDelete] worker registered');
  console.log('[gdprHardDelete] hard-delete scheduled at 02:00 UTC');
}

module.exports = { startGdprHardDeleteWorker };
