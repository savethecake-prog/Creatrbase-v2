'use strict';

require('dotenv').config();
const path = require('path');
const Fastify = require('fastify');
const staticPlugin = require('@fastify/static');

const app = Fastify({ logger: true });

// API routes
app.get('/health', async () => ({ status: 'ok' }));

// Serve built frontend in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'dist', 'client');

  app.register(staticPlugin, {
    root: clientDist,
    prefix: '/',
  });

  // SPA fallback — all non-API routes serve index.html
  app.setNotFoundHandler(async (req, reply) => {
    if (req.url.startsWith('/api/')) {
      return reply.code(404).send({ error: 'Not Found', statusCode: 404 });
    }
    return reply.sendFile('index.html');
  });
}

const start = async () => {
  try {
    await app.listen({ port: process.env.PORT || 3000, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
