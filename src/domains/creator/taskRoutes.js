'use strict';

// ─── Task routes ──────────────────────────────────────────────────────────────
//
//   GET  /api/creator/tasks
//     Returns active tasks + recently completed tasks (last 30 days).
//
//   PATCH /api/creator/tasks/:id
//     Body: { action: 'complete' | 'dismiss', feedback?: string, note?: string }
//     Marks a task complete or dismissed.
// ─────────────────────────────────────────────────────────────────────────────

const { authenticate } = require('../../middleware/authenticate');
const { getPrisma }    = require('../../lib/prisma');

const TASK_SELECT = {
  id:               true,
  taskMode:         true,
  dimension:        true,
  title:            true,
  description:      true,
  reasoningSummary: true,
  expectedImpact:   true,
  priority:         true,
  status:           true,
  metricBaseline:   true,
  completedAt:      true,
  dismissedAt:      true,
  createdAt:        true,
};

function formatTask(t) {
  return {
    id:               t.id,
    task_mode:        t.taskMode,
    dimension:        t.dimension,
    title:            t.title,
    description:      t.description,
    reasoning_summary: t.reasoningSummary,
    expected_impact:  t.expectedImpact,
    priority:         t.priority,
    status:           t.status,
    metric_baseline:  t.metricBaseline,
    completed_at:     t.completedAt,
    dismissed_at:     t.dismissedAt,
    created_at:       t.createdAt,
  };
}

async function taskRoutes(app) {

  // ── GET /api/creator/tasks ────────────────────────────────────────────────────

  app.get('/api/creator/tasks', { preHandler: authenticate }, async (req) => {
    const prisma = getPrisma();

    const creator = await prisma.creator.findFirst({
      where:  { userId: req.user.userId, tenantId: req.user.tenantId },
      select: { id: true },
    });
    if (!creator) return { tasks: [], status: 'no_creator' };

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);

    const tasks = await prisma.task.findMany({
      where: {
        creatorId: creator.id,
        OR: [
          { status: { in: ['active', 'snoozed'] } },
          { status: { in: ['completed', 'dismissed'] }, completedAt: { gte: thirtyDaysAgo } },
          { status: { in: ['completed', 'dismissed'] }, dismissedAt: { gte: thirtyDaysAgo } },
        ],
      },
      select:  TASK_SELECT,
      orderBy: [
        { status: 'asc' },   // active before completed
        { createdAt: 'desc' },
      ],
    });

    // Fetch current platform metrics so the card can show baseline → now delta
    const profile = await prisma.creatorPlatformProfile.findFirst({
      where:  { creatorId: creator.id, platform: 'youtube' },
      select: {
        subscriberCount:   true,
        engagementRate30d: true,
        publicUploads90d:  true,
      },
    });

    const currentMetrics = profile ? {
      subscriber_count:    profile.subscriberCount,
      engagement_rate_30d: profile.engagementRate30d != null ? Number(profile.engagementRate30d) : null,
      uploads_per_week:    profile.publicUploads90d  != null
        ? Math.round((profile.publicUploads90d / 13) * 10) / 10 : null,
    } : {};

    return {
      tasks:          tasks.map(formatTask),
      current_metrics: currentMetrics,
      status:         'ok',
    };
  });

  // ── PATCH /api/creator/tasks/:id ─────────────────────────────────────────────

  app.patch('/api/creator/tasks/:id', { preHandler: authenticate }, async (req, reply) => {
    const prisma = getPrisma();
    const { id } = req.params;
    const { action, feedback, note } = req.body ?? {};

    if (!['complete', 'dismiss'].includes(action)) {
      return reply.code(400).send({ error: 'action must be complete or dismiss' });
    }

    const validFeedback = ['helpful', 'not_relevant', 'already_doing', 'not_possible'];
    if (feedback && !validFeedback.includes(feedback)) {
      return reply.code(400).send({ error: `feedback must be one of: ${validFeedback.join(', ')}` });
    }

    const creator = await prisma.creator.findFirst({
      where:  { userId: req.user.userId, tenantId: req.user.tenantId },
      select: { id: true },
    });
    if (!creator) return reply.code(404).send({ error: 'Creator not found' });

    const task = await prisma.task.findUnique({
      where:  { id },
      select: { id: true, creatorId: true, status: true },
    });

    if (!task || task.creatorId !== creator.id) {
      return reply.code(404).send({ error: 'Task not found' });
    }

    if (!['active', 'snoozed'].includes(task.status)) {
      return reply.code(409).send({ error: `Task is already ${task.status}` });
    }

    const now = new Date();

    if (action === 'complete') {
      await prisma.task.update({
        where: { id },
        data:  {
          status:          'completed',
          completedAt:     now,
          creatorFeedback: feedback ?? null,
          creatorNotes:    note ?? null,
        },
      });
      return { ok: true, status: 'completed' };
    }

    // dismiss
    await prisma.task.update({
      where: { id },
      data:  {
        status:          'dismissed',
        dismissedAt:     now,
        creatorFeedback: feedback ?? null,
        creatorNotes:    note ?? null,
      },
    });
    return { ok: true, status: 'dismissed' };
  });
}

module.exports = taskRoutes;
