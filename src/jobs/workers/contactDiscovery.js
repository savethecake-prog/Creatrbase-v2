'use strict';

// ─── Contact Discovery Worker ─────────────────────────────────────────────────
//
// Processes 'contacts:discover' jobs from the data-collection queue.
// Concurrency: 2 — allows two brands to be crawled simultaneously
// without hammering any single domain.
//
// Job data: { tenantId, brandId, jobDbId }
// ─────────────────────────────────────────────────────────────────────────────

const { getDataCollectionQueue } = require('../queue');
const { getPool }               = require('../../db/pool');
const { discoverContacts }      = require('../../domains/contacts/contactService');

async function startContactDiscoveryWorker() {
  const queue = getDataCollectionQueue();

  queue.process('contacts:discover', 2, async (job) => {
    const { tenantId, brandId, jobDbId } = job.data;
    const pool = getPool();

    // Mark as running
    await pool.query(
      "UPDATE brand_contact_jobs SET status = 'running' WHERE id = $1",
      [jobDbId],
    );

    try {
      const contacts = await discoverContacts(tenantId, brandId);

      // Upsert each contact — ON CONFLICT refreshes the TTL and updates stale data
      for (const c of contacts) {
        await pool.query(`
          INSERT INTO brand_contacts
            (tenant_id, brand_id, full_name, job_title, email,
             email_verified, source, source_url, confidence)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (tenant_id, brand_id, email) DO UPDATE SET
            full_name      = EXCLUDED.full_name,
            job_title      = EXCLUDED.job_title,
            email_verified = EXCLUDED.email_verified,
            source_url     = EXCLUDED.source_url,
            confidence     = EXCLUDED.confidence,
            expires_at     = NOW() + INTERVAL '60 days'
        `, [
          tenantId,
          brandId,
          c.full_name,
          c.job_title,
          c.email,
          c.email_verified,
          c.source,
          c.source_url,
          c.confidence,
        ]);
      }

      await pool.query(`
        UPDATE brand_contact_jobs
        SET status = 'complete', result_count = $1, completed_at = NOW()
        WHERE id = $2
      `, [contacts.length, jobDbId]);

      return { found: contacts.length };

    } catch (err) {
      await pool.query(`
        UPDATE brand_contact_jobs
        SET status = 'failed', error_detail = $1, completed_at = NOW()
        WHERE id = $2
      `, [err.message?.slice(0, 500) || 'Unknown error', jobDbId]);

      // Re-throw so Bull records the failure and applies retry backoff
      throw err;
    }
  });

  console.log('[worker] contactDiscovery ready');
}

module.exports = { startContactDiscoveryWorker };
