'use strict';

const { authenticate }  = require('../../middleware/authenticate');
const { getBrands }     = require('./brandsService');
const { getPrisma }     = require('../../lib/prisma');

async function brandsRoutes(app) {
  // GET /api/brands
  // Returns brand registry entries, matched to the creator's niche where possible.
  // Query params:
  //   category  — filter by brand category slug (optional)
  app.get('/api/brands', { preHandler: authenticate }, async (req) => {
    const { category = null } = req.query;
    const prisma = getPrisma();

    // Try to get creator's niche for contextual matching
    let niche = null;
    try {
      const creator = await prisma.creator.findFirst({
        where:  { userId: req.user.userId, tenantId: req.user.tenantId },
        select: { id: true },
      });
      if (creator) {
        const nicheProfile = await prisma.creatorNicheProfile.findFirst({
          where:  { creatorId: creator.id, platform: 'youtube' },
          select: { primaryNicheSpecific: true },
        });
        niche = nicheProfile?.primaryNicheSpecific ?? null;
      }
    } catch {
      // Non-fatal — fall back to unfiltered brands
    }

    const brands = await getBrands({ niche, category });
    return { brands, niche };
  });
}

module.exports = brandsRoutes;
