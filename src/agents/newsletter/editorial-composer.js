'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const { getPool } = require('../../db/pool');
const { loadSkills } = require('./skills-loader');
const { TOOL_DEFINITIONS, TOOL_HANDLERS } = require('./tools');

const MODEL = 'claude-sonnet-4-6';

const ALL_SKILLS = [
  'creatrbase-voice',
  'creatrbase-copy-rules',
  'newsletter-curation',
  'newsletter-summarisation',
  'newsletter-subject-lines',
  'editorial-question-generation',
  'editorial-drafting',
  'voice-memory-protocol',
  'listmonk-posting',
  'source-credibility-tiering',
  'digest-creator-economy',
  'digest-ai-for-creators',
];

const SYSTEM_PROMPT = `You are the Creatrbase Editorial Composer. You work conversationally with Anthony (the founder) to produce editorial newsletter content.

You are the ONLY agent allowed to write voice memory entries with source='anthony'. When Anthony states a position, record it.

Session flow:
1. Greet Anthony. Load voice memory and recent ingestion.
2. Generate editorial questions based on current events and voice memory gaps.
3. Present questions (offer: all at once or one at a time).
4. Collect Anthony's answers.
5. Draft editorial content based on his answers, following the editorial-drafting skill.
6. Present the draft for review.
7. If approved: post to Listmonk as a draft. If revise: incorporate feedback and re-draft. If reject: discard.
8. Propose voice memory updates based on Anthony's answers.
9. Apply approved memory updates.

Be conversational but efficient. Don't ask unnecessary questions. Reference specific ingestion items and voice memory when relevant.`;

/**
 * Handle a single message in an editorial session.
 * Maintains conversation state in the agent_run's output_snapshot.
 *
 * @param {string} sessionId - agent_run ID for this session
 * @param {string} userMessage - Anthony's message
 * @returns {object} { response, toolUses }
 */
async function handleSessionMessage(sessionId, userMessage) {
  const pool = getPool();
  const client = new Anthropic();

  // Load or create session
  let { rows: [run] } = await pool.query('SELECT * FROM agent_run WHERE id = $1', [sessionId]);

  if (!run) {
    // Create new session
    const { rows: [newRun] } = await pool.query(
      `INSERT INTO agent_run (id, agent_type, status, started_at, output_snapshot)
       VALUES ($1, 'editorial_composer_session', 'running', NOW(), $2) RETURNING *`,
      [sessionId, JSON.stringify({ messages: [], toolUses: [] })]
    );
    run = newRun;
  }

  const snapshot = run.output_snapshot || { messages: [], toolUses: [] };
  const ctx = { agentType: 'editorial_composer_session', agentRunId: sessionId };

  // Build system prompt
  const skillsText = loadSkills(ALL_SKILLS);
  const fullSystem = `${skillsText}\n\n${SYSTEM_PROMPT}`;

  // Build message history
  const messages = [...(snapshot.messages || []), { role: 'user', content: userMessage }];

  // Run conversation turn
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: fullSystem,
    messages,
    tools: TOOL_DEFINITIONS,
  });

  // Process tool uses
  const toolUses = [];
  let hasToolUse = false;
  let responseMessages = [{ role: 'assistant', content: response.content }];

  for (const block of response.content) {
    if (block.type === 'tool_use') {
      hasToolUse = true;
      const handler = TOOL_HANDLERS[block.name];
      let result;
      try {
        result = handler ? await handler(block.input, ctx) : { error: `Unknown tool: ${block.name}` };
      } catch (err) {
        result = { error: err.message };
      }
      toolUses.push({ tool: block.name, input: block.input, result });
    }
  }

  // If there were tool uses, continue the conversation with results
  if (hasToolUse) {
    const toolResults = response.content
      .filter(b => b.type === 'tool_use')
      .map((b, i) => ({
        type: 'tool_result',
        tool_use_id: b.id,
        content: JSON.stringify(toolUses[i]?.result || {}),
      }));

    const followUp = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: fullSystem,
      messages: [...messages, ...responseMessages, { role: 'user', content: toolResults }],
      tools: TOOL_DEFINITIONS,
    });

    responseMessages.push({ role: 'user', content: toolResults });
    responseMessages.push({ role: 'assistant', content: followUp.content });
  }

  // Extract text response
  const lastAssistant = responseMessages[responseMessages.length - 1];
  const textBlocks = (lastAssistant.content || []).filter(b => b.type === 'text');
  const responseText = textBlocks.map(b => b.text).join('\n');

  // Update session state
  const updatedMessages = [...messages, ...responseMessages];
  const updatedSnapshot = {
    messages: updatedMessages,
    toolUses: [...(snapshot.toolUses || []), ...toolUses],
    lastResponse: responseText,
  };

  await pool.query(
    'UPDATE agent_run SET output_snapshot = $1 WHERE id = $2',
    [JSON.stringify(updatedSnapshot), sessionId]
  );

  return {
    response: responseText,
    toolUses,
  };
}

/**
 * End an editorial session.
 */
async function endSession(sessionId) {
  const pool = getPool();
  await pool.query(
    "UPDATE agent_run SET status = 'complete', completed_at = NOW() WHERE id = $1",
    [sessionId]
  );
}

module.exports = { handleSessionMessage, endSession };
