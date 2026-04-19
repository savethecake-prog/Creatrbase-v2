'use strict';

const { authenticate } = require('../../middleware/authenticate');
const { requireTier }  = require('../../middleware/requireTier');
const { getPrisma }    = require('../../lib/prisma');
const { createSession, sendMessage, getSession } = require('../../agents/commercialCoach/coach');

async function coachRoutes(app) {

  // POST /api/coach/sessions
  // Create a new commercial coach session for the authenticated creator.
  app.post('/api/coach/sessions', { preHandler: [authenticate, requireTier('pro')] }, async (req, reply) => {
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
  // Send a message to the coach and get a response.
  app.post('/api/coach/sessions/:id/message', { preHandler: [authenticate, requireTier('pro')] }, async (req, reply) => {
    const { message } = req.body || {};
    if (!message || !message.trim()) {
      return reply.code(400).send({ error: 'message is required' });
    }

    const prisma = getPrisma();
    const creator = await prisma.creator.findFirst({
      where:  { userId: req.user.userId, tenantId: req.user.tenantId },
      select: { id: true },
    });
    if (!creator) return reply.code(404).send({ error: 'Creator not found' });

    try {
      const result = await sendMessage(req.params.id, creator.id, message.trim());
      return result;
    } catch (err) {
      if (err.message === 'Session not found') return reply.code(404).send({ error: 'Session not found' });
      throw err;
    }
  });

  // GET /api/coach/sessions/:id
  // Retrieve session history for a coach session.
  app.get('/api/coach/sessions/:id', { preHandler: [authenticate, requireTier('pro')] }, async (req, reply) => {
    const session = await getSession(req.params.id);
    if (!session) return reply.code(404).send({ error: 'Session not found' });
    return session;
  });
}

module.exports = coachRoutes;
