'use strict';

// ─── Content analysis worker ──────────────────────────────────────────────────
// Job type: analysis:baseline-run   { platformProfileId }
//
// Flow:
//   1. Resolve creator + decrypt access token
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
const { decrypt, encrypt } = require('../../lib/crypto');
const { getVideoSignals }  = require('../../services/youtubeContent');
const { refreshAccessToken } = require('../../services/youtube');
const { refreshTikTokToken,
        getTikTokVideoList }           = require('../../services/tiktok');
const { extractVideoSignals: extractTikTokVideoSignals } = require('../../services/tiktokContent');
const { getDataCollectionQueue } = require('../queue');

const PROMPT_VERSION  = 'niche-classification-v1';
const PROMPT_TEMPLATE = fs.readFileSync(
  path.join(__dirname, '../../prompts/niche-classification-v1.txt'),
  'utf8'
);

const TIKTOK_PROMPT_VERSION  = 'niche-classification-tiktok-v1';
const TIKTOK_PROMPT_TEMPLATE = fs.readFileSync(
  path.join(__dirname, '../../prompts/niche-classification-tiktok-v1.txt'),
  'utf8'
);
const MODEL      = 'claude-sonnet-4-6';
const MAX_TOKENS = 1024;

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
  return PROMPT_TEMPLATE
    .replace('{{platform}}',              'youtube')
    .replace('{{video_count}}',           String(signals.videoCount))
    .replace('{{sample_days}}',           String(signals.sampleDays))
    .replace('{{video_signals_json}}',    JSON.stringify(signals.videoSignals, null, 2))
    .replace('{{channel_description}}',   signals.channelDescription || 'Not provided')
    .replace('{{channel_keywords}}',      signals.channelKeywords    || 'Not provided')
    .replace('{{affiliate_domains_raw}}', signals.affiliateDomains.join(', ') || 'none detected')
    .replace('{{promo_codes_raw}}',       signals.promoCodes.join(', ')       || 'none detected');
}

function buildTikTokPrompt(signals) {
  return TIKTOK_PROMPT_TEMPLATE
    .replace('{{platform}}',              'tiktok')
    .replace('{{video_count}}',           String(signals.videoCount))
    .replace('{{sample_days}}',           String(signals.sampleDays))
    .replace('{{video_signals_json}}',    JSON.stringify(signals.videoSignals, null, 2))
    .replace('{{channel_description}}',   signals.channelDescription || 'Not provided')
    .replace('{{affiliate_domains_raw}}', signals.affiliateDomains.join(', ') || 'none detected')
    .replace('{{promo_codes_raw}}',       signals.promoCodes.join(', ')       || 'none detected');
}

function validateOutput(parsed) {
  if (!parsed || typeof parsed !== 'object') return false;
  return REQUIRED_KEYS.every(k => k in parsed);
}

async function callClaude(prompt) {
  const client = new Anthropic();

  // Split SYSTEM / USER sections on the "USER\n----" divider in the template
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
    if (profile.platform !== 'youtube' && profile.platform !== 'tiktok') {
      job.log(`Platform ${profile.platform}: content analysis not yet supported`);
      return;
    }

    // ── 2. Token — refresh if near-expired ────────────────────────────────────
    let accessToken = decrypt(profile.accessToken);
    const bufferMs  = 5 * 60 * 1000;
    const nearExpiry = profile.tokenExpiresAt &&
                       (profile.tokenExpiresAt.getTime() - Date.now() < bufferMs);

    if (nearExpiry) {
      if (!profile.refreshToken) throw new Error('Token expired and no refresh token available');
      let refreshed;
      if (profile.platform === 'tiktok') {
        refreshed = await refreshTikTokToken(decrypt(profile.refreshToken));
      } else {
        refreshed = await refreshAccessToken(decrypt(profile.refreshToken));
      }

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
    let signals;

    if (profile.platform === 'tiktok') {
      const videos = await getTikTokVideoList(accessToken, { maxCount: 20 });
      const videoSignals = extractTikTokVideoSignals(videos);
      signals = {
        videoCount:         videoSignals.length,
        sampleDays:         30,
        channelDescription: '',
        channelKeywords:    '',
        affiliateDomains:   [],
        promoCodes:         [],
        videoSignals,
      };
    } else {
      signals = await getVideoSignals(accessToken);
    }

    job.log(`Fetched ${signals.videoCount} video signals`);

    const signalsExtracted = {
      videoCount:         signals.videoCount,
      sampleDays:         signals.sampleDays,
      channelDescription: signals.channelDescription,
      channelKeywords:    signals.channelKeywords,
      affiliateDomains:   signals.affiliateDomains,
      promoCodes:         signals.promoCodes,
      videoSignals:       signals.videoSignals,
    };

    // ── 4. Create run record ───────────────────────────────────────────────────
    const promptVersion = profile.platform === 'tiktok' ? TIKTOK_PROMPT_VERSION : PROMPT_VERSION;
    const prompt = profile.platform === 'tiktok'
      ? buildTikTokPrompt(signals)
      : buildPrompt(signals);

    const run = await prisma.contentAnalysisRun.create({
      data: {
        tenantId:            profile.tenantId,
        creatorId:           profile.creatorId,
        platformProfileId,
        platform:            profile.platform,
        runType:             'baseline',
        triggeredBy:         'system_onboarding',
        runStatus:           'running',
        claudePromptVersion: promptVersion,
        signalsExtracted,
        startedAt:           new Date(),
      },
    });

    // ── 5. Call Claude — one retry on invalid JSON ────────────────────────────
    let rawOutput, tokensUsed, parsed;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        ({ rawOutput, tokensUsed } = await callClaude(prompt));
        job.log(`Claude response (attempt ${attempt}): ${rawOutput.slice(0, 200)}`);

        // Rule #3: log prompt_version + raw output on every Claude call
        console.log(`[contentAnalysis] prompt_version=${promptVersion} raw_output=${rawOutput}`);

        parsed = JSON.parse(rawOutput.trim());
        if (!validateOutput(parsed)) throw new Error('Missing required fields in Claude output');
        break;
      } catch (parseErr) {
        if (attempt === 2) {
          await prisma.contentAnalysisRun.update({
            where: { id: run.id },
            data:  {
              claudeRawOutput: rawOutput ? { text: rawOutput } : null,
              tokensUsed:      tokensUsed ?? null,
              runStatus:       'failed',
              errorDetails:    parseErr.message,
              completedAt:     new Date(),
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
          claudeRawOutput:     { text: rawOutput },
          classificationOutput: parsed,
          tokensUsed,
          runStatus:           'complete',
          completedAt:         new Date(),
        },
      });

      // Upsert — one niche profile per creator per platform
      await tx.creatorNicheProfile.upsert({
        where:  { creatorId_platform: { creatorId: profile.creatorId, platform: profile.platform } },
        update: {
          primaryNicheCategory:    parsed.primary_niche_category,
          primaryNicheSpecific:    parsed.primary_niche_specific,
          secondaryNicheSpecific:  parsed.secondary_niche_specific ?? null,
          contentFormatPrimary:    parsed.content_format_primary,
          contentFormatSecondary:  parsed.content_format_secondary ?? null,
          affiliateDomainsDetected: parsed.affiliate_domains_detected ?? [],
          promoCodesDetected:      parsed.promo_codes_detected ?? [],
          brandMentions:           parsed.brand_mentions ?? [],
          existingPartnerships:    Boolean(parsed.existing_partnerships_likely),
          classificationConfidence: parsed.classification_confidence,
          confidenceReasoning:     parsed.confidence_reasoning,
          nicheCommercialNotes:    parsed.niche_commercial_notes,
          classificationReasoning: parsed.classification_reasoning,
          baselineRunId:           run.id,
          lastRefinedAt:           new Date(),
          updatedAt:               new Date(),
        },
        create: {
          tenantId:                profile.tenantId,
          creatorId:               profile.creatorId,
          platform:                profile.platform,
          primaryNicheCategory:    parsed.primary_niche_category,
          primaryNicheSpecific:    parsed.primary_niche_specific,
          secondaryNicheSpecific:  parsed.secondary_niche_specific ?? null,
          contentFormatPrimary:    parsed.content_format_primary,
          contentFormatSecondary:  parsed.content_format_secondary ?? null,
          affiliateDomainsDetected: parsed.affiliate_domains_detected ?? [],
          promoCodesDetected:      parsed.promo_codes_detected ?? [],
          brandMentions:           parsed.brand_mentions ?? [],
          existingPartnerships:    Boolean(parsed.existing_partnerships_likely),
          classificationConfidence: parsed.classification_confidence,
          confidenceReasoning:     parsed.confidence_reasoning,
          nicheCommercialNotes:    parsed.niche_commercial_notes,
          classificationReasoning: parsed.classification_reasoning,
          baselineRunId:           run.id,
        },
      });
    });

    job.log(`Analysis complete: ${parsed.primary_niche_specific} (${parsed.classification_confidence} confidence)`);
    console.log(`[contentAnalysis] creator=${profile.creatorId} niche=${parsed.primary_niche_specific} confidence=${parsed.classification_confidence}`);

    // Trigger viability scoring now that niche classification is available
    await getDataCollectionQueue().add('analysis:score-creator', {
      creatorId:   profile.creatorId,
      triggerType: 'content_analysis_complete',
    });
  });

  console.log('[contentAnalysis] worker registered on data-collection queue');
}

module.exports = { startContentAnalysisWorker };
