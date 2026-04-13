'use strict';

// ─── Gap Tracker service ──────────────────────────────────────────────────────
// Calculates platform monetisation threshold gaps, velocity, and projections.
// NOTE: This is secondary context (platform eligibility) — not the primary
// commercial viability product. See creator_commercial_profiles for the real
// brand deal gap analysis (built once the scoring engine exists).
// ─────────────────────────────────────────────────────────────────────────────

const { getPrisma } = require('../../lib/prisma');

// YouTube monetisation thresholds — these ARE hardcoded because they are
// fixed platform rules published by YouTube, not derived from our data.
// This is the one legitimate exception to the "no hardcoded thresholds" rule.
const YOUTUBE_THRESHOLDS = [
  {
    id:          'ypp',
    name:        'YouTube Partner Program',
    description: 'Unlock ad revenue, channel memberships, and Super Thanks',
    dimensions:  [
      { metric: 'subscriberCount', label: 'Subscribers',             required: 1_000  },
      { metric: 'watchHours12mo',  label: 'Watch Hours (12 months)', required: 4_000  },
    ],
  },
  {
    id:          'youtube_shopping',
    name:        'YouTube Shopping',
    description: 'Tag and sell products directly from your videos',
    dimensions:  [
      { metric: 'subscriberCount', label: 'Subscribers', required: 10_000 },
    ],
  },
];

function pct(current, required) {
  if (current == null) return null;
  return Math.min(100, Math.round((current / required) * 1000) / 10);
}

function daysToReach(current, required, velocityPerDay) {
  if (current == null || velocityPerDay == null || velocityPerDay <= 0) return null;
  if (current >= required) return 0;
  return Math.ceil((required - current) / velocityPerDay);
}

async function getGapAnalysis(userId, tenantId) {
  const prisma = getPrisma();

  const creator = await prisma.creator.findFirst({
    where:  { userId, tenantId },
    select: { id: true },
  });
  if (!creator) return null;

  const profile = await prisma.creatorPlatformProfile.findFirst({
    where:  { creatorId: creator.id, platform: 'youtube' },
    select: {
      id: true, subscriberCount: true, watchHours12mo: true,
      lastSyncedAt: true, syncStatus: true,
    },
  });
  if (!profile) return null;

  // Two most recent snapshots for velocity
  const snapshots = await prisma.platformMetricsSnapshot.findMany({
    where:   { platformProfileId: profile.id },
    orderBy: { recordedAt: 'desc' },
    take:    2,
    select:  { subscriberCount: true, watchHours12mo: true, recordedAt: true },
  });

  let subVelocity = null;
  let whrVelocity = null;

  if (snapshots.length >= 2) {
    const [newer, older] = snapshots;
    const days = (newer.recordedAt - older.recordedAt) / 86_400_000;
    if (days > 0) {
      subVelocity = ((newer.subscriberCount ?? 0) - (older.subscriberCount ?? 0)) / days;
      whrVelocity = (Number(newer.watchHours12mo ?? 0) - Number(older.watchHours12mo ?? 0)) / days;
    }
  }

  const current  = {
    subscriberCount: profile.subscriberCount,
    watchHours12mo:  profile.watchHours12mo !== null ? Number(profile.watchHours12mo) : null,
  };
  const velocity = { subscriberCount: subVelocity, watchHours12mo: whrVelocity };

  const thresholds = YOUTUBE_THRESHOLDS.map(threshold => {
    const dimensions = threshold.dimensions.map(dim => {
      const curr    = current[dim.metric];
      const vel     = velocity[dim.metric];
      const days    = daysToReach(curr, dim.required, vel);
      const reached = curr != null && curr >= dim.required;
      return {
        metric:         dim.metric,
        label:          dim.label,
        current:        curr,
        required:       dim.required,
        gap:            reached ? 0 : curr != null ? dim.required - curr : null,
        pct:            pct(curr, dim.required),
        velocityPerDay: vel !== null ? Math.round(vel * 100) / 100 : null,
        daysToReach:    days,
        projectedDate:  days != null && days > 0
                          ? new Date(Date.now() + days * 86_400_000).toISOString().split('T')[0]
                          : null,
        reached,
      };
    });

    const met      = dimensions.every(d => d.reached);
    const blocking = dimensions
      .filter(d => !d.reached)
      .sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0))[0]?.metric ?? null;

    return { ...threshold, dimensions, met, blockingDimension: blocking };
  });

  return {
    platform:    'youtube',
    lastSyncedAt: profile.lastSyncedAt,
    syncStatus:  profile.syncStatus,
    hasVelocity: snapshots.length >= 2,
    thresholds,
  };
}

module.exports = { getGapAnalysis };
