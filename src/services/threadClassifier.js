'use strict';

// ─── Thread classifier ────────────────────────────────────────────────────────
// Uses Claude to read a Gmail thread and infer the current commercial stage.
// Called by the gmailSync worker for every watched thread on each hourly run.
// ─────────────────────────────────────────────────────────────────────────────

const Anthropic = require('@anthropic-ai/sdk');

// Days of silence before a stage is considered stale, by current interaction type
const STALE_THRESHOLDS = {
  'outreach_sent':       30,
  'outreach_responded':  21,
  'deal_negotiating':    14,
  'deal_contracting':    14,
  'deal_completed':      30,
  'relationship_ongoing': 30,
  'stale':               null, // already stale — keep watching for re-engagement
};

// Rank controls direction: we only advance, never regress (except stale/declined)
const STAGE_RANK = {
  'outreach_sent':      1,
  'outreach_responded': 2,
  'deal_negotiating':   3,
  'deal_contracting':   4,
  'deal_completed':     5,
  'deal_declined':      5,
  'outreach_declined':  5,
  'relationship_ongoing': 5,
  'stale':              0, // special — can happen from any rank
};

// Classifier stage labels → interaction_type values
const STAGE_TO_INTERACTION = {
  replied:      'outreach_responded',
  negotiating:  'deal_negotiating',
  contracting:  'deal_contracting',
  won:          'deal_completed',
  declined:     'deal_declined',
  stale:        'stale',
};

// Signal type to queue for each transition
const INTERACTION_TO_SIGNAL = {
  'outreach_responded': 'brand_replied',
  'deal_negotiating':   'deal_progressed',
  'deal_contracting':   'deal_progressed',
  'deal_completed':     'deal_closed',
  'deal_declined':      'deal_declined',
  'stale':              'deal_stale',
};

function staleThreshold(currentInteractionType) {
  return STALE_THRESHOLDS[currentInteractionType] ?? 21;
}

/**
 * Classify a Gmail thread and determine if the commercial stage has changed.
 *
 * @param {object} opts
 * @param {Array}  opts.messages         — thread messages from getThreadContent()
 * @param {string} opts.brandName        — name of the brand (for context)
 * @param {string} opts.creatorEmail     — creator's gmail address (to detect sender direction)
 * @param {string} opts.currentInteractionType — most recent interaction_type for this deal
 * @returns {object} { interactionType, confidence, evidence, detected_rate, detected_currency, stale_reason, stale_context }
 */
async function classifyThread({ messages, brandName, creatorEmail, currentInteractionType }) {
  if (!messages || messages.length === 0) {
    return null;
  }

  const client = new Anthropic();

  const lastMsg          = messages[messages.length - 1];
  const daysSinceLastMsg = Math.floor((Date.now() - lastMsg.internalDate) / (1000 * 60 * 60 * 24));
  const lastSenderIsCreator = lastMsg.from?.toLowerCase().includes(creatorEmail.toLowerCase());
  const threshold        = staleThreshold(currentInteractionType);

  const todayStr = new Date().toISOString().split('T')[0];

  // Format messages for the prompt
  const threadText = messages.map((m, i) => {
    const senderRole = m.from?.toLowerCase().includes(creatorEmail.toLowerCase())
      ? 'CREATOR'
      : 'BRAND';
    const daysAgo    = Math.floor((Date.now() - m.internalDate) / (1000 * 60 * 60 * 24));
    return `[${i + 1}] ${senderRole} (${daysAgo}d ago):\n${m.body || '(no body)'}`;
  }).join('\n\n---\n\n');

  const prompt = `You are analysing a Gmail thread between a content creator and a brand (${brandName}) as part of a commercial intelligence tool. Today is ${todayStr}.

THREAD (oldest first):
${threadText}

CONTEXT:
- Days since last message: ${daysSinceLastMsg}
- Last sender: ${lastSenderIsCreator ? 'creator' : 'brand'}
- Current known stage: ${currentInteractionType}
- Staleness threshold for this stage: ${threshold} days

Classify the current state of this commercial relationship.

Stage definitions:
- replied: brand has responded but no commercial discussion yet
- negotiating: rate, deliverables, timeline or terms are being actively discussed
- contracting: rates are agreed; contract, brief, invoice or payment details are being exchanged
- won: deal is confirmed by both sides (verbal or written agreement reached)
- declined: brand has explicitly said no, not now, not a fit, or out of budget
- stale: deal is in a dormant state — see stale_reason below

Mark as stale when one of these conditions is met:
- no_brand_reply: creator sent the last message and brand hasn't replied in ${threshold} days
- no_creator_reply: brand sent the last message and creator hasn't replied in ${threshold} days
- delivery_approaching: deal appears won and a content delivery date is mentioned that is within 21 days from today
- seasonal_hold: brand explicitly mentioned a specific future window (a quarter, a month, a named campaign) without a clear next step
- post_deal_silence: deal appears complete and there has been no communication in 30+ days

For stale_context: write a single plain-English sentence addressing the creator directly. Be specific — reference what actually happened in the thread (e.g. "Brand has not replied to your rate proposal in ${daysSinceLastMsg} days." or "Your content for ${brandName} is due in X days — worth confirming details.").

If a specific rate is mentioned and agreed (not just proposed), extract it as detected_rate in major currency units (e.g. 1500, not 150000) and detected_currency as GBP, USD, or EUR.

Respond with ONLY valid JSON — no explanation, no markdown:
{
  "stage": "replied|negotiating|contracting|won|declined|stale",
  "confidence": 0.0,
  "evidence": ["brief phrase 1", "brief phrase 2"],
  "detected_rate": null,
  "detected_currency": null,
  "stale_reason": null,
  "stale_context": null
}`;

  let raw;
  try {
    const response = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 400,
      messages:   [{ role: 'user', content: prompt }],
    });
    raw = response.content[0]?.text?.trim() ?? '';
  } catch (err) {
    throw new Error(`threadClassifier API call failed: ${err.message}`);
  }

  let parsed;
  try {
    // Strip markdown fences if model added them despite instructions
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`threadClassifier could not parse response: ${raw.slice(0, 200)}`);
  }

  const classifiedInteractionType = STAGE_TO_INTERACTION[parsed.stage];
  if (!classifiedInteractionType) {
    throw new Error(`threadClassifier returned unknown stage: ${parsed.stage}`);
  }

  const currentRank    = STAGE_RANK[currentInteractionType] ?? 1;
  const classifiedRank = STAGE_RANK[classifiedInteractionType] ?? 1;

  // Only advance — never regress. Stale and declined are exceptions (can happen from any rank).
  const isProgression = classifiedRank > currentRank;
  const isSpecial     = classifiedInteractionType === 'stale' ||
                        classifiedInteractionType === 'deal_declined';
  const isReEngagement = currentInteractionType === 'stale' && classifiedRank > 0;

  if (!isProgression && !isSpecial && !isReEngagement) {
    return null; // No meaningful transition
  }

  // Don't re-log stale if already stale (unless it's re-engagement)
  if (classifiedInteractionType === 'stale' && currentInteractionType === 'stale') {
    return null;
  }

  return {
    interactionType:   classifiedInteractionType,
    signalType:        INTERACTION_TO_SIGNAL[classifiedInteractionType],
    confidence:        parsed.confidence ?? 0,
    evidence:          parsed.evidence   ?? [],
    detected_rate:     parsed.detected_rate     ?? null,
    detected_currency: parsed.detected_currency ?? null,
    stale_reason:      parsed.stale_reason      ?? null,
    stale_context:     parsed.stale_context     ?? null,
  };
}

module.exports = { classifyThread, STAGE_TO_INTERACTION, INTERACTION_TO_SIGNAL };
