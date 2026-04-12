'use strict';

const { validateSession } = require('../domains/auth/authService');

// Fastify preHandler — attaches req.user or throws 401
async function authenticate(req, reply) {
  try {
    await req.jwtVerify();
  } catch {
    return reply.code(401).send({ error: 'Unauthorized', statusCode: 401 });
  }

  const session = await validateSession(req.user.sessionId);
  if (!session) {
    return reply.code(401).send({ error: 'Session expired', statusCode: 401 });
  }

  req.user = {
    userId:      session.user_id,
    tenantId:    session.tenant_id,
    sessionId:   session.id,
    email:       session.email,
    displayName: session.display_name,
  };
}

module.exports = { authenticate };
