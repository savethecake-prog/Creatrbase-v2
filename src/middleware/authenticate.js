'use strict';

const { validateSession } = require('../domains/auth/authService');
const { getPool }         = require('../db/pool');

// Fastify preHandler — attaches req.user or throws 401/403
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

  // Block suspended accounts before setting req.user
  const pool = getPool();
  const { rows } = await pool.query(
    'SELECT status FROM tenants WHERE id = $1',
    [session.tenant_id]
  );
  if (rows[0]?.status === 'suspended') {
    return reply.code(403).send({ error: 'Account suspended', statusCode: 403 });
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
