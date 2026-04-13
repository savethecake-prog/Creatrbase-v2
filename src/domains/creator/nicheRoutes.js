'use strict';

const { authenticate } = require('../../middleware/authenticate');
const { getPrisma }    = require('../../lib/prisma');
const { getDataCollectionQueue } = require('../../jobs/queue');

async function nicheRoutes(app) {
  // GET /api/creator/niche
  // Returns the creator's current niche profile, or triggers a baseline run
  // if none exists and a YouTube profile is connected.
  app.get('/api/creator/niche', { preHandler: authenticate }, async (req) => {
    const prisma = getPrisma();

    const creator = await prisma.creator.findFirst({
      where:  { userId: req.user.userId, tenantId: req.user.tenantId },
      select: { id: true },
    });
    if (!creator) return { niche: null, status: 'no_creator' };

    const profile = await prisma.creatorNicheProfile.findFirst({
      where:  { creatorId: creator.id, platform: 'youtube' },
      select: {
        primaryNicheCategory:    true,
        primaryNicheSpecific:    true,
        secondaryNicheSpecific:  true,
        contentFormatPrimary:    true,
        contentFormatSecondary:  true,
        affiliateDomainsDetected: true,
        promoCodesDetected:      true,
        brandMentions:           true,
        existingPartnerships:    true,
        classificationConfidence: true,
        confidenceReasoning:     true,
        nicheCommercialNotes:    true,
        classificationReasoning: true,
        updatedAt:               true,
      },
    });

    if (profile) {
      return {
        niche: {
          primary_niche_category:       profile.primaryNicheCategory,
          primary_niche_specific:       profile.primaryNicheSpecific,
          secondary_niche_specific:     profile.secondaryNicheSpecific,
          content_format_primary:       profile.contentFormatPrimary,
          content_format_secondary:     profile.contentFormatSecondary,
          affiliate_domains_detected:   profile.affiliateDomainsDetected,
          promo_codes_detected:         profile.promoCodesDetected,
          brand_mentions:               profile.brandMentions,
          existing_partnerships_likely: profile.existingPartnerships,
          classification_confidence:    profile.classificationConfidence,
          confidence_reasoning:         profile.confidenceReasoning,
          niche_commercial_notes:       profile.nicheCommercialNotes,
          classification_reasoning:     profile.classificationReasoning,
          updated_at:                   profile.updatedAt,
        },
        status: 'ready',
      };
    }

    // No niche profile — check for a running analysis
    const runningRun = await prisma.contentAnalysisRun.findFirst({
      where:  { creatorId: creator.id, runStatus: { in: ['queued', 'running'] } },
      select: { id: true },
    });

    if (runningRun) {
      return { niche: null, status: 'analysing' };
    }

    // Queue a fresh baseline run if a YouTube profile exists
    const ytProfile = await prisma.creatorPlatformProfile.findFirst({
      where:  { creatorId: creator.id, platform: 'youtube' },
      select: { id: true },
    });

    if (ytProfile) {
      await getDataCollectionQueue().add('analysis:baseline-run', {
        platformProfileId: ytProfile.id,
      });
      return { niche: null, status: 'analysing' };
    }

    return { niche: null, status: 'no_youtube' };
  });
}

module.exports = nicheRoutes;
