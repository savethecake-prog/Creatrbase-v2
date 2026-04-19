'use strict';

const { authenticate } = require('../../middleware/authenticate');
const { requireTier }  = require('../../middleware/requireTier');
const { getPrisma }    = require('../../lib/prisma');
const { getPool }      = require('../../db/pool');

async function resolveCreator(userId, tenantId) {
  const prisma = getPrisma();
  const creator = await prisma.creator.findFirst({
    where:  { userId, tenantId },
    select: { id: true },
  });
  return creator ? { creatorId: creator.id } : null;
}

async function signalRoutes(app) {
  // GET /api/signals/recent
  // Returns the last 20 signal events for the authenticated creator, newest first.
  // Available to core+ tier so the transparency feed is visible to paying users.

  app.get('/api/signals/recent', { preHandler: [authenticate, requireTier('core')] }, async (req, reply) => {
    const resolved = await resolveCreator(req.user.userId, req.user.tenantId);
    if (!resolved) return reply.code(404).send({ error: 'Creator profile not found' });

    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT
         id,
         signal_type,
         source_feature,
         status,
         quality_score,
         quality_factors,
         applied_updates,
         description,
         created_at,
         processed_at
       FROM signal_events
       WHERE creator_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [resolved.creatorId]
    );

    return { signals: rows };
  });
}

module.exports = signalRoutes;
