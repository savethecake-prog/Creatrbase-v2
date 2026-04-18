'use strict';

const fs        = require('fs');
const path      = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { authenticate }  = require('../../middleware/authenticate');
const { requireTier }   = require('../../middleware/requireTier');
const { getBrands, logOutreach, updateOutreachStatus, getOutreachHistory } = require('./brandsService');
const { getPrisma }     = require('../../lib/prisma');
const { getPool }       = require('../../db/pool');

const PITCH_PROMPT    = fs.readFileSync(
  path.join(__dirname, '../../prompts/negotiation-draft-v1.txt'), 'utf8'
);
const MODEL           = 'claude-sonnet-4-6';
const MAX_TOKENS      = 1200;
const PROMPT_VERSION  = 'negotiation-draft-v1';

const VALID_CONTEXTS = [
  'opening_position', 'counter_response', 'scope_management', 'contract_review_response',
];

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

  app.get('/api/brands', { preHandler: [authenticate, requireTier('pro')] }, async (req) => {
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

  app.post('/api/brands/:brandId/outreach', { preHandler: [authenticate, requireTier('pro')] }, async (req, reply) => {
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

  app.post('/api/brands/:brandId/outreach/status', { preHandler: [authenticate, requireTier('pro')] }, async (req, reply) => {
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

  app.get('/api/brands/:brandId/outreach', { preHandler: [authenticate, requireTier('pro')] }, async (req, reply) => {
    const { brandId } = req.params;

    const resolved = await resolveCreator(req.user.userId, req.user.tenantId);
    if (!resolved) return reply.code(404).send({ error: 'Creator profile not found' });

    const history = await getOutreachHistory({ brandId, creatorId: resolved.creatorId });
    return { history };
  });

  // ── POST /api/brands/:brandId/draft-pitch ───────────────────────────────────
  // Generates a negotiation email draft via Claude.
  // Body: { negotiationContext, deliverableType?, deliverableDetails?,
  //         brandOfferAmount?, brandOfferTerms?, contractFlagsJson? }

  app.post('/api/brands/:brandId/draft-pitch', { preHandler: [authenticate, requireTier('pro')] }, async (req, reply) => {
    const { brandId } = req.params;
    const {
      negotiationContext = 'opening_position',
      deliverableType    = 'sponsored integration',
      deliverableDetails = '',
      brandOfferAmount   = null,
      brandOfferTerms    = '',
      contractFlagsJson  = '[]',
    } = req.body ?? {};

    if (!VALID_CONTEXTS.includes(negotiationContext)) {
      return reply.code(400).send({ error: 'Invalid negotiation context.' });
    }

    const prisma = getPrisma();
    const pool   = getPool();

    // ── Resolve creator ────────────────────────────────────────────────────────
    const creator = await prisma.creator.findFirst({
      where:  { userId: req.user.userId, tenantId: req.user.tenantId },
      select: { id: true, displayName: true },
    });
    if (!creator) return reply.code(404).send({ error: 'Creator not found.' });

    // ── Load creator context ───────────────────────────────────────────────────
    const [commercialProfile, nicheProfile, platformProfile] = await Promise.all([
      prisma.creatorCommercialProfile.findUnique({
        where:  { creatorId: creator.id },
        select: {
          commercialTier:          true,
          estimatedRateLow:        true,
          estimatedRateHigh:       true,
          rateCurrency:            true,
          rateConfidence:          true,
          confirmedDealsCount:     true,
        },
      }),
      prisma.creatorNicheProfile.findFirst({
        where:  { creatorId: creator.id, platform: 'youtube' },
        select: { primaryNicheSpecific: true, primaryNicheCategory: true },
      }),
      prisma.creatorPlatformProfile.findFirst({
        where:  { creatorId: creator.id },
        select: { platform: true, subscriberCount: true, primaryAudienceGeo: true },
      }),
    ]);

    // ── Load brand + its tier profiles ─────────────────────────────────────────
    const { rows: brandRows } = await pool.query(
      `SELECT b.brand_name, b.category,
              json_agg(json_build_object(
                'creator_tier',   btp.creator_tier,
                'rate_range_low', btp.rate_range_low,
                'rate_range_high',btp.rate_range_high,
                'rate_currency',  btp.rate_currency
              )) FILTER (WHERE btp.id IS NOT NULL) AS tier_profiles
       FROM brands b
       LEFT JOIN brand_tier_profiles btp ON btp.brand_id = b.id
       WHERE b.id = $1
       GROUP BY b.id, b.brand_name, b.category`,
      [brandId]
    );
    const brand = brandRows[0];
    if (!brand) return reply.code(404).send({ error: 'Brand not found.' });

    // ── Load outreach history for relationship context ─────────────────────────
    const history = await getOutreachHistory({ brandId, creatorId: creator.id });
    const brandRelHistory = history.length > 0
      ? history.map(h => `${h.interaction_date?.slice(0,10)}: ${h.interaction_type.replace(/_/g,' ')}`).join('\n')
      : 'No prior contact with this brand.';

    // ── Find relevant tier profile for rate intelligence ───────────────────────
    const tierProfiles = brand.tier_profiles ?? [];
    const relevantTier = tierProfiles.find(tp =>
      tp.creator_tier === commercialProfile?.commercialTier
    ) ?? tierProfiles[0] ?? null;

    const currency     = relevantTier?.rate_currency ?? commercialProfile?.rateCurrency ?? 'GBP';
    const marketFloor  = relevantTier?.rate_range_low  ?? 'unknown';
    const marketMedian = relevantTier?.rate_range_high ?? 'unknown';

    // ── Build prompt ───────────────────────────────────────────────────────────
    const filled = PITCH_PROMPT
      .replace('{{creator_display_name}}',     creator.displayName)
      .replace('{{platform}}',                 platformProfile?.platform ?? 'youtube')
      .replace('{{subscriber_count}}',         String(platformProfile?.subscriberCount ?? 'unknown'))
      .replace('{{primary_niche_specific}}',   nicheProfile?.primaryNicheSpecific ?? 'unknown')
      .replace('{{primary_audience_geo}}',     platformProfile?.primaryAudienceGeo ?? 'unknown')
      .replace('{{commercial_tier}}',          commercialProfile?.commercialTier ?? 'emerging')
      .replace('{{confirmed_integrations_count}}', String(commercialProfile?.confirmedDealsCount ?? 0))
      .replace('{{negotiation_context}}',      negotiationContext)
      .replace('{{brand_name}}',               brand.brand_name)
      .replace('{{brand_category}}',           brand.category ?? 'unknown')
      .replace('{{deliverable_type}}',         deliverableType)
      .replace('{{deliverable_details}}',      deliverableDetails || 'Not specified')
      .replace('{{brand_offer_amount}}',       brandOfferAmount != null ? String(brandOfferAmount) : 'N/A')
      .replace('{{rate_currency}}',            currency)
      .replace('{{brand_offer_terms}}',        brandOfferTerms || 'N/A')
      .replace('{{contract_flags_json}}',      contractFlagsJson || '[]')
      .replace('{{rate_range_low}}',           String(commercialProfile?.estimatedRateLow ?? 'unknown'))
      .replace('{{rate_range_high}}',          String(commercialProfile?.estimatedRateHigh ?? 'unknown'))
      .replace('{{rate_confidence}}',          commercialProfile?.rateConfidence ?? 'low')
      .replace('{{market_floor}}',             String(marketFloor))
      .replace('{{market_median}}',            String(marketMedian))
      .replace('{{negotiation_delta_summary}}','Typical opening-to-settle compression is 15–25% in this category.')
      .replace('{{brand_relationship_history}}', brandRelHistory)
      .replace('{{creator_knowledge_context}}',  nicheProfile?.primaryNicheCategory ?? 'No additional context.');

    // ── Call Claude ────────────────────────────────────────────────────────────
    const [systemSection, userSection] = filled.split(/^USER\n-+$/m);

    let rawOutput;
    try {
      const response = await new Anthropic().messages.create({
        model:      MODEL,
        max_tokens: MAX_TOKENS,
        system:     systemSection.replace(/^SYSTEM\n-+\n/m, '').trim(),
        messages:   [{ role: 'user', content: userSection.trim() }],
      });
      rawOutput = response.content[0]?.text?.trim() ?? '';
    } catch (err) {
      app.log.error({ err }, 'Draft pitch Claude call failed');
      return reply.code(502).send({ error: 'Draft generation temporarily unavailable. Please try again.' });
    }

    // ── Parse ──────────────────────────────────────────────────────────────────
    // Strip markdown code fences if present (```json ... ``` or ``` ... ```)
    const cleaned = rawOutput.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      app.log.error({ rawOutput }, 'Draft pitch JSON parse failed');
      return reply.code(502).send({ error: 'Draft generation returned an unexpected response. Please try again.' });
    }

    app.log.info({ creatorId: creator.id, brandId, negotiationContext, promptVersion: PROMPT_VERSION }, 'pitch draft generated');

    return {
      subjectLine:         parsed.subject_line,
      emailBody:           parsed.email_body,
      toneNotes:           parsed.tone_notes,
      keyPositions:        parsed.key_positions_taken ?? [],
      suggestedRate:       parsed.suggested_opening_rate ?? parsed.suggested_counter_rate ?? null,
      confidence:          parsed.confidence,
      draftNotes:          parsed.draft_notes,
    };
  });
}

module.exports = brandsRoutes;
