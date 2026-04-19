'use strict';

const Anthropic  = require('@anthropic-ai/sdk');
const { getPool } = require('../../db/pool');
const { authenticate } = require('../../middleware/authenticate');
const { encrypt, decrypt, mask } = require('../../services/apiKeyStore');

async function apiKeyRoutes(app) {
  // GET /api/apikey — return current key status (never the raw key)
  app.get('/api/apikey', { preHandler: authenticate }, async (req) => {
    const pool = getPool();
    const { rows } = await pool.query(
      'SELECT provider, model_pref, verified_at, last_used_at, created_at FROM user_api_keys WHERE user_id = $1',
      [req.user.userId]
    );
    return { keys: rows };
  });

  // POST /api/apikey — validate and store a key
  app.post('/api/apikey', { preHandler: authenticate }, async (req, reply) => {
    const { provider = 'anthropic', apiKey, modelPref } = req.body || {};
    if (!apiKey || typeof apiKey !== 'string') {
      return reply.code(400).send({ error: 'apiKey is required' });
    }
    if (!['anthropic', 'google', 'openai'].includes(provider)) {
      return reply.code(400).send({ error: 'Unsupported provider' });
    }

    // Validate the key against the provider
    if (provider === 'anthropic') {
      try {
        const client = new Anthropic({ apiKey });
        await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }],
        });
      } catch (err) {
        // 401 = bad key. Rate limits (429) or other errors mean the key itself is valid.
        if (err.status === 401 || err.status === 403) {
          return reply.code(422).send({ error: 'Key validation failed. Check the key and try again.' });
        }
      }
    }

    const pool = getPool();
    const encrypted = encrypt(apiKey);

    await pool.query(
      `INSERT INTO user_api_keys (user_id, tenant_id, provider, encrypted_key, model_pref, verified_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id, provider) DO UPDATE
         SET encrypted_key = EXCLUDED.encrypted_key,
             model_pref    = EXCLUDED.model_pref,
             verified_at   = NOW()`,
      [req.user.userId, req.user.tenantId, provider, encrypted, modelPref || null]
    );

    return { ok: true, masked: mask(apiKey) };
  });

  // DELETE /api/apikey/:provider — remove a key
  app.delete('/api/apikey/:provider', { preHandler: authenticate }, async (req, reply) => {
    const { provider } = req.params;
    const pool = getPool();
    const { rowCount } = await pool.query(
      'DELETE FROM user_api_keys WHERE user_id = $1 AND provider = $2',
      [req.user.userId, provider]
    );
    if (rowCount === 0) return reply.code(404).send({ error: 'Key not found' });
    return { ok: true };
  });
}

/**
 * Retrieve and decrypt the stored API key for a user+provider.
 * Used internally by agent routes to inject the user's key.
 */
async function getUserApiKey(userId, provider = 'anthropic') {
  const pool = getPool();
  const { rows } = await pool.query(
    'SELECT encrypted_key, model_pref FROM user_api_keys WHERE user_id = $1 AND provider = $2 AND verified_at IS NOT NULL',
    [userId, provider]
  );
  if (!rows[0]) return null;

  await pool.query(
    'UPDATE user_api_keys SET last_used_at = NOW() WHERE user_id = $1 AND provider = $2',
    [userId, provider]
  );

  return { apiKey: decrypt(rows[0].encrypted_key), modelPref: rows[0].model_pref };
}

module.exports = { apiKeyRoutes, getUserApiKey };
