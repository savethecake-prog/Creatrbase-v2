'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const { getPool } = require('../../db/pool');
const { loadSkills } = require('../newsletter/skills-loader');
const { TOOL_DEFINITIONS, TOOL_HANDLERS } = require('./tools');

const MODEL = 'claude-sonnet-4-6';

// Skills loaded per content type — base voice skills always included
const SKILLS_BY_TYPE = {
  blog:       ['creatrbase-voice', 'creatrbase-copy-rules', 'content-blog-drafting', 'content-seo-metadata', 'content-internal-linking'],
  comparison: ['creatrbase-voice', 'creatrbase-copy-rules', 'content-comparison', 'content-seo-metadata', 'content-internal-linking'],
  niche:      ['creatrbase-voice', 'creatrbase-copy-rules', 'content-niche', 'content-seo-metadata', 'content-internal-linking'],
  threshold:  ['creatrbase-voice', 'creatrbase-copy-rules', 'content-seo-metadata', 'content-internal-linking'],
  research:   ['creatrbase-voice', 'creatrbase-copy-rules', 'content-research', 'content-seo-metadata'],
};

function buildSystemPrompt(contentType, brief) {
  const briefSection = brief ? `\n\n<research_brief>\n${brief}\n</research_brief>` : '';

  return `You are the Creatrbase Content Agent. You help Anthony (the founder) create high-quality, data-grounded content for the Creatrbase platform.

You have access to real platform data via tools: CPM benchmarks, niche profiles, confirmed deal signals, published content for internal linking, and the editorial voice memory. Use these to make content factually grounded in Creatrbase's own intelligence.

Content type you are working on: ${contentType}

Your workflow:
1. Start by reading voice memory to understand established editorial positions.
2. Use platform data tools to ground your content in real data.
3. Draft the content following the loaded skills.
4. Call save_draft when you have a complete or near-complete draft. Call it again after revisions.
5. Suggest relevant internal links from list_published_content.
6. If you need specific recent facts or examples, use search_research.

Always follow the creatrbase-voice and creatrbase-copy-rules skills. UK English. No em-dashes or en-dashes. Honest about uncertainty.${briefSection}`;
}

/**
 * Handle a single message turn in a content drafting session.
 * State persisted in content_sessions table.
 */
async function handleSessionMessage(sessionId, userMessage) {
  const pool = getPool();
  const client = new Anthropic();

  const { rows: [session] } = await pool.query('SELECT * FROM content_sessions WHERE id = $1', [sessionId]);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  const ctx = { sessionId, contentType: session.content_type };
  const messages = [...(session.messages || []), { role: 'user', content: userMessage }];

  const skillNames = SKILLS_BY_TYPE[session.content_type] || SKILLS_BY_TYPE.blog;
  const skillsText = loadSkills(skillNames);
  const systemPrompt = buildSystemPrompt(session.content_type, session.brief_used);
  const fullSystem = `${skillsText}\n\n${systemPrompt}`;

  // First turn
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8096,
    system: fullSystem,
    messages,
    tools: TOOL_DEFINITIONS,
  });

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

  // If tools were used, continue conversation with results
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
      max_tokens: 8096,
      system: fullSystem,
      messages: [...messages, ...responseMessages, { role: 'user', content: toolResults }],
      tools: TOOL_DEFINITIONS,
    });

    responseMessages.push({ role: 'user', content: toolResults });
    responseMessages.push({ role: 'assistant', content: followUp.content });
  }

  const lastAssistant = responseMessages[responseMessages.length - 1];
  const responseText = (lastAssistant.content || [])
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n');

  // Persist updated messages
  const updatedMessages = [
    ...messages,
    ...responseMessages,
  ];

  // Reload session to get latest current_draft (may have been updated by save_draft tool)
  const { rows: [refreshed] } = await pool.query(
    'SELECT current_draft FROM content_sessions WHERE id = $1',
    [sessionId]
  );

  await pool.query(
    'UPDATE content_sessions SET messages = $1, updated_at = NOW() WHERE id = $2',
    [JSON.stringify(updatedMessages), sessionId]
  );

  return {
    response: responseText,
    toolUses,
    currentDraft: refreshed?.current_draft || null,
  };
}

async function endSession(sessionId) {
  const pool = getPool();
  await pool.query(
    "UPDATE content_sessions SET status = 'completed', updated_at = NOW() WHERE id = $1",
    [sessionId]
  );
}

module.exports = { handleSessionMessage, endSession };
