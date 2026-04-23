'use strict';

// ─── Email verifier worker ────────────────────────────────────────────────────
//
// Job types:
//
//   emails:probe-address  { email, brandId?, contactId?, brandWebsite? }
//     SMTP probe for a single address. Writes result to brands or brand_contacts
//     and logs to email_probe_log. Domain-level cache (30-day TTL) skips repeat
//     SMTP work for known catch-all domains.
//
//   emails:probe-all-registry  {}
//     Sweeps all brands with a partnership_email that hasn't been probed in 30
//     days. Queued once on startup and weekly (Sundays 4am). Rate-limited to
//     one probe every 2 seconds to avoid triggering mail server defences.
//
// No npm packages required. Probe uses Node built-in `net` + `dns` via
// src/services/emailProbe.js.
// ─────────────────────────────────────────────────────────────────────────────

const { getPool }                  = require('../../db/pool');
const { getDataCollectionQueue }   = require('../queue');
const { probeEmail }               = require('../../services/emailProbe');
const { calculateEmailConfidence } = require('../../services/emailConfidence');

// ─── emails:probe-address ─────────────────────────────────────────────────────

async function handleProbeAddress(job) {
  const { email, brandId, contactId, brandWebsite } = job.data;
  if (!email) throw new Error('emails:probe-address: missing email');

  const pool   = getPool();
  const domain = email.slice(email.indexOf('@') + 1).toLowerCase();

  job.log(`Probing: ${email}`);

  // ── Domain cache: skip full SMTP if domain is a known catch-all ────────────
  const { rows: cached } = await pool.query(
    `SELECT catch_all
     FROM email_probe_log
     WHERE domain = $1
       AND created_at > NOW() - INTERVAL '30 days'
     ORDER BY created_at DESC
     LIMIT 1`,
    [domain]
  );

  let probeResult;
  if (cached.length > 0 && cached[0].catch_all === true) {
    job.log(`Domain ${domain}: cached catch-all — skipping SMTP probe`);
    probeResult = { status: 'catch_all', catchAll: true, domain };
  } else {
    probeResult = await probeEmail(email);
    job.log(`Probe: status=${probeResult.status} code=${probeResult.smtpCode ?? '-'} ms=${probeResult.durationMs ?? '-'}`);
  }

  const { score, factors } = calculateEmailConfidence(email, probeResult, {
    brandWebsite: brandWebsite || null,
  });

  // ── Log result ────────────────────────────────────────────────────────────
  await pool.query(
    `INSERT INTO email_probe_log
       (email, domain, mx_exists, smtp_status, catch_all, smtp_code, smtp_message, probe_ms, error_detail)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      email,
      domain,
      probeResult.status !== 'no_mx',
      probeResult.status,
      probeResult.catchAll ?? false,
      probeResult.smtpCode    ?? null,
      probeResult.smtpMessage ?? null,
      probeResult.durationMs  ?? null,
      probeResult.error       ?? null,
    ]
  );

  // ── Write to brands ───────────────────────────────────────────────────────
  if (brandId) {
    await pool.query(
      `UPDATE brands
       SET partnership_email_status           = $2,
           partnership_email_confidence       = $3,
           partnership_email_last_verified_at = NOW(),
           partnership_email_smtp_result      = $4
       WHERE id = $1`,
      [brandId, probeResult.status, score, JSON.stringify({ factors, probe: probeResult })]
    );
    job.log(`brands.${brandId} → ${probeResult.status} (confidence=${score})`);
  }

  // ── Write to brand_contacts ───────────────────────────────────────────────
  if (contactId) {
    await pool.query(
      `UPDATE brand_contacts
       SET email_status           = $2,
           email_confidence       = $3,
           email_last_verified_at = NOW(),
           smtp_result            = $4
       WHERE id = $1`,
      [contactId, probeResult.status, score, JSON.stringify({ factors, probe: probeResult })]
    );
    job.log(`brand_contacts.${contactId} → ${probeResult.status} (confidence=${score})`);
  }
}

// ─── emails:probe-all-registry ────────────────────────────────────────────────

async function handleProbeAllRegistry(job) {
  const pool  = getPool();
  const queue = getDataCollectionQueue();

  const { rows } = await pool.query(`
    SELECT id, partnership_email, website
    FROM brands
    WHERE partnership_email IS NOT NULL
      AND (
        partnership_email_last_verified_at IS NULL
        OR partnership_email_last_verified_at < NOW() - INTERVAL '30 days'
      )
  `);

  job.log(`Registry sweep: ${rows.length} address(es) to probe`);

  // Rate-limit: 1 probe per 2 seconds — stagger with Bull delay.
  for (let i = 0; i < rows.length; i++) {
    const brand = rows[i];
    await queue.add(
      'emails:probe-address',
      {
        email:       brand.partnership_email,
        brandId:     brand.id,
        brandWebsite: brand.website || null,
      },
      {
        delay:    i * 2000,
        attempts: 2,
        backoff:  { type: 'fixed', delay: 30_000 },
      }
    );
  }
}

// ─── Worker registration ──────────────────────────────────────────────────────

function startEmailVerifierWorker() {
  const queue = getDataCollectionQueue();

  queue.process('emails:probe-address',      3, async (job) => handleProbeAddress(job));
  queue.process('emails:probe-all-registry',    async (job) => handleProbeAllRegistry(job));

  // Weekly registry sweep — Sundays at 4am
  queue.add('emails:probe-all-registry', {}, {
    repeat:           { cron: '0 4 * * 0' },
    removeOnComplete: 3,
    removeOnFail:     5,
  });

  // One-time startup sweep (Bull deduplicates by jobId across restarts)
  queue.add('emails:probe-all-registry', {}, {
    jobId:            'email-registry-startup-sweep',
    removeOnComplete: true,
    removeOnFail:     5,
  });

  console.log('[emailVerifier] worker registered — probe-address, probe-all-registry active');
}

module.exports = { startEmailVerifierWorker };
