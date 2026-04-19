'use strict';

const { authenticate } = require('../../middleware/authenticate');
const { requireTier }  = require('../../middleware/requireTier');
const { getPrisma }    = require('../../lib/prisma');
const { getPipeline, getDealHistory, logDealUpdate } = require('./negotiationsService');

async function resolveCreator(userId, tenantId) {
  const prisma = getPrisma();
  const creator = await prisma.creator.findFirst({
    where:  { userId, tenantId },
    select: { id: true },
  });
  if (!creator) return null;
  const nicheProfile = await prisma.creatorNicheProfile.findFirst({
    where:  { creatorId: creator.id, platform: 'youtube' },
    select: { primaryNicheSpecific: true },
  });
  return { creatorId: creator.id, niche: nicheProfile?.primaryNicheSpecific ?? null };
}

async function negotiationsRoutes(app) {

  // ── GET /api/negotiations ───────────────────────────────────────────────────
  // Returns the creator's full deal pipeline — one entry per brand, latest stage.

  app.get('/api/negotiations', { preHandler: [authenticate, requireTier('pro')] }, async (req, reply) => {
    const resolved = await resolveCreator(req.user.userId, req.user.tenantId);
    if (!resolved) return reply.code(404).send({ error: 'Creator profile not found' });
    const deals = await getPipeline({ creatorId: resolved.creatorId });
    return { deals };
  });

  // ── GET /api/negotiations/:brandId/history ──────────────────────────────────
  // Full interaction history for one brand deal.

  app.get('/api/negotiations/:brandId/history', { preHandler: [authenticate, requireTier('pro')] }, async (req, reply) => {
    const { brandId } = req.params;
    const resolved = await resolveCreator(req.user.userId, req.user.tenantId);
    if (!resolved) return reply.code(404).send({ error: 'Creator profile not found' });
    const history = await getDealHistory({ brandId, creatorId: resolved.creatorId });
    return { history };
  });

  // ── POST /api/negotiations/:brandId/update ──────────────────────────────────
  // Logs a stage change or rate update for a deal.
  // Body: { interactionType, agreedRate?, offeredRate?, rateCurrency?, deliverableType?, notes? }

  app.post('/api/negotiations/:brandId/update', { preHandler: [authenticate, requireTier('pro')] }, async (req, reply) => {
    const { brandId } = req.params;
    const {
      interactionType,
      agreedRate,
      offeredRate,
      rateCurrency,
      deliverableType,
      notes,
    } = req.body ?? {};

    const VALID_TYPES = [
      'outreach_sent', 'outreach_responded', 'outreach_declined',
      'deal_negotiating', 'deal_contracting', 'deal_completed',
      'deal_declined', 'stale', 'relationship_ongoing',
    ];
    if (!VALID_TYPES.includes(interactionType)) {
      return reply.code(400).send({ error: 'Invalid interaction type' });
    }

    const resolved = await resolveCreator(req.user.userId, req.user.tenantId);
    if (!resolved) return reply.code(404).send({ error: 'Creator profile not found' });

    // Rates come in as pounds/dollars from the client — store as pence/cents
    const toMinorUnit = v => (v != null && !isNaN(Number(v))) ? Math.round(Number(v) * 100) : null;

    await logDealUpdate({
      brandId,
      creatorId:       resolved.creatorId,
      tenantId:        req.user.tenantId,
      niche:           resolved.niche,
      userId:          req.user.userId,
      interactionType,
      agreedRate:      toMinorUnit(agreedRate),
      offeredRate:     toMinorUnit(offeredRate),
      rateCurrency:    rateCurrency ?? null,
      deliverableType: deliverableType ?? null,
      notes:           notes ?? null,
    });

    return { ok: true };
  });
}

module.exports = negotiationsRoutes;
