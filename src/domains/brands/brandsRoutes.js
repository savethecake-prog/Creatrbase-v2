'use strict';

const { authenticate }  = require('../../middleware/authenticate');
const { getBrands, logOutreach, updateOutreachStatus, getOutreachHistory } = require('./brandsService');
const { getPrisma }     = require('../../lib/prisma');

// Resolve creator record (id + niche) from JWT claims — shared by multiple routes
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

  return {
    creatorId: creator.id,
    niche:     nicheProfile?.primaryNicheSpecific ?? null,
  };
}

async function brandsRoutes(app) {

  // ── GET /api/brands ─────────────────────────────────────────────────────────
  // Returns brand registry with niche-matched tier profiles and outreach status.
  // Query params: category (optional)

  app.get('/api/brands', { preHandler: authenticate }, async (req) => {
    const { category = null } = req.query;
    let creatorId = null;
    let niche     = null;

    try {
      const resolved = await resolveCreator(req.user.userId, req.user.tenantId);
      if (resolved) {
        creatorId = resolved.creatorId;
        niche     = resolved.niche;
      }
    } catch {
      // Non-fatal — unfiltered brands
    }

    const brands = await getBrands({ niche, category, creatorId });
    return { brands, niche };
  });

  // ── POST /api/brands/:brandId/outreach ──────────────────────────────────────
  // Logs that the creator sent outreach to a brand.
  // Body: { notes? }

  app.post('/api/brands/:brandId/outreach', { preHandler: authenticate }, async (req, reply) => {
    const { brandId } = req.params;
    const { notes = null } = req.body ?? {};

    const resolved = await resolveCreator(req.user.userId, req.user.tenantId);
    if (!resolved) return reply.code(404).send({ error: 'Creator profile not found' });

    await logOutreach({
      brandId,
      creatorId: resolved.creatorId,
      tenantId:  req.user.tenantId,
      niche:     resolved.niche,
      notes,
      userId:    req.user.userId,
    });

    return { ok: true };
  });

  // ── POST /api/brands/:brandId/outreach/status ───────────────────────────────
  // Logs a follow-on status update (responded, declined, deal started).
  // Body: { interactionType, notes? }

  app.post('/api/brands/:brandId/outreach/status', { preHandler: authenticate }, async (req, reply) => {
    const { brandId } = req.params;
    const { interactionType, notes = null } = req.body ?? {};

    const VALID_TYPES = [
      'outreach_responded', 'outreach_declined',
      'deal_negotiating',   'deal_completed', 'relationship_ongoing',
    ];
    if (!VALID_TYPES.includes(interactionType)) {
      return reply.code(400).send({ error: 'Invalid interaction type' });
    }

    const resolved = await resolveCreator(req.user.userId, req.user.tenantId);
    if (!resolved) return reply.code(404).send({ error: 'Creator profile not found' });

    await updateOutreachStatus({
      brandId,
      creatorId:       resolved.creatorId,
      tenantId:        req.user.tenantId,
      interactionType,
      niche:           resolved.niche,
      notes,
      userId:          req.user.userId,
    });

    return { ok: true };
  });

  // ── GET /api/brands/:brandId/outreach ───────────────────────────────────────
  // Full outreach history for this creator + brand.

  app.get('/api/brands/:brandId/outreach', { preHandler: authenticate }, async (req, reply) => {
    const { brandId } = req.params;

    const resolved = await resolveCreator(req.user.userId, req.user.tenantId);
    if (!resolved) return reply.code(404).send({ error: 'Creator profile not found' });

    const history = await getOutreachHistory({ brandId, creatorId: resolved.creatorId });
    return { history };
  });
}

module.exports = brandsRoutes;
