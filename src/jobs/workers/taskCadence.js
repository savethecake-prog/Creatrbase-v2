'use strict';

// ─── Task cadence worker ──────────────────────────────────────────────────────
// Job type: task:generate-due  {}
//
// Runs daily at 06:00 UTC.
// 1. Finds all active task_templates where next_generation_at <= NOW()
// 2. For each, creates a fresh Task row using predefined maintenance content
// 3. Updates last_generated_at + next_generation_at on the template
//
// Job type: task:seed-templates  { creatorId }
// Called once after a creator's first successful platform sync.
// Creates the default maintenance template set for that creator.
// ─────────────────────────────────────────────────────────────────────────────

const { getPrisma }              = require('../../lib/prisma');
const { getDataCollectionQueue } = require('../queue');
const { decrypt }                = require('../../lib/crypto');
const { getRecentVideoDetails }  = require('../../services/youtube');

// ─── Maintenance task content map ────────────────────────────────────────────
// Keyed by dimension. Used when generating tasks from maintenance templates.

const MAINTENANCE_TASKS = {
  content_consistency: {
    title:            'Stick to your upload schedule this week',
    description:      'Posting consistently is one of the strongest signals for channel growth and brand viability. Brands look at upload cadence before reaching out — a missed week shows up in your data. Hit your target upload day this week, even if the video is shorter than usual.',
    reasoning_summary: 'Consistent posting cadence directly improves your content_consistency score, which affects brand eligibility thresholds.',
    expected_impact:  'Maintaining weekly uploads over 4 weeks improves your consistency score and keeps your channel eligible for outreach.',
    priority:         'high',
  },
  engagement_quality: {
    title:            'Spend 20 minutes replying to comments',
    description:      'Engagement rate (likes + comments relative to views) is one of the first numbers brands check. Replying to comments lifts your comment volume and signals an active, connected audience. Focus on your most recent upload.',
    reasoning_summary: 'Engagement rate is a core brand metric. Active comment replies increase it and improve your engagement_quality score.',
    expected_impact:  'Regular engagement activity improves comment velocity, which lifts your engagement rate over the next 30-day window.',
    priority:         'medium',
  },
  subscriber_momentum: {
    title:            'Review what drove growth in the last two weeks',
    description:      'Open YouTube Studio and check which videos gained the most subscribers in the last 14 days. Look at click-through rate, average view duration, and traffic sources. Repeat the format or topic that performed best in your next upload.',
    reasoning_summary: 'Understanding your subscriber drivers lets you double down on what works, compounding growth over time.',
    expected_impact:  'Intentionally repeating high-performing formats typically sustains or accelerates subscriber growth momentum.',
    priority:         'medium',
  },
  niche_commercial_value: {
    title:            'Do a quick brand alignment audit',
    description:      'Watch or skim your last 3 videos. Are you naturally mentioning products, tools, or topics that align with brands in your niche? If not, look for one natural integration point in your next video — a product you genuinely use. Authenticity matters more than frequency.',
    reasoning_summary: 'Niche commercial value improves when your content visibly aligns with brand categories. Organic brand mentions are tracked as a positive signal.',
    expected_impact:  'Building consistent commercial alignment in your content improves brand-fit scores and makes outreach more compelling.',
    priority:         'low',
  },
  audience_geo_alignment: {
    title:            'Check where your audience is watching from',
    description:      'In YouTube Studio, go to Analytics → Audience → Geography. If your top audience is outside the UK or US, consider whether your content topic or thumbnails could be appealing to those markets — or if a small tweak could attract more viewers from higher-CPM regions. This is a long-term signal, not an overnight fix.',
    reasoning_summary: 'UK and US audiences command higher brand CPMs. Understanding your geo split helps set realistic rate expectations.',
    expected_impact:  'Awareness of your geo breakdown helps calibrate your brand outreach strategy and rate negotiations.',
    priority:         'low',
  },
  content_brand_alignment: {
    title:            'Plan one piece of content with a brand angle this month',
    description:      'Think about one video you could make in the next 30 days that naturally showcases a product category relevant to your niche — a setup tour, a review, a "what I use" video. You don\'t need a deal to make brand-aligned content. Building that track record makes future outreach much easier.',
    reasoning_summary: 'Creators with at least one confirmed integration score significantly higher on content_brand_alignment.',
    expected_impact:  'Publishing one genuinely brand-aligned video builds your commercial portfolio and improves brand fit scores.',
    priority:         'medium',
  },
};

// ─── Cadence helpers ──────────────────────────────────────────────────────────

function nextGenerationDate(cadence) {
  const now = new Date();
  if (cadence === 'weekly')      return new Date(now.getTime() + 7  * 86_400_000);
  if (cadence === 'fortnightly') return new Date(now.getTime() + 14 * 86_400_000);
  if (cadence === 'monthly')     return new Date(now.getTime() + 30 * 86_400_000);
  return new Date(now.getTime() + 7 * 86_400_000);
}

function dueDateFromCadence(cadence) {
  const now = new Date();
  if (cadence === 'weekly')      return new Date(now.getTime() + 7  * 86_400_000);
  if (cadence === 'fortnightly') return new Date(now.getTime() + 14 * 86_400_000);
  if (cadence === 'monthly')     return new Date(now.getTime() + 28 * 86_400_000);
  return new Date(now.getTime() + 7 * 86_400_000);
}

// ─── Default templates for a new creator ─────────────────────────────────────

const DEFAULT_TEMPLATES = [
  { dimension: 'content_consistency',   cadence: 'weekly',      templateType: 'maintenance' },
  { dimension: 'engagement_quality',    cadence: 'weekly',      templateType: 'maintenance' },
  { dimension: 'subscriber_momentum',   cadence: 'fortnightly', templateType: 'maintenance' },
  { dimension: 'niche_commercial_value', cadence: 'monthly',    templateType: 'maintenance' },
  { dimension: 'content_brand_alignment', cadence: 'monthly',   templateType: 'maintenance' },
];

// ─── Worker registration ──────────────────────────────────────────────────────

function startTaskCadenceWorker() {
  const queue  = getDataCollectionQueue();
  const prisma = getPrisma();

  // ── task:generate-due ─────────────────────────────────────────────────────

  queue.process('task:generate-due', async (job) => {
    const now = new Date();

    const dueTemplates = await prisma.taskTemplate.findMany({
      where: {
        isActive:          true,
        nextGenerationAt:  { lte: now },
      },
      select: {
        id:        true,
        tenantId:  true,
        creatorId: true,
        dimension: true,
        cadence:   true,
      },
    });

    if (dueTemplates.length === 0) {
      job.log('No templates due for generation');
      return;
    }

    job.log(`Generating tasks for ${dueTemplates.length} due template(s)`);

    for (const tmpl of dueTemplates) {
      try {
        const content = MAINTENANCE_TASKS[tmpl.dimension];
        if (!content) {
          job.log(`No content map for dimension "${tmpl.dimension}" — skipping template ${tmpl.id}`);
          continue;
        }

        // Check if an active task from this template already exists (no duplicates)
        const existing = await prisma.task.findFirst({
          where: {
            templateId: tmpl.id,
            status:     { in: ['active', 'snoozed'] },
          },
          select: { id: true },
        });

        if (existing) {
          job.log(`Active task already exists for template ${tmpl.id} — skipping`);
          continue;
        }

        await prisma.$transaction(async (tx) => {
          await tx.task.create({
            data: {
              tenantId:             tmpl.tenantId,
              creatorId:            tmpl.creatorId,
              templateId:           tmpl.id,
              taskMode:             'maintenance',
              dimension:            tmpl.dimension,
              triggeredBy:          'system_maintenance_cadence',
              triggerSignalType:    'scheduled_cadence',
              triggerConfidence:    'high',
              title:                content.title,
              description:          content.description,
              reasoningSummary:     content.reasoning_summary,
              expectedImpact:       content.expected_impact,
              relatedBrandIds:      [],
              priority:             content.priority,
              dueDate:              dueDateFromCadence(tmpl.cadence),
              status:               'active',
              generatedBy:          'task_cadence_worker',
              promptVersion:        'maintenance-v1',
            },
          });

          await tx.taskTemplate.update({
            where: { id: tmpl.id },
            data:  {
              lastGeneratedAt:  now,
              nextGenerationAt: nextGenerationDate(tmpl.cadence),
            },
          });
        });

        job.log(`Generated maintenance task for creator ${tmpl.creatorId} / dimension ${tmpl.dimension}`);
        console.log(`[taskCadence] task created: creator=${tmpl.creatorId} dimension=${tmpl.dimension}`);

      } catch (err) {
        job.log(`Error generating task for template ${tmpl.id}: ${err.message}`);
        console.error(`[taskCadence] template error: ${err.message}`);
      }
    }
  });

  // ── task:seed-templates ───────────────────────────────────────────────────

  queue.process('task:seed-templates', async (job) => {
    const { creatorId } = job.data;
    if (!creatorId) throw new Error('task:seed-templates missing creatorId');

    const creator = await prisma.creator.findUnique({
      where:  { id: creatorId },
      select: { id: true, tenantId: true },
    });
    if (!creator) {
      job.log(`Creator ${creatorId} not found — skipping seed`);
      return;
    }

    // Only seed if no templates exist yet
    const existing = await prisma.taskTemplate.count({ where: { creatorId } });
    if (existing > 0) {
      job.log(`Creator ${creatorId} already has ${existing} template(s) — skipping seed`);
      return;
    }

    const now = new Date();

    await prisma.taskTemplate.createMany({
      data: DEFAULT_TEMPLATES.map(t => ({
        tenantId:        creator.tenantId,
        creatorId:       creator.id,
        dimension:       t.dimension,
        templateType:    t.templateType,
        cadence:         t.cadence,
        isActive:        true,
        // Set next generation to now so the daily worker picks them up immediately
        nextGenerationAt: now,
        lastGeneratedAt:  null,
      })),
    });

    job.log(`Seeded ${DEFAULT_TEMPLATES.length} default maintenance templates for creator ${creatorId}`);
    console.log(`[taskCadence] seeded templates for creator=${creatorId}`);

    // Immediately trigger generation for this creator
    await queue.add('task:generate-due', {});
  });

  // ── content:detect-uploads ───────────────────────────────────────────────
  // Runs after every YouTube sync.
  // Fetches recent uploads and auto-completes any active content_consistency
  // task where a video was published after the task was created.

  queue.process('content:detect-uploads', async (job) => {
    const { creatorId } = job.data;
    if (!creatorId) throw new Error('content:detect-uploads missing creatorId');

    // Get YouTube profile with token + uploads playlist
    const profile = await prisma.creatorPlatformProfile.findFirst({
      where:  { creatorId, platform: 'youtube', syncStatus: { not: 'disconnected' } },
      select: { accessToken: true, uploadsPlaylistId: true },
    });

    if (!profile?.uploadsPlaylistId) {
      job.log('No YouTube profile or uploads playlist — skipping upload detection');
      return;
    }

    const accessToken = decrypt(profile.accessToken);

    // Fetch recent videos (last 20 is enough for weekly cadence)
    const videos = await getRecentVideoDetails(accessToken, {
      uploadsPlaylistId: profile.uploadsPlaylistId,
      maxVideos: 20,
    });

    if (videos.length === 0) {
      job.log('No recent videos found');
      return;
    }

    // Find active content_consistency tasks for this creator
    const activeTasks = await prisma.task.findMany({
      where: {
        creatorId,
        dimension: 'content_consistency',
        status:    { in: ['active', 'snoozed'] },
      },
      select: { id: true, createdAt: true, title: true },
    });

    if (activeTasks.length === 0) {
      job.log('No active content_consistency tasks — nothing to auto-complete');
      return;
    }

    let completed = 0;

    for (const task of activeTasks) {
      // Find a video published after this task was created
      const qualifyingVideo = videos.find(
        v => v.publishedAt && v.publishedAt > task.createdAt
      );

      if (!qualifyingVideo) continue;

      await prisma.task.update({
        where: { id: task.id },
        data:  {
          status:       'completed',
          completedAt:  new Date(),
          creatorNotes: `Auto-completed: "${qualifyingVideo.title}" was published on ${qualifyingVideo.publishedAt.toDateString()}.`,
        },
      });

      completed++;
      job.log(`Auto-completed task ${task.id} — video "${qualifyingVideo.title}" published after task creation`);
      console.log(`[uploadDetection] auto-completed content_consistency task for creator=${creatorId}`);
    }

    if (completed === 0) {
      job.log(`${videos.length} video(s) checked — none published after task creation`);
    } else {
      job.log(`Auto-completed ${completed} content_consistency task(s)`);
    }
  });

  // Register daily job at 06:00 UTC
  queue.add('task:generate-due', {}, {
    repeat:           { cron: '0 6 * * *' },
    removeOnComplete: 5,
    removeOnFail:     10,
  });

  console.log('[taskCadence] worker registered — daily task generation at 06:00 UTC');
}

module.exports = { startTaskCadenceWorker };
