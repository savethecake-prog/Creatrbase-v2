'use strict';

const { authenticate } = require('../../middleware/authenticate');
const { requireAdmin } = require('../../middleware/requireAdmin');
const { getPrisma }    = require('../../lib/prisma');
const { getPool }      = require('../../db/pool');
const { handleSessionMessage, endSession } = require('../../agents/newsletter/editorial-composer');
const { v4: uuidv4 }  = require('uuid');

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
}

module.exports = { adminRoutes };
