'use strict';

const { authenticate } = require('../../middleware/authenticate');
const { requireAdmin } = require('../../middleware/requireAdmin');
const { getPrisma }    = require('../../lib/prisma');

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
}

module.exports = { adminRoutes };
