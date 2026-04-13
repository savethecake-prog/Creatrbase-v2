'use strict';

// ─── Recommendation routes ─────────────────────────────────────────────────────
//
//   GET  /api/creator/recommendation
//     Returns the current pending recommendation for the authenticated creator.
//     Falls back to the most recent non-superseded recommendation if no pending one exists.
//
//   POST /api/creator/recommendation/:id/respond
//     Body: { response: 'accepted' | 'deferred' | 'declined', reason?: string }
//     On accept: creates a Task row and links it to the recommendation.
// ─────────────────────────────────────────────────────────────────────────────

const { authenticate } = require('../../middleware/authenticate');
const { getPrisma }    = require('../../lib/prisma');

// Captures the single most trackable metric for a dimension at task creation time.
// Only defined for dimensions with a clean numeric signal — others return null.
function snapshotMetric(dimension, profile, capturedAt) {
  if (!profile) return null;
  switch (dimension) {
    case 'subscriber_momentum':
      if (profile.subscriberCount == null) return null;
      return {
        metric_key:   'subscriber_count',
        metric_label: 'Subscribers',
        value:        profile.subscriberCount,
        unit:         null,
        captured_at:  capturedAt.toISOString(),
      };
    case 'engagement_quality':
      if (profile.engagementRate30d == null) return null;
      return {
        metric_key:   'engagement_rate_30d',
        metric_label: 'Engagement rate',
        value:        Number(profile.engagementRate30d),
        unit:         '%',
        captured_at:  capturedAt.toISOString(),
      };
    case 'content_consistency':
      if (profile.publicUploads90d == null) return null;
      return {
        metric_key:   'uploads_per_week',
        metric_label: 'Weekly uploads',
        value:        Math.round((profile.publicUploads90d / 13) * 10) / 10,
        unit:         '/wk',
        captured_at:  capturedAt.toISOString(),
      };
    default:
      return null;
  }
}

async function recommendationRoutes(app) {

  // ── GET /api/creator/recommendation ─────────────────────────────────────────

  app.get('/api/creator/recommendation', { preHandler: authenticate }, async (req) => {
    const prisma = getPrisma();

    const creator = await prisma.creator.findFirst({
      where:  { userId: req.user.userId, tenantId: req.user.tenantId },
      select: { id: true },
    });
    if (!creator) return { recommendation: null, status: 'no_creator' };

    // Check if an engine run is currently in progress
    const activeRun = await prisma.engineRun.findFirst({
      where:   { creatorId: creator.id, status: 'running' },
      orderBy: { startedAt: 'desc' },
      select:  { id: true, startedAt: true },
    });

    // Return most recent pending recommendation, then most recent non-superseded
    const rec = await prisma.recommendation.findFirst({
      where:   { creatorId: creator.id, status: { not: 'superseded' } },
      orderBy: { generatedAt: 'desc' },
      select:  {
        id:                        true,
        constraintDimension:       true,
        constraintSeverity:        true,
        title:                     true,
        specificAction:            true,
        reasoning:                 true,
        expectedImpactDescription: true,
        expectedImpactConfidence:  true,
        timeHorizon:               true,
        status:                    true,
        generatedAt:               true,
        creatorResponse:           true,
        convertedToTaskId:         true,
      },
    });

    if (!rec) {
      return {
        recommendation: null,
        status: activeRun ? 'generating' : 'no_data',
      };
    }

    return {
      recommendation: {
        id:                          rec.id,
        constraint_dimension:        rec.constraintDimension,
        constraint_severity:         rec.constraintSeverity,
        title:                       rec.title,
        specific_action:             rec.specificAction,
        reasoning:                   rec.reasoning,
        expected_impact_description: rec.expectedImpactDescription,
        expected_impact_confidence:  rec.expectedImpactConfidence,
        time_horizon:                rec.timeHorizon,
        status:                      rec.status,
        generated_at:                rec.generatedAt,
        creator_response:            rec.creatorResponse,
        converted_to_task_id:        rec.convertedToTaskId,
      },
      status: rec.status === 'pending' ? 'pending' : rec.status,
    };
  });

  // ── POST /api/creator/recommendation/:id/respond ─────────────────────────────

  app.post('/api/creator/recommendation/:id/respond', { preHandler: authenticate }, async (req, reply) => {
    const prisma = getPrisma();
    const { id } = req.params;
    const { response, reason } = req.body ?? {};

    if (!['accepted', 'deferred', 'declined'].includes(response)) {
      return reply.code(400).send({ error: 'response must be accepted, deferred, or declined' });
    }

    const creator = await prisma.creator.findFirst({
      where:  { userId: req.user.userId, tenantId: req.user.tenantId },
      select: { id: true, tenantId: true },
    });
    if (!creator) return reply.code(404).send({ error: 'Creator not found' });

    const rec = await prisma.recommendation.findUnique({
      where:  { id },
      select: {
        id:                 true,
        creatorId:          true,
        tenantId:           true,
        title:              true,
        specificAction:     true,
        reasoning:          true,
        expectedImpactDescription: true,
        constraintDimension: true,
        constraintSeverity:  true,
        promptVersion:      true,
        status:             true,
      },
    });

    if (!rec || rec.creatorId !== creator.id) {
      return reply.code(404).send({ error: 'Recommendation not found' });
    }

    if (rec.status !== 'pending') {
      return reply.code(409).send({ error: `Recommendation is already ${rec.status}` });
    }

    const now = new Date();

    if (response === 'accepted') {
      // Snapshot the relevant metric for this dimension so the task card
      // can show "4,200 subscribers when assigned → 4,850 now"
      const profile = await prisma.creatorPlatformProfile.findFirst({
        where:  { creatorId: creator.id, platform: 'youtube' },
        select: { subscriberCount: true, engagementRate30d: true, publicUploads90d: true },
      });

      const metricBaseline = snapshotMetric(rec.constraintDimension, profile, now);

      // Create a Task from this recommendation
      await prisma.$transaction(async (tx) => {
        const task = await tx.task.create({
          data: {
            tenantId:                creator.tenantId,
            creatorId:               creator.id,
            taskMode:                'gap_closure',
            dimension:               rec.constraintDimension,
            dimensionStateAtCreation: rec.constraintSeverity === 'critical' ? 'constraining' : 'constraining',
            triggeredBy:             'system_gap_analysis',
            triggerConfidence:       rec.constraintSeverity === 'critical' ? 'high' : 'medium',
            title:                   rec.title,
            description:             rec.specificAction,
            reasoningSummary:        rec.reasoning,
            expectedImpact:          rec.expectedImpactDescription,
            priority:                rec.constraintSeverity === 'critical' ? 'high' : 'medium',
            status:                  'active',
            generatedBy:             'recommendation_engine',
            promptVersion:           rec.promptVersion,
            metricBaseline:          metricBaseline ?? undefined,
          },
        });

        await tx.recommendation.update({
          where: { id },
          data:  {
            status:               'converted_to_task',
            convertedToTaskId:    task.id,
            creatorResponse:      'accepted',
            creatorResponseReason: reason ?? null,
            creatorResponseAt:    now,
          },
        });
      });

      return { ok: true, status: 'converted_to_task' };
    }

    // deferred or declined
    const newStatus = response === 'deferred' ? 'deferred' : 'declined';

    await prisma.recommendation.update({
      where: { id },
      data:  {
        status:               newStatus,
        creatorResponse:      response,
        creatorResponseReason: reason ?? null,
        creatorResponseAt:    now,
      },
    });

    return { ok: true, status: newStatus };
  });
}

module.exports = recommendationRoutes;
