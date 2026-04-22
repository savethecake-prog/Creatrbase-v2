'use strict';

const { getPool } = require('../../db/pool');
const { getListmonkClient } = require('../../services/listmonkClient');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function newsletterRoutes(app) {

  // POST /api/newsletter/subscribe
  app.post('/api/newsletter/subscribe', {
    config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
  }, async (req, reply) => {
    const { email, source, source_detail, segments, marketing_consent } = req.body || {};

    if (!email || !EMAIL_RE.test(email)) {
      return reply.code(400).send({ error: 'invalid_email', message: 'Please enter a valid email address.' });
    }

    if (!marketing_consent) {
      return reply.code(400).send({ error: 'consent_required', message: 'Marketing consent is required to subscribe.' });
    }

    const pool = getPool();

    // Check if already subscribed in our attribution table
    const existing = await pool.query(
      'SELECT id FROM newsletter_subscriber_attribution WHERE LOWER(email) = LOWER($1)',
      [email.trim()]
    );

    if (existing.rows.length > 0) {
      return reply.code(409).send({
        error: 'already_subscribed',
        message: 'This email is already subscribed. You can manage your preferences in your account settings.',
      });
    }

    // Try subscribing via Listmonk
    let listmonkSubId = null;
    try {
      const client = getListmonkClient();
      // Get list IDs for the requested segments
      const listsData = await client.getLists();
      const allLists = listsData.data?.results || [];
      const requestedSegments = segments || ['creator-economy', 'ai-for-creators', 'editorial'];
      const matchedLists = allLists
        .filter(l => requestedSegments.some(s => l.name.toLowerCase().includes(s.replace(/-/g, ' ')) || l.uuid === s))
        .map(l => l.uuid);

      if (matchedLists.length > 0) {
        const sub = await client.subscribe(email.trim(), matchedLists);
        listmonkSubId = sub.data?.id || null;
      }
    } catch (listmonkErr) {
      // Listmonk may not be running yet; log and continue with attribution only
      app.log.warn({ err: listmonkErr }, 'Listmonk subscribe failed (non-fatal)');
    }

    // Record attribution with consent timestamp
    await pool.query(
      `INSERT INTO newsletter_subscriber_attribution
         (email, listmonk_sub_id, source, source_detail, initial_segments, marketing_consent, consent_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT ((LOWER(email))) DO NOTHING`,
      [email.trim(), listmonkSubId, source || 'unknown', source_detail || null,
       segments || ['creator-economy', 'ai-for-creators', 'editorial'],
       marketing_consent === true]
    );

    return {
      ok: true,
      requires_confirmation: true,
      message: 'Check your inbox for a confirmation link.',
    };
  });
}

module.exports = { newsletterRoutes };
