'use strict';

const Anthropic  = require('@anthropic-ai/sdk');
const { getPool } = require('../../db/pool');
const { TOOL_DEFINITIONS, TOOL_HANDLERS } = require('./tools');

const MODEL      = 'claude-sonnet-4-6';
const MAX_TOKENS = 1024;

const SYSTEM_PROMPT = `You are the Creatrbase Commercial Coach — a specialist in YouTube creator monetisation and brand deal strategy.

You have access to tools that fetch the creator's live data: their Commercial Viability Score, all six dimension scores, niche benchmarks, historical score trends, and active recommendations.

ROLE:
Answer commercial questions about the creator's channel: rates, brand deal readiness, score changes, what brands look for. Give specific, data-grounded answers. Be concise and direct — no padding.

CRITICAL RULES:
1. Never give specific rate numbers (£X or $X) without first calling get_niche_benchmarks. Once you have benchmark data, always cite the actual range from the data, never guess.
2. Anchor every claim to actual data. "Your engagement score is 42" not "engagement rates are typically low for gaming".
3. When you call a tool and receive data, weave the actual numbers into your response naturally. Do not dump raw JSON.
4. Keep responses tight. Use short paragraphs or bullet points. Aim for under 200 words unless the question requires more.
5. If asked about content strategy, video ideas, SEO, or thumbnails — acknowledge briefly and redirect: "That's outside my scope as a commercial coach. For content strategy, check the Gap Tracker."

WHAT YOU CAN ANSWER:
- Rate estimates for their channel (requires get_niche_benchmarks)
- Why their commercial score changed (requires get_dimension_history)
- What's blocking brand deals (requires get_creator_profile)
- Whether a brand offer is fair (requires get_niche_benchmarks)
- What their single highest-leverage action is (requires get_active_recommendations)
- How geography affects their rates and what to do about it

WHAT YOU CANNOT ANSWER (redirect politely):
- Video ideas, thumbnails, titles, SEO — Gap Tracker
- Specific brand introductions — Brands section
- Legal or tax questions — recommend a professional`;

/**
 * Create a new coach session for a creator.
 * Returns the session ID (agent_run UUID).
 */
async function createSession(creatorId, tenantId) {
  const pool = getPool();
  const meta = { creatorId, tenantId };
  const { rows: [run] } = await pool.query(
    `INSERT INTO agent_run (agent_type, status, started_at, output_snapshot)
     VALUES ('commercial_coach_session', 'running', NOW(), $1) RETURNING id`,
    [JSON.stringify({ messages: [], toolUses: [], meta })]
  );
  return run.id;
}

/**
 * Send a message in a coach session and get a response.
 * Stores conversation in agent_run.output_snapshot.
 *
 * @param {string} sessionId  - agent_run UUID
 * @param {string} creatorId  - creator UUID (used for tool queries)
 * @param {string} userMessage
 * @returns {{ response: string, toolsUsed: string[] }}
 */
async function sendMessage(sessionId, creatorId, userMessage) {
  const pool   = getPool();
  const client = new Anthropic();

  const { rows: [run] } = await pool.query('SELECT * FROM agent_run WHERE id = $1', [sessionId]);
  if (!run) throw new Error('Session not found');

  const snapshot = run.output_snapshot || { messages: [], toolUses: [], meta: {} };
  const ctx = { creatorId: creatorId || snapshot.meta?.creatorId };

  const messages = [...(snapshot.messages || []), { role: 'user', content: userMessage }];

  const MAX_ROUNDS = 5;
  const toolUses = [];
  let loopMessages = [...messages];
  let responseText = '';

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const response = await client.messages.create({
      model:      MODEL,
      max_tokens: MAX_TOKENS,
      system:     SYSTEM_PROMPT,
      messages:   loopMessages,
      tools:      TOOL_DEFINITIONS,
    });

    loopMessages.push({ role: 'assistant', content: response.content });

    // Always capture text — Claude may return text alongside tool_use blocks
    const textBlocks = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
    if (textBlocks) responseText = textBlocks;

    const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
    if (toolUseBlocks.length === 0 || response.stop_reason === 'end_turn') break;

    const toolResults = [];
    for (const block of toolUseBlocks) {
      const handler = TOOL_HANDLERS[block.name];
      let result;
      try {
        result = handler ? await handler(block.input, ctx) : { error: `Unknown tool: ${block.name}` };
      } catch (err) {
        result = { error: err.message };
      }
      toolUses.push({ tool: block.name, result });
      toolResults.push({
        type:        'tool_result',
        tool_use_id: block.id,
        content:     JSON.stringify(result),
      });
    }

    loopMessages.push({ role: 'user', content: toolResults });
  }

  if (!responseText) {
    responseText = "I wasn't able to generate a response. Please try again.";
  }

  const updatedSnapshot = {
    messages: loopMessages,
    toolUses: [...(snapshot.toolUses || []), ...toolUses],
    meta:     snapshot.meta,
    lastResponse: responseText,
  };

  await pool.query(
    'UPDATE agent_run SET output_snapshot = $1 WHERE id = $2',
    [JSON.stringify(updatedSnapshot), sessionId]
  );

  return {
    response:  responseText,
    toolsUsed: toolUses.map(t => t.tool),
  };
}

/**
 * Load session history for display.
 */
async function getSession(sessionId) {
  const pool = getPool();
  const { rows: [run] } = await pool.query(
    'SELECT id, output_snapshot, created_at FROM agent_run WHERE id = $1',
    [sessionId]
  );
  if (!run) return null;
  const snapshot = run.output_snapshot || { messages: [], meta: {} };

  const turns = [];
  const msgs = snapshot.messages || [];
  for (const m of msgs) {
    if (m.role === 'user') {
      const content = Array.isArray(m.content) ? null : m.content;
      if (content && typeof content === 'string') turns.push({ role: 'user', text: content });
    } else if (m.role === 'assistant') {
      const textBlocks = Array.isArray(m.content)
        ? m.content.filter(b => b.type === 'text').map(b => b.text).join('\n')
        : null;
      if (textBlocks) turns.push({ role: 'assistant', text: textBlocks });
    }
  }

  return { sessionId: run.id, startedAt: run.created_at, turns };
}

module.exports = { createSession, sendMessage, getSession };
