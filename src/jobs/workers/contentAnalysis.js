'use strict';

// ─── Content analysis worker ──────────────────────────────────────────────────
// Job type: analysis:baseline-run   { platformProfileId }
//
// Flow:
//   1. Resolve creator + decrypt access token (same pattern as platformSync)
//   2. Fetch video signals via youtubeContent.getVideoSignals()
//   3. Build + send the niche-classification-v1 prompt to Claude
//   4. Validate JSON output — retry ONCE on malformed response
//   5. Write ContentAnalysisRun + upsert CreatorNicheProfile
//
// Hard rules from CREATRBASE_INSTRUCTIONS:
//   - Every Claude call must log prompt_version + raw output (Rule #3)
//   - Never expose scores without confidence levels (Rule #4)
//   - Use model claude-sonnet-4-6 (current default)
// ─────────────────────────────────────────────────────────────────────────────

const fs              = require('fs');
const path            = require('path');
const Anthropic       = require('@anthropic-ai/sdk');
const { getPrisma }   = require('../../lib/prisma');
const { decrypt }     = require('../../lib/crypto');
const { getVideoSignals } = require('../../services/youtubeContent');
const { refreshAccessToken } = require('../../services/youtube');
const { encrypt }     = require('../../lib/crypto');
const { getDataCollectionQueue } = require('../queue');

const PROMPT_VERSION  = 'niche-classification-v1';
const PROMPT_TEMPLATE = fs.readFileSync(
  path.join(__dirname, '../../prompts/niche-classification-v1.txt'),
  'utf8'
);
const MODEL           = 'claude-sonnet-4-6';
const MAX_TOKENS      = 1024;

// Expected top-level keys from the output schema
const REQUIRED_KEYS = [
  'primary_niche_category',
  'primary_niche_specific',
  'content_format_primary',
  'classification_confidence',
  'confidence_reasoning',
  'niche_commercial_notes',
  'classification_reasoning',
  'existing_partnerships_likely',
  'affiliate_domains_detected',
  'promo_codes_detected',
  'brand_mentions',
];

function buildPrompt(signals) {
  const videoSignalsJson = JSON.stringify(signals.videoSignals, null, 2);
  const affiliateRaw     = signals.affiliateDomains.join(', ') || 'none detected';
  const promoRaw         = signals.promoCodes.join(', ') || 'none detected';

  return PROMPT_TEMPLATE
    .replace('{{platform}}',             'youtube')
    .replace('{{video_count}}',          String(signals.videoCount))
    .replace('{{sample_days}}',          String(signals.sampleDays))
    .replace('{{video_signals_json}}',   videoSignalsJson)
    .replace('{{channel_description}}',  signals.channelDescription || 'Not provided')
    .replace('{{channel_keywords}}',     signals.channelKeywords    || 'Not provided')
    .replace('{{affiliate_domains_raw}}', affiliateRaw)
    .replace('{{promo_codes_raw}}',       promoRaw);
}

function validateOutput(parsed) {
  if (!parsed || typeof parsed !== 'object') return false;
  return REQUIRED_KEYS.every(k => k in parsed);
}

async function callClaude(prompt) {
  const client = new Anthropic();

  // Split SYSTEM / USER sections on the "USER\n----" divider
  const [systemSection, userSection] = prompt.split(/^USER\n-+$/m);

  const response = await client.messages.create({
    model:      MODEL,
    max_tokens: MAX_TOKENS,
    system:     systemSection.replace(/^SYSTEM\n-+\n/m, '').trim(),
    messages:   [{ role: 'user', content: userSection.trim() }],
  });

  const rawOutput  = response.content[0]?.text ?? '';
  const tokensUsed = (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0);

  return { rawOutput, tokensUsed };
}

// ─── Worker registration ──────────────────────────────────────────────────────

function startContentAnalysisWorker() {
  const queue  = getDataCollectionQueue();
  const prisma = getPrisma();

  queue.process('analysis:baseline-run', async (job) => {
    const { platformProfileId } = job.data;
    if (!platformProfileId) throw new Error('analysis:baseline-run missing platformProfileId');

    job.log(`Starting baseline analysis for profile ${platformProfileId}`);

    // ── 1. Load profile ────────────────────────────────────────────────────────
    const profile = await prisma.creatorPlatformProfile.findUnique({
      where:  { id: platformProfileId },
      select: {
        id: true, tenantId: true, creatorId: true, platform: true,
        accessToken: true, refreshToken: true, tokenExpiresAt: true,
      },
    });

    if (!profile) throw new Error(`Platform profile ${platformProfileId} not found`);
    if (profile.platform !== 'youtube') {
      job.log(`Skipping non-YouTube platform: ${profile.platform}`);
      return;
    }

    // ── 2. Token — refresh if near-expired ────────────────────────────────────
    let accessToken = decrypt(profile.accessToken);
    const bufferMs  = 5 * 60 * 1000;
    const nearExpiry = profile.tokenExpiresAt &&
                       (profile.tokenExpiresAt.getTime() - Date.now() < bufferMs);

    if (nearExpiry) {
      if (!profile.refreshToken) throw new Error('Token expired and no refresh token available');
      const refreshed = await refreshAccessToken(decrypt(profile.refreshToken));

      await prisma.creatorPlatformProfile.update({
        where: { id: platformProfileId },
        data:  {
          accessToken:    encrypt(refreshed.accessToken),
          tokenExpiresAt: refreshed.expiresAt,
        },
      });

      accessToken = refreshed.accessToken;
      job.log(`Token refreshed; new expiry ${refreshed.expiresAt.toISOString()}`);
    }

    // ── 3. Fetch content signals ───────────────────────────────────────────────
    const signals = await getVideoSignals(accessToken);
    job.log(`Fetched ${signals.videoCount} video signals`);

    const prompt = buildPrompt(signals);
    const rawInput = {
      videoCount:        signals.videoCount,
      sampleDays:        signals.sampleDays,
      channelDescription: signals.channelDescription,
      channelKeywords:   signals.channelKeywords,
      affiliateDomains:  signals.affiliateDomains,
      promoCodes:        signals.promoCodes,
      videoSignals:      signals.videoSignals,
    };

    // ── 4. Create run record (pending) ────────────────────────────────────────
    const run = await prisma.contentAnalysisRun.create({
      data: {
        tenantId:         profile.tenantId,
        creatorId:        profile.creatorId,
        platformProfileId,
        promptVersion:    PROMPT_VERSION,
        rawInput,
        status:           'pending',
      },
    });

    // ── 5. Call Claude — one retry on invalid JSON ────────────────────────────
    let rawOutput, tokensUsed, parsed;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        ({ rawOutput, tokensUsed } = await callClaude(prompt));
        job.log(`Claude response (attempt ${attempt}): ${rawOutput.slice(0, 200)}`);

        // Log raw output as required by CREATRBASE_INSTRUCTIONS Rule #3
        console.log(`[contentAnalysis] prompt_version=${PROMPT_VERSION} raw_output=${rawOutput}`);

        parsed = JSON.parse(rawOutput.trim());

        if (!validateOutput(parsed)) {
          throw new Error('Missing required fields in Claude output');
        }

        break; // valid
      } catch (parseErr) {
        if (attempt === 2) {
          // Both attempts failed — mark run as failed and rethrow
          await prisma.contentAnalysisRun.update({
            where: { id: run.id },
            data:  {
              rawOutput:     rawOutput ?? null,
              tokensUsed:    tokensUsed ?? null,
              status:        'failed',
              failureReason: parseErr.message,
            },
          });
          throw parseErr;
        }
        job.log(`Attempt ${attempt} failed (${parseErr.message}) — retrying`);
      }
    }

    // ── 6. Persist results ────────────────────────────────────────────────────
    await prisma.$transaction(async (tx) => {
      await tx.contentAnalysisRun.update({
        where: { id: run.id },
        data:  {
          rawOutput,
          parsedOutput:  parsed,
          tokensUsed,
          status:        'complete',
        },
      });

      // Upsert: one niche profile per creator, always updated from latest run
      await tx.creatorNicheProfile.upsert({
        where:  { creatorId: profile.creatorId },
        update: {
          analysisRunId:             run.id,
          primaryNicheCategory:      parsed.primary_niche_category,
          primaryNicheSpecific:      parsed.primary_niche_specific,
          secondaryNicheSpecific:    parsed.secondary_niche_specific ?? null,
          contentFormatPrimary:      parsed.content_format_primary,
          contentFormatSecondary:    parsed.content_format_secondary ?? null,
          affiliateDomainsDetected:  parsed.affiliate_domains_detected ?? [],
          promoCodesDetected:        parsed.promo_codes_detected ?? [],
          brandMentions:             parsed.brand_mentions ?? [],
          existingPartnershipsLikely: parsed.existing_partnerships_likely,
          classificationConfidence:  parsed.classification_confidence,
          confidenceReasoning:       parsed.confidence_reasoning,
          nicheCommercialNotes:      parsed.niche_commercial_notes,
          classificationReasoning:   parsed.classification_reasoning,
          updatedAt:                 new Date(),
        },
        create: {
          tenantId:                  profile.tenantId,
          creatorId:                 profile.creatorId,
          analysisRunId:             run.id,
          primaryNicheCategory:      parsed.primary_niche_category,
          primaryNicheSpecific:      parsed.primary_niche_specific,
          secondaryNicheSpecific:    parsed.secondary_niche_specific ?? null,
          contentFormatPrimary:      parsed.content_format_primary,
          contentFormatSecondary:    parsed.content_format_secondary ?? null,
          affiliateDomainsDetected:  parsed.affiliate_domains_detected ?? [],
          promoCodesDetected:        parsed.promo_codes_detected ?? [],
          brandMentions:             parsed.brand_mentions ?? [],
          existingPartnershipsLikely: parsed.existing_partnerships_likely,
          classificationConfidence:  parsed.classification_confidence,
          confidenceReasoning:       parsed.confidence_reasoning,
          nicheCommercialNotes:      parsed.niche_commercial_notes,
          classificationReasoning:   parsed.classification_reasoning,
        },
      });
    });

    job.log(`Baseline analysis complete: ${parsed.primary_niche_specific} (${parsed.classification_confidence} confidence)`);
    console.log(`[contentAnalysis] creator=${profile.creatorId} niche=${parsed.primary_niche_specific} confidence=${parsed.classification_confidence}`);
  });

  console.log('[contentAnalysis] worker registered on data-collection queue');
}

module.exports = { startContentAnalysisWorker };
