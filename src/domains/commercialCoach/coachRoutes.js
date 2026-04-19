'use strict';

const { authenticate }  = require('../../middleware/authenticate');
const { getPrisma }     = require('../../lib/prisma');
const { resolveTier }   = require('../../services/tierResolver');
const { getUserApiKey } = require('../apikeys/apiKeyRoutes');
const { createSession, sendMessage, getSession } = require('../../agents/commercialCoach/coach');

async function coachRoutes(app) {

  // POST /api/coach/sessions
  app.post('/api/coach/sessions', { preHandler: authenticate }, async (req, reply) => {
    const userKey = await getUserApiKey(req.user.userId, 'anthropic');
    if (!userKey) {
      const { tier } = await resolveTier(req.user.tenantId);
      if (tier !== 'pro') return reply.code(403).send({ error: 'Pro tier or personal API key required', code: 'UPGRADE_REQUIRED' });
    }

    const prisma = getPrisma();
    const creator = await prisma.creator.findFirst({
      where:  { userId: req.user.userId, tenantId: req.user.tenantId },
      select: { id: true },
    });
    if (!creator) return reply.code(404).send({ error: 'Creator not found' });

    const sessionId = await createSession(creator.id, req.user.tenantId);
    return { sessionId };
  });

  // POST /api/coach/sessions/:id/message
  app.post('/api/coach/sessions/:id/message', { preHandler: authenticate }, async (req, reply) => {
    const { message } = req.body || {};
    if (!message || !message.trim()) {
      return reply.code(400).send({ error: 'message is required' });
    }

    const userKey = await getUserApiKey(req.user.userId, 'anthropic');
    if (!userKey) {
      const { tier } = await resolveTier(req.user.tenantId);
      if (tier !== 'pro') return reply.code(403).send({ error: 'Pro tier or personal API key required', code: 'UPGRADE_REQUIRED' });
    }

    const prisma = getPrisma();
    const creator = await prisma.creator.findFirst({
      where:  { userId: req.user.userId, tenantId: req.user.tenantId },
      select: { id: true },
    });
    if (!creator) return reply.code(404).send({ error: 'Creator not found' });

    try {
      const result = await sendMessage(req.params.id, creator.id, message.trim(), userKey?.apiKey || null);
      return result;
    } catch (err) {
      if (err.message === 'Session not found') return reply.code(404).send({ error: 'Session not found' });
      throw err;
    }
  });

  // GET /api/coach/sessions/:id
  app.get('/api/coach/sessions/:id', { preHandler: authenticate }, async (req, reply) => {
    const session = await getSession(req.params.id);
    if (!session) return reply.code(404).send({ error: 'Session not found' });
    return session;
  });
}

module.exports = coachRoutes;
