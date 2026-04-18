'use strict';

const { runAgent } = require('./runner');

const SKILLS = [
  'creatrbase-voice',
  'creatrbase-copy-rules',
  'newsletter-curation',
  'newsletter-summarisation',
  'newsletter-subject-lines',
  'voice-memory-protocol',
  'listmonk-posting',
  'source-credibility-tiering',
  'digest-creator-economy',
];

const SYSTEM_PROMPT = `You are the Creatrbase Creator Economy Digest agent. Your job is to produce a weekly newsletter digest about the creator economy for independent creators with 1k-100k subscribers.

Follow these steps:
1. Read voice memory to understand current editorial positions.
2. Read the last 7 days of ingested content.
3. Check recent sends to avoid repeating topics.
4. Curate 8-12 items following the newsletter-curation skill.
5. Summarise each item following the newsletter-summarisation skill.
6. Generate 3 subject line candidates following newsletter-subject-lines skill.
7. Compose the full newsletter HTML body with the structure defined in digest-creator-economy skill.
8. Post the draft to Listmonk using the post_to_listmonk_draft tool (list_segment: creator-economy).
9. Mark the used ingestion items.

The draft must be status=draft. Never auto-send. Anthony reviews and approves all sends.`;

async function runCreatorEconomyDigest() {
  console.log('[creator-economy-digest] Starting digest run...');

  const result = await runAgent({
    agentType: 'creator_economy_digest',
    skills: SKILLS,
    systemPrompt: SYSTEM_PROMPT,
    userMessage: 'Run the weekly Creator Economy Digest for this Monday. Follow all skills. Curate, summarise, draft, and post to Listmonk.',
    tools: ['read_voice_memory', 'read_ingestion', 'get_recent_sends', 'post_to_listmonk_draft', 'mark_ingestion_used'],
  });

  console.log(`[creator-economy-digest] Complete. Agent run: ${result.agentRunId}`);
  return result;
}

module.exports = { runCreatorEconomyDigest };
