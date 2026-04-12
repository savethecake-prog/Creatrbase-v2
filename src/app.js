'use strict';

require('dotenv').config();
const Fastify = require('fastify');

const app = Fastify({ logger: true });

app.get('/health', async () => ({ status: 'ok' }));
app.get('/', async () => ({ name: 'Creatrbase API', status: 'ok' }));

const start = async () => {
  try {
    await app.listen({ port: process.env.PORT || 3000, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
