'use strict';

const { authenticate }          = require('../../middleware/authenticate');
const { requireTier }           = require('../../middleware/requireTier');
const { getPool }               = require('../../db/pool');
const { getDataCollectionQueue } = require('../../jobs/queue');

// Shared SELECT for returning contact rows to the client
const CONTACT_SELECT = `
  SELECT id, full_name, job_title, email, email_verified,
         source, source_url, confidence, created_at
  FROM brand_contacts
  WHERE tenant_id = $1 AND brand_id = $2 AND expires_at > NOW()
  ORDER BY
    CASE email_verified WHEN 'verified' THEN 1 WHEN 'unknown' THEN 2 ELSE 3 END,
    CASE confidence     WHEN 'high'     THEN 1 WHEN 'medium'  THEN 2 ELSE 3 END,
    created_at DESC
`;

async function contactRoutes(app) {

  // ── POST /api/contacts/discover ─────────────────────────────────────────────
  // Check cache → return immediately if fresh.
  // Otherwise insert a job record and queue it, return { status, jobId }.
  app.post('/api/contacts/discover', {
    preHandler: [authenticate, requireTier('pro')],
  }, async (req, reply) => {
    const { brandId } = req.body || {};
    if (!brandId) return reply.code(400).send({ error: 'brandId required' });

    const pool = getPool();
    const { tenantId } = req.user;

    // Validate brand exists and has a website
    const { rows: [brand] } = await pool.query(
      'SELECT id, website FROM brands WHERE id = $1',
      [brandId],
    );
    if (!brand)          return reply.code(404).send({ error: 'Brand not found' });
    if (!brand.website)  return reply.code(422).send({ error: 'Brand has no website on file — contact discovery is not possible' });

    // Return cached contacts if still fresh
    const { rows: cached } = await pool.query(CONTACT_SELECT, [tenantId, brandId]);
    if (cached.length > 0) {
      return { status: 'cached', contacts: cached, jobId: null };
    }

    // Avoid duplicate jobs: return the existing one if already in-flight
    const { rows: [activeJob] } = await pool.query(`
      SELECT id, status FROM brand_contact_jobs
      WHERE tenant_id = $1 AND brand_id = $2
        AND status IN ('queued','running')
        AND created_at > NOW() - INTERVAL '10 minutes'
      ORDER BY created_at DESC LIMIT 1
    `, [tenantId, brandId]);

    if (activeJob) {
      return { status: activeJob.status, contacts: [], jobId: activeJob.id };
    }

    // Create job record
    const { rows: [job] } = await pool.query(`
      INSERT INTO brand_contact_jobs (tenant_id, brand_id, status)
      VALUES ($1, $2, 'queued')
      RETURNING id
    `, [tenantId, brandId]);

    // Queue Bull job — attempts:2, no exponential backoff (fixed 5s) since these are
    // network-bound jobs that fail fast
    await getDataCollectionQueue().add('contacts:discover', {
      tenantId,
      brandId,
      jobDbId: job.id,
    }, {
      attempts: 2,
      backoff:  { type: 'fixed', delay: 5000 },
    });

    return { status: 'queued', contacts: [], jobId: job.id };
  });

  // ── POST /api/contacts/discover-batch ───────────────────────────────────────
  // Queue discovery jobs for multiple brands at once. Max 10 per batch.
  app.post('/api/contacts/discover-batch', {
    preHandler: [authenticate, requireTier('pro')],
  }, async (req, reply) => {
    const { brandIds } = req.body || {};
    if (!Array.isArray(brandIds) || brandIds.length === 0) {
      return reply.code(400).send({ error: 'brandIds array required' });
    }
    if (brandIds.length > 10) {
      return reply.code(400).send({ error: 'Maximum 10 brands per batch' });
    }

    const pool  = getPool();
    const queue = getDataCollectionQueue();
    const { tenantId } = req.user;

    const results = await Promise.all(brandIds.map(async (brandId) => {
      // Validate
      const { rows: [brand] } = await pool.query(
        'SELECT id, website FROM brands WHERE id = $1', [brandId],
      );
      if (!brand?.website) return { brandId, status: 'skipped', reason: 'no_website' };

      // Cache check
      const { rows: [hit] } = await pool.query(
        'SELECT id FROM brand_contacts WHERE tenant_id = $1 AND brand_id = $2 AND expires_at > NOW() LIMIT 1',
        [tenantId, brandId],
      );
      if (hit) return { brandId, status: 'cached' };

      // In-flight check
      const { rows: [existing] } = await pool.query(`
        SELECT id FROM brand_contact_jobs
        WHERE tenant_id = $1 AND brand_id = $2 AND status IN ('queued','running')
          AND created_at > NOW() - INTERVAL '10 minutes'
        LIMIT 1
      `, [tenantId, brandId]);
      if (existing) return { brandId, status: 'running', jobId: existing.id };

      // Create and queue
      const { rows: [job] } = await pool.query(`
        INSERT INTO brand_contact_jobs (tenant_id, brand_id, status)
        VALUES ($1, $2, 'queued') RETURNING id
      `, [tenantId, brandId]);

      await queue.add('contacts:discover', { tenantId, brandId, jobDbId: job.id }, {
        attempts: 2,
        backoff:  { type: 'fixed', delay: 5000 },
      });

      return { brandId, status: 'queued', jobId: job.id };
    }));

    return { jobs: results };
  });

  // ── GET /api/contacts/job/:jobId ────────────────────────────────────────────
  // Poll endpoint. Returns job status + contacts once complete.
  app.get('/api/contacts/job/:jobId', {
    preHandler: authenticate,
  }, async (req, reply) => {
    const pool = getPool();

    const { rows: [job] } = await pool.query(
      'SELECT * FROM brand_contact_jobs WHERE id = $1 AND tenant_id = $2',
      [req.params.jobId, req.user.tenantId],
    );
    if (!job) return reply.code(404).send({ error: 'Job not found' });

    let contacts = [];
    if (job.status === 'complete') {
      const { rows } = await pool.query(CONTACT_SELECT, [req.user.tenantId, job.brand_id]);
      contacts = rows;
    }

    return {
      jobId:    job.id,
      brandId:  job.brand_id,
      status:   job.status,
      contacts,
      error:    job.error_detail || null,
    };
  });

  // ── GET /api/contacts/brand/:brandId ────────────────────────────────────────
  // Returns cached contacts for a brand without triggering a new job.
  // Core+ can view contacts their tenant has already discovered.
  app.get('/api/contacts/brand/:brandId', {
    preHandler: authenticate,
  }, async (req, reply) => {
    const pool = getPool();
    const { rows } = await pool.query(CONTACT_SELECT, [req.user.tenantId, req.params.brandId]);
    return { contacts: rows };
  });

}

module.exports = { contactRoutes };
