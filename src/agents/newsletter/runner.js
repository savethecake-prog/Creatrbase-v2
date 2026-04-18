'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const { getPool } = require('../../db/pool');
const { loadSkills } = require('./skills-loader');
const { TOOL_DEFINITIONS, TOOL_HANDLERS } = require('./tools');

const MODEL = 'claude-sonnet-4-6';

/**
 * Run an agent with skills and tools.
 * Creates an agent_run record, executes the conversation, writes output_snapshot.
 *
 * @param {object} opts
 * @param {string} opts.agentType - e.g. 'creator_economy_digest'
 * @param {string[]} opts.skills - skill names to load
 * @param {string} opts.systemPrompt - additional system prompt beyond skills
 * @param {string} opts.userMessage - the initial user message
 * @param {string[]} [opts.tools] - tool names to enable (defaults to all)
 * @returns {object} { agentRunId, output }
 */
async function runAgent({ agentType, skills, systemPrompt, userMessage, tools }) {
  const pool = getPool();
  const client = new Anthropic();

  // Create agent_run record
  const { rows: [run] } = await pool.query(
    `INSERT INTO agent_run (agent_type, status, started_at) VALUES ($1, 'running', NOW()) RETURNING id`,
    [agentType]
  );
  const agentRunId = run.id;

  const ctx = { agentType, agentRunId };

  try {
    // Build system prompt from skills
    const skillsText = loadSkills(skills);
    const fullSystem = `${skillsText}\n\n${systemPrompt || ''}`;

    // Filter tools if specified
    const enabledTools = tools
      ? TOOL_DEFINITIONS.filter(t => tools.includes(t.name))
      : TOOL_DEFINITIONS;

    // Run conversation loop
    let messages = [{ role: 'user', content: userMessage }];
    let output = {};
    let iterations = 0;
    const MAX_ITERATIONS = 20;

    while (iterations < MAX_ITERATIONS) {
      iterations++;

      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system: fullSystem,
        messages,
        tools: enabledTools,
      });

      // Collect text and tool_use blocks
      let hasToolUse = false;
      const toolResults = [];

      for (const block of response.content) {
        if (block.type === 'text') {
          output.lastText = block.text;
        }
        if (block.type === 'tool_use') {
          hasToolUse = true;
          const handler = TOOL_HANDLERS[block.name];
          if (!handler) {
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify({ error: `Unknown tool: ${block.name}` }),
            });
            continue;
          }

          try {
            const result = await handler(block.input, ctx);
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify(result),
            });
          } catch (toolErr) {
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify({ error: toolErr.message }),
              is_error: true,
            });
          }
        }
      }

      if (!hasToolUse || response.stop_reason === 'end_turn') {
        break;
      }

      // Continue conversation with tool results
      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: toolResults });
    }

    // Mark complete
    await pool.query(
      `UPDATE agent_run SET status = 'complete', completed_at = NOW(), output_snapshot = $1 WHERE id = $2`,
      [JSON.stringify(output), agentRunId]
    );

    return { agentRunId, output };

  } catch (err) {
    await pool.query(
      `UPDATE agent_run SET status = 'failed', completed_at = NOW(), error_message = $1 WHERE id = $2`,
      [err.message, agentRunId]
    );
    throw err;
  }
}

module.exports = { runAgent };
