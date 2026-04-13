'use strict';

// ─── Gap Tracker service ──────────────────────────────────────────────────────
// Calculates threshold gaps, velocity, and projections for a creator.
//
// Thresholds are hardcoded here — they're stable platform rules, not user data.
// Velocity is derived from the two most recent snapshots in
// platform_metrics_snapshots. With only one snapshot, velocity is null.
// ─────────────────────────────────────────────────────────────────────────────

const { getPool } = require('../../db/pool');

// ─── YouTube monetisation thresholds ────────────────────────────────────────

const YOUTUBE_THRESHOLDS = [
  {
    id:          'ypp',
    name:        'YouTube Partner Program',
    description: 'Unlock ad revenue, channel memberships, and Super Thanks',
    dimensions:  [
      { metric: 'subscriber_count', label: 'Subscribers',              required: 1_000  },
      { metric: 'watch_hours_12mo', label: 'Watch Hours (12 months)',  required: 4_000  },
    ],
  },
  {
    id:          'youtube_shopping',
    name:        'YouTube Shopping',
    description: 'Tag and sell products directly from your videos',
    dimensions:  [
      { metric: 'subscriber_count', label: 'Subscribers', required: 10_000 },
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pct(current, required) {
  if (current == null || required == null) return null;
  return Math.min(100, Math.round((current / required) * 1000) / 10); // 1 d.p.
}

// Returns days to reach `required` from `current` at `velocityPerDay`.
// Null if velocity is null, zero, or negative (going backwards).
function daysToReach(current, required, velocityPerDay) {
  if (current == null || velocityPerDay == null || velocityPerDay <= 0) return null;
  if (current >= required) return 0;
  return Math.ceil((required - current) / velocityPerDay);
}

// ─── Main export ─────────────────────────────────────────────────────────────

async function getGapAnalysis(userId, tenantId) {
  const pool = getPool();

  // Fetch the YouTube platform profile for this creator
  const { rows: profileRows } = await pool.query(
    `SELECT cpp.id, cpp.subscriber_count, cpp.watch_hours_12mo,
            cpp.total_view_count, cpp.last_synced_at, cpp.sync_status
       FROM creator_platform_profiles cpp
       JOIN creators c ON c.id = cpp.creator_id
      WHERE c.user_id   = $1
        AND c.tenant_id = $2
        AND cpp.platform = 'youtube'`,
    [userId, tenantId]
  );

  if (!profileRows[0]) return null; // YouTube not connected

  const profile = profileRows[0];

  // Fetch the two most recent snapshots to calculate velocity
  const { rows: snapshots } = await pool.query(
    `SELECT subscriber_count, watch_hours_12mo, recorded_at
       FROM platform_metrics_snapshots
      WHERE platform_profile_id = $1
      ORDER BY recorded_at DESC
      LIMIT 2`,
    [profile.id]
  );

  // Velocity: change per day between the two most recent snapshots
  let subVelocity       = null;
  let watchHrVelocity   = null;

  if (snapshots.length >= 2) {
    const [newer, older] = snapshots;
    const days = (new Date(newer.recorded_at) - new Date(older.recorded_at)) / 86_400_000;

    if (days > 0) {
      const subDelta  = (newer.subscriber_count ?? 0) - (older.subscriber_count ?? 0);
      const whrDelta  = (Number(newer.watch_hours_12mo) ?? 0) - (Number(older.watch_hours_12mo) ?? 0);

      subVelocity     = subDelta  / days;
      watchHrVelocity = whrDelta  / days;
    }
  }

  const current = {
    subscriber_count: profile.subscriber_count,
    watch_hours_12mo: profile.watch_hours_12mo !== null ? Number(profile.watch_hours_12mo) : null,
  };

  const velocity = {
    subscriber_count: subVelocity,
    watch_hours_12mo: watchHrVelocity,
  };

  // Build threshold results
  const thresholds = YOUTUBE_THRESHOLDS.map(threshold => {
    const dimensions = threshold.dimensions.map(dim => {
      const curr    = current[dim.metric];
      const vel     = velocity[dim.metric];
      const days    = daysToReach(curr, dim.required, vel);
      const reached = curr != null && curr >= dim.required;

      return {
        metric:          dim.metric,
        label:           dim.label,
        current:         curr,
        required:        dim.required,
        gap:             reached ? 0 : curr != null ? dim.required - curr : null,
        pct:             pct(curr, dim.required),
        velocityPerDay:  vel !== null ? Math.round(vel * 100) / 100 : null,
        daysToReach:     days,
        projectedDate:   days != null && days > 0
                           ? new Date(Date.now() + days * 86_400_000).toISOString().split('T')[0]
                           : null,
        reached,
      };
    });

    const met = dimensions.every(d => d.reached);

    // The blocking dimension is the one furthest from being met (lowest pct)
    const blocking = dimensions
      .filter(d => !d.reached)
      .sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0))[0]?.metric ?? null;

    return { ...threshold, dimensions, met, blockingDimension: blocking };
  });

  return {
    platform:      'youtube',
    lastSyncedAt:  profile.last_synced_at,
    syncStatus:    profile.sync_status,
    hasVelocity:   snapshots.length >= 2,
    thresholds,
  };
}

module.exports = { getGapAnalysis };
