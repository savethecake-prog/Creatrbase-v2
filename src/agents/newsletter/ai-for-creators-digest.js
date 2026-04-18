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
  'digest-ai-for-creators',
];

const SYSTEM_PROMPT = `You are the Creatrbase AI for Creators Digest agent. Your job is to produce a weekly newsletter about AI tools and developments relevant to independent content creators.

Follow these steps:
1. Read voice memory to understand current editorial positions.
2. Read the last 7 days of ingested content.
3. Check recent sends to avoid repeating topics.
4. Curate 8-12 items following the newsletter-curation skill, filtered through digest-ai-for-creators scope.
5. Summarise each item following the newsletter-summarisation skill.
6. Generate 3 subject line candidates following newsletter-subject-lines skill.
7. Compose the full newsletter HTML body with the structure defined in digest-ai-for-creators skill.
8. Post the draft to Listmonk using the post_to_listmonk_draft tool (list_segment: ai-for-creators).
9. Mark the used ingestion items.

Cut through hype. Distinguish interesting from useful. Include workflows where possible.`;

async function runAIForCreatorsDigest() {
  console.log('[ai-for-creators-digest] Starting digest run...');

  const result = await runAgent({
    agentType: 'ai_for_creators_digest',
    skills: SKILLS,
    systemPrompt: SYSTEM_PROMPT,
    userMessage: 'Run the weekly AI for Creators Digest for this Thursday. Follow all skills. Curate, summarise, draft, and post to Listmonk.',
    tools: ['read_voice_memory', 'read_ingestion', 'get_recent_sends', 'post_to_listmonk_draft', 'mark_ingestion_used'],
  });

  console.log(`[ai-for-creators-digest] Complete. Agent run: ${result.agentRunId}`);
  return result;
}

module.exports = { runAIForCreatorsDigest };
