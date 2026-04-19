'use strict';

// ─── Signal processor worker ──────────────────────────────────────────────────
// Three job types on the existing data-collection Bull queue:
//
//   signals:ingest  { signalType, sourceInteractionId, creatorId, tenantId }
//     Load source row -> calculate quality -> INSERT signal_events -> queue signals:apply
//
//   signals:apply   { signalEventId }
//     Apply the signal: update CreatorCommercialProfile, cpm_benchmarks, etc.
//
//   signals:reprocess-failed  {} (hourly)
//     Re-queue signals:apply for any failed events from the last 7 days
// ─────────────────────────────────────────────────────────────────────────────

const { getPrisma }              = require('../../lib/prisma');
const { getPool }                = require('../../db/pool');
const { getDataCollectionQueue } = require('../queue');
const { calculateQuality }       = require('../../services/signalQuality');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tierFromSubscribers(count) {
  if (!count || count < 1000)  return '1k-10k';
  if (count < 10_000)  return '1k-10k';
  if (count < 50_000)  return '10k-50k';
  if (count < 100_000) return '50k-100k';
  return '100k+';
}

function confidenceAfterDeals(confirmedCount, sameTypeCount, recentCount) {
  if (confirmedCount >= 5 && recentCount >= 2) return 'high';
  if (sameTypeCount >= 3) return 'medium';
  if (confirmedCount >= 1) return 'low';
  return null;
}

function buildDealDescription({ brandName, agreedRate, rateCurrency, nicheLabel, rateConfidence, rateLow, rateHigh }) {
  const currency = rateCurrency === 'GBP' ? '£' : rateCurrency === 'EUR' ? '€' : '$';
  const parts = ['Your deal has been recorded.'];
  if (rateLow && rateHigh) {
    const confidence = rateConfidence ? ` Confidence: ${rateConfidence.charAt(0).toUpperCase() + rateConfidence.slice(1)}.` : '';
    parts.push(
      `Your estimated ${nicheLabel || ''} integration rate is now ${currency}${rateLow.toLocaleString()}-${currency}${rateHigh.toLocaleString()}.${confidence}`
    );
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

// ─── signals:ingest ───────────────────────────────────────────────────────────

async function handleIngest(job) {
  const { signalType, sourceInteractionId, creatorId, tenantId, sourceFeature } = job.data;
  if (!signalType || !sourceInteractionId || !creatorId || !tenantId) {
    throw new Error('signals:ingest missing required fields');
  }
  if (!['negotiations', 'gmail_sync', 'brands_outreach'].includes(sourceFeature)) {
    throw new Error(`signals:ingest invalid sourceFeature: ${sourceFeature}`);
  }

  const pool = getPool();

  // Load the source interaction row
  const { rows } = await pool.query(
    `SELECT * FROM brand_creator_interactions WHERE id = $1`,
    [sourceInteractionId]
  );
  if (!rows.length) throw new Error(`brand_creator_interactions row not found: ${sourceInteractionId}`);
  const sourceRow = rows[0];

  const { score, factors } = await calculateQuality(signalType, sourceRow);

  // Build human-readable description
  let description = '';
  if (signalType === 'deal_closed') {
    const currency = sourceRow.rate_currency === 'GBP' ? '£' : sourceRow.rate_currency === 'EUR' ? '€' : '$';
    const rateStr = sourceRow.agreed_rate
      ? `${currency}${Number(sourceRow.agreed_rate).toLocaleString()} agreed`
      : 'rate not recorded';
    description = `Deal recorded (${rateStr}). Your rate estimate will be updated.`;
  } else if (signalType === 'brand_replied') {
    description = 'A brand replied to your outreach. Noted as a positive buying signal.';
  } else if (signalType === 'outreach_sent_with_state') {
    description = 'Outreach sent. Your commercial profile at this moment has been snapshotted for future reference.';
  }

  // Insert signal_events row
  const { rows: inserted } = await pool.query(
    `INSERT INTO signal_events
       (tenant_id, creator_id, source_feature, signal_type, status,
        source_interaction_id, quality_score, quality_factors, payload, description)
     VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      tenantId,
      creatorId,
      sourceFeature,
      signalType,
      sourceInteractionId,
      score,
      JSON.stringify(factors),
      JSON.stringify({ sourceInteractionId }),
      description,
    ]
  );

  const signalEventId = inserted[0].id;
  job.log(`Signal event created: ${signalEventId} (type=${signalType} quality=${score})`);

  await getDataCollectionQueue().add(
    'signals:apply',
    { signalEventId },
    { attempts: 3, backoff: { type: 'exponential', delay: 5000 } }
  );
}

// ─── signals:apply ────────────────────────────────────────────────────────────

async function handleApply(job) {
  const { signalEventId } = job.data;
  if (!signalEventId) throw new Error('signals:apply missing signalEventId');

  const pool   = getPool();
  const prisma = getPrisma();
  const queue  = getDataCollectionQueue();

  // Load the signal event
  const { rows: eventRows } = await pool.query(
    `SELECT se.*, bci.*,
            se.id AS signal_id,
            se.creator_id AS signal_creator_id,
            se.tenant_id AS signal_tenant_id,
            se.signal_type AS signal_type_val,
            se.source_interaction_id AS interaction_id
     FROM signal_events se
     LEFT JOIN brand_creator_interactions bci ON bci.id = se.source_interaction_id
     WHERE se.id = $1`,
    [signalEventId]
  );
  if (!eventRows.length) throw new Error(`signal_events row not found: ${signalEventId}`);
  const ev = eventRows[0];

  if (ev.status === 'applied' || ev.status === 'skipped') {
    job.log(`Signal ${signalEventId} already ${ev.status} — skipping`);
    return;
  }

  // Mark processing
  await pool.query(
    `UPDATE signal_events SET status = 'processing' WHERE id = $1`,
    [signalEventId]
  );

  try {
    const signalType  = ev.signal_type_val;
    const creatorId   = ev.signal_creator_id;
    const tenantId    = ev.signal_tenant_id;

    if (signalType === 'brand_replied' || signalType === 'outreach_sent_with_state') {
      // outreach_sent_with_state: write creator state snapshot to the source interaction
      if (signalType === 'outreach_sent_with_state' && ev.interaction_id) {
        const profile = await prisma.creatorCommercialProfile.findUnique({
          where: { creatorId },
        });
        if (profile) {
          await pool.query(
            `UPDATE brand_creator_interactions
             SET creator_state_snapshot = $1
             WHERE id = $2`,
            [
              JSON.stringify({
                cvs_score:        profile.commercialViabilityScore,
                tier:             profile.commercialTier,
                rate_low:         profile.estimatedRateLow,
                rate_high:        profile.estimatedRateHigh,
                rate_confidence:  profile.rateConfidence,
                snapshot_taken_at: new Date().toISOString(),
              }),
              ev.interaction_id,
            ]
          );
        }
      }
      await pool.query(
        `UPDATE signal_events
         SET status = 'applied', processed_at = NOW()
         WHERE id = $1`,
        [signalEventId]
      );
      return;
    }

    // ── deal_closed ───────────────────────────────────────────────────────────

    // Load current profile for before snapshot
    const profileBefore = await prisma.creatorCommercialProfile.findUnique({
      where: { creatorId },
    });

    // Query last 5 agreed_rate values for this creator to set rate range
    const { rows: rateHistory } = await pool.query(
      `SELECT bci.agreed_rate, bci.rate_currency, bci.deliverable_type, bci.created_at
       FROM brand_creator_interactions bci
       WHERE bci.creator_id = $1
         AND bci.interaction_type = 'deal_completed'
         AND bci.agreed_rate IS NOT NULL
       ORDER BY bci.created_at DESC
       LIMIT 5`,
      [creatorId]
    );

    // Same deliverable_type count (for confidence escalation)
    const { rows: sameTypeRows } = await pool.query(
      `SELECT COUNT(*) AS cnt
       FROM brand_creator_interactions
       WHERE creator_id = $1
         AND interaction_type = 'deal_completed'
         AND agreed_rate IS NOT NULL
         AND deliverable_type = $2`,
      [creatorId, ev.deliverable_type || null]
    );

    // Recent deals (within 6 months, for 'high' confidence threshold)
    const { rows: recentRows } = await pool.query(
      `SELECT COUNT(*) AS cnt
       FROM brand_creator_interactions
       WHERE creator_id = $1
         AND interaction_type = 'deal_completed'
         AND agreed_rate IS NOT NULL
         AND created_at > NOW() - INTERVAL '6 months'`,
      [creatorId]
    );

    const currentCount = (profileBefore?.confirmedDealsCount ?? 0) + 1;
    const sameTypeCount = parseInt(sameTypeRows[0]?.cnt ?? '0', 10);
    const recentCount   = parseInt(recentRows[0]?.cnt ?? '0', 10);
    const newConfidence = confidenceAfterDeals(currentCount, sameTypeCount, recentCount);

    let newRateLow  = profileBefore?.estimatedRateLow  ?? null;
    let newRateHigh = profileBefore?.estimatedRateHigh ?? null;
    const rateCurrency = ev.rate_currency || profileBefore?.rateCurrency || 'GBP';

    if (rateHistory.length >= 1) {
      const rates = rateHistory.map((r) => Number(r.agreed_rate));
      newRateLow  = Math.round(Math.min(...rates) * 0.9);  // 10% below min as floor
      newRateHigh = Math.round(Math.max(...rates) * 1.1);  // 10% above max as ceiling
    }

    const newEarningsTotal = (profileBefore?.confirmedEarningsTotal ?? 0) + (ev.agreed_rate ? Number(ev.agreed_rate) : 0);

    // 12-month earnings: sum from DB directly
    const { rows: earnings12moRows } = await pool.query(
      `SELECT COALESCE(SUM(agreed_rate), 0) AS total
       FROM brand_creator_interactions
       WHERE creator_id = $1
         AND interaction_type = 'deal_completed'
         AND agreed_rate IS NOT NULL
         AND created_at > NOW() - INTERVAL '12 months'`,
      [creatorId]
    );
    const newEarnings12mo = parseInt(earnings12moRows[0]?.total ?? '0', 10);

    // Update CreatorCommercialProfile
    const profileAfter = await prisma.creatorCommercialProfile.upsert({
      where: { creatorId },
      create: {
        creatorId,
        tenantId,
        confirmedDealsCount:    1,
        confirmedEarningsTotal: ev.agreed_rate ? Number(ev.agreed_rate) : 0,
        confirmedEarnings12mo:  ev.agreed_rate ? Number(ev.agreed_rate) : 0,
        lastDealDate:           new Date(),
        estimatedRateLow:       newRateLow,
        estimatedRateHigh:      newRateHigh,
        rateCurrency,
        rateConfidence:         newConfidence,
        rateLastCalculated:     new Date(),
      },
      update: {
        confirmedDealsCount:    { increment: 1 },
        confirmedEarningsTotal: newEarningsTotal,
        confirmedEarnings12mo:  newEarnings12mo,
        lastDealDate:           new Date(),
        estimatedRateLow:       newRateLow,
        estimatedRateHigh:      newRateHigh,
        rateCurrency,
        rateConfidence:         newConfidence,
        rateLastCalculated:     new Date(),
      },
    });

    // Upsert cpm_benchmarks with anonymised rate data
    if (newRateLow && newRateHigh && ev.niche) {
      const { rows: subRows } = await pool.query(
        `SELECT pp.subscriber_count
         FROM platform_profiles pp
         WHERE pp.creator_id = $1
         ORDER BY pp.subscriber_count DESC NULLS LAST
         LIMIT 1`,
        [creatorId]
      );
      const subscriberCount = subRows[0]?.subscriber_count ?? null;
      const audienceTier    = tierFromSubscribers(subscriberCount);
      const nicheSlug       = ev.niche.toLowerCase().replace(/\s+/g, '-');
      const geoCountry      = (ev.geo && ev.geo !== 'global') ? ev.geo.toLowerCase() : 'uk';

      await pool.query(
        `INSERT INTO cpm_benchmarks
           (niche_slug, platform, country, audience_tier, cpm_low, cpm_high,
            typical_rate_low, typical_rate_high, currency, source, updated_at)
         VALUES ($1, 'youtube', $2, $3, $4, $5, $6, $7, $8, 'signal_feedback', NOW())
         ON CONFLICT (niche_slug, platform, country, audience_tier)
         DO UPDATE SET
           typical_rate_low  = LEAST(cpm_benchmarks.typical_rate_low, EXCLUDED.typical_rate_low),
           typical_rate_high = GREATEST(cpm_benchmarks.typical_rate_high, EXCLUDED.typical_rate_high),
           source     = 'signal_feedback',
           updated_at = NOW()`,
        [nicheSlug, geoCountry, audienceTier, newRateLow, newRateHigh, newRateLow, newRateHigh, rateCurrency]
      );
    }

    // Build transparency description for the feed
    const currency = rateCurrency === 'GBP' ? '£' : rateCurrency === 'EUR' ? '€' : '$';
    const rateStr  = (newRateLow && newRateHigh)
      ? ` Your estimated rate is now ${currency}${newRateLow.toLocaleString()}-${currency}${newRateHigh.toLocaleString()}.`
      : '';
    const confStr  = newConfidence
      ? ` Confidence: ${newConfidence.charAt(0).toUpperCase() + newConfidence.slice(1)}.`
      : '';
    const updatedDescription = `Deal recorded (${currentCount} total).${rateStr}${confStr}`;

    // Mark applied with before/after snapshot
    await pool.query(
      `UPDATE signal_events
       SET status = 'applied',
           processed_at = NOW(),
           description = $1,
           applied_updates = $2
       WHERE id = $3`,
      [
        updatedDescription,
        JSON.stringify({
          fields_updated: ['confirmedDealsCount', 'estimatedRateLow', 'estimatedRateHigh', 'rateConfidence'],
          before: {
            confirmedDealsCount:  profileBefore?.confirmedDealsCount  ?? 0,
            estimatedRateLow:     profileBefore?.estimatedRateLow     ?? null,
            estimatedRateHigh:    profileBefore?.estimatedRateHigh    ?? null,
            rateConfidence:       profileBefore?.rateConfidence       ?? null,
          },
          after: {
            confirmedDealsCount:  profileAfter.confirmedDealsCount,
            estimatedRateLow:     profileAfter.estimatedRateLow,
            estimatedRateHigh:    profileAfter.estimatedRateHigh,
            rateConfidence:       profileAfter.rateConfidence,
          },
        }),
        signalEventId,
      ]
    );

    // Trigger a re-score so the CVS reflects the new deal data
    await queue.add('analysis:score-creator', {
      creatorId,
      triggerType: 'deal_signal',
    });

    job.log(`Signal applied: ${signalEventId} — deals=${currentCount} rate=${newRateLow}-${newRateHigh} confidence=${newConfidence}`);

  } catch (err) {
    await pool.query(
      `UPDATE signal_events SET status = 'failed', error_detail = $1 WHERE id = $2`,
      [err.message, signalEventId]
    );
    throw err; // Bull will retry
  }
}

// ─── signals:reprocess-failed ─────────────────────────────────────────────────

async function handleReprocessFailed() {
  const pool  = getPool();
  const queue = getDataCollectionQueue();

  const { rows: failed } = await pool.query(
    `SELECT id FROM signal_events
     WHERE status = 'failed'
       AND created_at > NOW() - INTERVAL '7 days'
     ORDER BY created_at DESC
     LIMIT 10`
  );

  for (const row of failed) {
    await queue.add(
      'signals:apply',
      { signalEventId: row.id },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } }
    );
  }

  console.log(`[signalProcessor] reprocess-failed: queued ${failed.length} signal(s)`);
}

// ─── Worker registration ───────────────────────────────────────────────────────

function startSignalProcessorWorker() {
  const queue = getDataCollectionQueue();

  queue.process('signals:ingest', 5, async (job) => handleIngest(job));
  queue.process('signals:apply',  5, async (job) => handleApply(job));

  // Hourly reprocess of failed signals
  queue.process('signals:reprocess-failed', async () => handleReprocessFailed());
  queue.add('signals:reprocess-failed', {}, {
    repeat:           { cron: '30 * * * *' },
    removeOnComplete: 3,
    removeOnFail:     5,
  });

  console.log('[signalProcessor] worker registered — ingest, apply, and reprocess-failed active');
}

module.exports = { startSignalProcessorWorker };
