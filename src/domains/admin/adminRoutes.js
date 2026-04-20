'use strict';

const { authenticate } = require('../../middleware/authenticate');
const { requireAdmin } = require('../../middleware/requireAdmin');
const { getPrisma }    = require('../../lib/prisma');
const { getPool }      = require('../../db/pool');
const { handleSessionMessage, endSession } = require('../../agents/newsletter/editorial-composer');
const { v4: uuidv4 }  = require('uuid');
const { listSkills }   = require('../../agents/newsletter/skills-loader');

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not set');
  return require('stripe')(process.env.STRIPE_SECRET_KEY);
}

async function logAdminAction(pool, actorUserId, actionType, actionTarget, metadata) {
  await pool.query(
    `INSERT INTO admin_action_log (actor_user_id, action_type, action_target, metadata)
     VALUES ($1::uuid, $2, $3, $4::jsonb)`,
    [actorUserId, actionType, actionTarget, JSON.stringify(metadata || {})]
  );
}

async function adminRoutes(app) {
  const preHandler = [authenticate, requireAdmin];

  // GET /api/admin/stats - dashboard overview
  app.get('/api/admin/stats', { preHandler }, async (req) => {
    const prisma = getPrisma();

    const [userCount, scoreCount, recentSignups] = await Promise.all([
      prisma.user.count(),
      prisma.publicScoreCard.count(),
      prisma.user.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 86400000) } } }),
    ]);

    return {
      newsletter: { status: 'pending', subscribers: 0, note: 'Listmonk not yet configured' },
      creators:   { total: userCount, recentSignups, period: '7 days' },
      scores:     { total: scoreCount },
      agents:     { status: 'pending', note: 'Agent system not yet configured' },
      system:     { status: 'healthy', uptime: process.uptime() },
      revenue:    { status: 'pending', note: 'Revenue dashboard coming soon' },
    };
  });

  // POST /api/admin/log - log an admin action
  app.post('/api/admin/log', { preHandler }, async (req) => {
    const { actionType, actionTarget, metadata } = req.body || {};
    const prisma = getPrisma();

    await prisma.$executeRaw`
      INSERT INTO admin_action_log (actor_user_id, action_type, action_target, metadata)
      VALUES (${req.user.userId}::uuid, ${actionType}, ${actionTarget}, ${JSON.stringify(metadata || {})}::jsonb)
    `;

    return { ok: true };
  });

  // GET /api/admin/me - confirm admin status
  app.get('/api/admin/me', { preHandler }, async (req) => {
    return { isAdmin: true, userId: req.user.userId, email: req.user.email };
  });

  // ── Editorial Composer Session ──

  // POST /api/admin/editorial/session/start - start a new session
  app.post('/api/admin/editorial/session/start', { preHandler }, async () => {
    const sessionId = uuidv4();
    return { sessionId };
  });

  // POST /api/admin/editorial/session/message - send a message in a session
  app.post('/api/admin/editorial/session/message', { preHandler }, async (req) => {
    const { sessionId, message } = req.body || {};
    if (!sessionId || !message) {
      return { error: 'sessionId and message are required' };
    }
    const result = await handleSessionMessage(sessionId, message);
    return result;
  });

  // POST /api/admin/editorial/session/end - end a session
  app.post('/api/admin/editorial/session/end', { preHandler }, async (req) => {
    const { sessionId } = req.body || {};
    if (!sessionId) return { error: 'sessionId is required' };
    await endSession(sessionId);
    return { ok: true };
  });

  // ── Voice Memory CRUD ──

  // GET /api/admin/voice-memory
  app.get('/api/admin/voice-memory', { preHandler }, async (req) => {
    const pool = getPool();
    const { topic, source, confidence, include_deprecated } = req.query || {};
    let query = 'SELECT * FROM voice_memory WHERE 1=1';
    const params = [];

    if (include_deprecated !== 'true') query += ' AND deprecated_at IS NULL';
    if (topic) { params.push(`%${topic}%`); query += ` AND topic ILIKE $${params.length}`; }
    if (source) { params.push(source); query += ` AND source = $${params.length}`; }
    if (confidence) { params.push(confidence); query += ` AND confidence = $${params.length}`; }
    query += ' ORDER BY last_referenced_at DESC NULLS LAST, created_at DESC LIMIT 200';

    const { rows } = await pool.query(query, params);
    return { entries: rows };
  });

  // POST /api/admin/voice-memory
  app.post('/api/admin/voice-memory', { preHandler }, async (req) => {
    const pool = getPool();
    const { topic, position, context, confidence, source } = req.body || {};
    const { rows } = await pool.query(
      `INSERT INTO voice_memory (topic, position, context, confidence, source) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [topic, position, context || null, confidence || 'medium', source || 'anthony']
    );
    return { entry: rows[0] };
  });

  // PUT /api/admin/voice-memory/:id
  app.put('/api/admin/voice-memory/:id', { preHandler }, async (req) => {
    const pool = getPool();
    const { topic, position, context, confidence } = req.body || {};
    const { rows } = await pool.query(
      `UPDATE voice_memory SET topic=$1, position=$2, context=$3, confidence=$4, updated_at=NOW() WHERE id=$5 RETURNING *`,
      [topic, position, context, confidence, req.params.id]
    );
    return { entry: rows[0] };
  });

  // DELETE /api/admin/voice-memory/:id (deprecate, not delete)
  app.delete('/api/admin/voice-memory/:id', { preHandler }, async (req) => {
    const pool = getPool();
    await pool.query('UPDATE voice_memory SET deprecated_at = NOW(), updated_at = NOW() WHERE id = $1', [req.params.id]);
    return { ok: true };
  });

  // ── Agent Runs ──

  // GET /api/admin/agent-runs
  app.get('/api/admin/agent-runs', { preHandler }, async (req) => {
    const pool = getPool();
    const { rows } = await pool.query(
      'SELECT id, agent_type, status, started_at, completed_at, error_message, created_at FROM agent_run ORDER BY created_at DESC LIMIT 50'
    );
    return { runs: rows };
  });

  // GET /api/admin/agent-runs/:id
  app.get('/api/admin/agent-runs/:id', { preHandler }, async (req) => {
    const pool = getPool();
    const { rows } = await pool.query('SELECT * FROM agent_run WHERE id = $1', [req.params.id]);
    return { run: rows[0] || null };
  });

  // ── Skills ──

  // GET /api/admin/skills
  app.get('/api/admin/skills', { preHandler }, async () => {
    const skills = listSkills();
    return { skills };
  });

  // ── User management ───────────────────────────────────────────────────────

  // GET /api/admin/users?search=&offset=&limit=
  app.get('/api/admin/users', { preHandler }, async (req) => {
    const pool     = getPool();
    const search   = req.query.search   ? `%${req.query.search}%` : '%';
    const limit    = Math.min(100, Math.max(1, parseInt(req.query.limit  ?? '50', 10) || 50));
    const offset   = Math.max(0,          parseInt(req.query.offset ?? '0',  10) || 0);

    const [{ rows }, { rows: countRows }] = await Promise.all([
      pool.query(
        `SELECT u.id, u.email, u.created_at,
                t.id AS tenant_id, t.status AS tenant_status, t.suspended_at,
                COALESCE(sp.name, 'free') AS plan_name,
                s.status AS sub_status,
                s.admin_override_plan,
                COALESCE(c.display_name, '') AS display_name
         FROM users u
         JOIN tenants t ON t.id = u.tenant_id
         LEFT JOIN subscriptions s ON s.tenant_id = t.id
         LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
         LEFT JOIN creators c ON c.user_id = u.id
         WHERE u.email ILIKE $1
         ORDER BY u.created_at DESC
         LIMIT $2 OFFSET $3`,
        [search, limit, offset]
      ),
      pool.query(
        `SELECT COUNT(*) AS total FROM users u WHERE u.email ILIKE $1`,
        [search]
      ),
    ]);

    return { users: rows, total: parseInt(countRows[0]?.total ?? '0', 10) };
  });

  // GET /api/admin/users/:userId
  app.get('/api/admin/users/:userId', { preHandler }, async (req, reply) => {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.created_at,
              t.id AS tenant_id, t.status AS tenant_status,
              t.suspended_at, t.suspended_by,
              COALESCE(sp.name, 'free') AS plan_name,
              s.status AS sub_status,
              s.admin_override_plan, s.admin_override_by,
              s.stripe_customer_id,
              s.trial_end, s.current_period_end,
              COALESCE(c.display_name, '') AS display_name
       FROM users u
       JOIN tenants t ON t.id = u.tenant_id
       LEFT JOIN subscriptions s ON s.tenant_id = t.id
       LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
       LEFT JOIN creators c ON c.user_id = u.id
       WHERE u.id = $1`,
      [req.params.userId]
    );
    if (rows.length === 0) return reply.code(404).send({ error: 'User not found' });

    const user = rows[0];

    // Look up most recent succeeded payment from Stripe if customer exists
    let latestPayment = null;
    if (user.stripe_customer_id && process.env.STRIPE_SECRET_KEY) {
      try {
        const stripe = getStripe();
        const intents = await stripe.paymentIntents.list({
          customer: user.stripe_customer_id,
          limit:    5,
        });
        const succeeded = intents.data.find(pi => pi.status === 'succeeded');
        if (succeeded) {
          latestPayment = {
            amount:   succeeded.amount_received,
            currency: succeeded.currency,
            date:     new Date(succeeded.created * 1000).toISOString(),
            intentId: succeeded.id,
          };
        }
      } catch {
        // Non-fatal — Stripe may not be configured in dev
      }
    }

    // Compute effective tier for display
    const effectiveTier = user.admin_override_plan
      || (user.sub_status === 'active' && user.plan_name !== 'free' ? user.plan_name : null)
      || (user.sub_status === 'trialling' && user.trial_end && new Date(user.trial_end) > new Date() ? user.plan_name : null)
      || 'free';

    return {
      ...user,
      effective_tier: effectiveTier,
      latest_payment: latestPayment,
    };
  });

  // POST /api/admin/users/:userId/override-tier  { plan: 'free'|'core'|'pro' }
  app.post('/api/admin/users/:userId/override-tier', { preHandler }, async (req, reply) => {
    const pool = getPool();
    const { plan } = req.body ?? {};
    if (!['free', 'core', 'pro'].includes(plan)) {
      return reply.code(400).send({ error: 'plan must be free, core, or pro' });
    }

    // Resolve tenant
    const { rows: userRows } = await pool.query(
      'SELECT tenant_id, email FROM users WHERE id = $1',
      [req.params.userId]
    );
    if (userRows.length === 0) return reply.code(404).send({ error: 'User not found' });
    const { tenant_id: tenantId, email: targetEmail } = userRows[0];

    if (plan === 'free') {
      // Remove any override — fall back to natural Stripe state
      await pool.query(
        `UPDATE subscriptions
         SET admin_override_plan = NULL, admin_override_by = NULL, updated_at = NOW()
         WHERE tenant_id = $1`,
        [tenantId]
      );
    } else {
      // Upsert subscription with the target plan and mark as admin override
      await pool.query(
        `INSERT INTO subscriptions (tenant_id, plan_id, status, admin_override_plan, admin_override_by)
         SELECT $1, id, 'active', $2, $3 FROM subscription_plans WHERE name = $2
         ON CONFLICT (tenant_id) DO UPDATE
           SET admin_override_plan = $2,
               admin_override_by   = $3,
               updated_at          = NOW()`,
        [tenantId, plan, req.user.email]
      );
    }

    await logAdminAction(pool, req.user.userId, 'override_tier', targetEmail, {
      plan, grantedBy: req.user.email,
    });

    return { ok: true };
  });

  // POST /api/admin/users/:userId/suspend  { reason }
  app.post('/api/admin/users/:userId/suspend', { preHandler }, async (req, reply) => {
    const pool = getPool();
    const { reason = '' } = req.body ?? {};

    const { rows: userRows } = await pool.query(
      'SELECT tenant_id, email FROM users WHERE id = $1',
      [req.params.userId]
    );
    if (userRows.length === 0) return reply.code(404).send({ error: 'User not found' });
    const { tenant_id: tenantId, email: targetEmail } = userRows[0];

    await pool.query(
      `UPDATE tenants
       SET status = 'suspended', suspended_at = NOW(), suspended_by = $1
       WHERE id = $2`,
      [req.user.email, tenantId]
    );

    await logAdminAction(pool, req.user.userId, 'suspend_account', targetEmail, {
      reason, suspendedBy: req.user.email,
    });

    return { ok: true };
  });

  // POST /api/admin/users/:userId/unsuspend
  app.post('/api/admin/users/:userId/unsuspend', { preHandler }, async (req, reply) => {
    const pool = getPool();

    const { rows: userRows } = await pool.query(
      'SELECT tenant_id, email FROM users WHERE id = $1',
      [req.params.userId]
    );
    if (userRows.length === 0) return reply.code(404).send({ error: 'User not found' });
    const { tenant_id: tenantId, email: targetEmail } = userRows[0];

    await pool.query(
      `UPDATE tenants
       SET status = 'active', suspended_at = NULL, suspended_by = NULL
       WHERE id = $1`,
      [tenantId]
    );

    await logAdminAction(pool, req.user.userId, 'unsuspend_account', targetEmail, {
      restoredBy: req.user.email,
    });

    return { ok: true };
  });

  // GET /api/admin/team - list all admin users
  app.get('/api/admin/team', { preHandler }, async () => {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.created_at, u.cfo_access_level,
              COALESCE(c.display_name, '') AS display_name
       FROM users u
       LEFT JOIN creators c ON c.user_id = u.id
       WHERE u.cfo_access_level >= 100
       ORDER BY u.created_at ASC`
    );
    return { admins: rows };
  });

  // POST /api/admin/users/:userId/set-access-level  { level: 0 | 100 }
  app.post('/api/admin/users/:userId/set-access-level', { preHandler }, async (req, reply) => {
    const pool = getPool();
    const level = Number(req.body?.level ?? -1);
    if (![0, 100].includes(level)) {
      return reply.code(400).send({ error: 'level must be 0 or 100' });
    }

    const { rows: targetRows } = await pool.query(
      'SELECT id, email FROM users WHERE id = $1',
      [req.params.userId]
    );
    if (targetRows.length === 0) return reply.code(404).send({ error: 'User not found' });

    if (targetRows[0].id === req.user.userId) {
      return reply.code(403).send({ error: 'Cannot change your own access level' });
    }

    await pool.query(
      'UPDATE users SET cfo_access_level = $1 WHERE id = $2',
      [level, req.params.userId]
    );

    await logAdminAction(pool, req.user.userId, 'set_access_level', targetRows[0].email, {
      level, changedBy: req.user.email,
    });

    return { ok: true };
  });

  // POST /api/admin/users/:userId/refund  { reason }
  app.post('/api/admin/users/:userId/refund', { preHandler }, async (req, reply) => {
    const pool = getPool();
    const { reason = '' } = req.body ?? {};

    const { rows: userRows } = await pool.query(
      `SELECT u.tenant_id, u.email, s.stripe_customer_id
       FROM users u
       LEFT JOIN subscriptions s ON s.tenant_id = u.tenant_id
       WHERE u.id = $1`,
      [req.params.userId]
    );
    if (userRows.length === 0) return reply.code(404).send({ error: 'User not found' });

    const { stripe_customer_id: stripeCustomerId, email: targetEmail } = userRows[0];

    if (!stripeCustomerId) {
      return reply.code(400).send({ error: 'No Stripe customer on record for this user' });
    }

    const stripe = getStripe();
    const intents = await stripe.paymentIntents.list({ customer: stripeCustomerId, limit: 5 });
    const latest  = intents.data.find(pi => pi.status === 'succeeded');

    if (!latest) {
      return reply.code(400).send({ error: 'No succeeded payment found to refund' });
    }

    const refund = await stripe.refunds.create({
      payment_intent: latest.id,
      reason:         'requested_by_customer',
    });

    await logAdminAction(pool, req.user.userId, 'refund_issued', targetEmail, {
      stripeRefundId: refund.id,
      amount:         latest.amount_received,
      currency:       latest.currency,
      reason,
      issuedBy:       req.user.email,
    });

    return {
      ok:       true,
      refundId: refund.id,
      amount:   latest.amount_received,
      currency: latest.currency,
    };
  });
}

module.exports = { adminRoutes };
