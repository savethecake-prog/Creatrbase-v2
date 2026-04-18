'use strict';

const { getPool } = require('../../db/pool');
const { getListmonkClient } = require('../../services/listmonkClient');

/**
 * Tool definitions for Anthropic SDK tool_use.
 * Each tool has a definition (for the API) and a handler (for execution).
 */

const TOOL_DEFINITIONS = [
  {
    name: 'read_voice_memory',
    description: 'Read voice memory entries. Returns editorial positions on topics.',
    input_schema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Filter by topic (partial match)' },
        include_deprecated: { type: 'boolean', description: 'Include deprecated entries', default: false },
        limit: { type: 'number', description: 'Max entries to return', default: 50 },
      },
    },
  },
  {
    name: 'write_voice_memory',
    description: 'Write a new voice memory entry. Only write editorial positions, not facts.',
    input_schema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Kebab-case topic key' },
        position: { type: 'string', description: 'Complete position statement' },
        context: { type: 'string', description: 'Why this position was formed' },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        source: { type: 'string', enum: ['anthony', 'inferred'] },
        supersedes_id: { type: 'string', description: 'UUID of entry this replaces' },
      },
      required: ['topic', 'position', 'confidence', 'source'],
    },
  },
  {
    name: 'read_ingestion',
    description: 'Read ingested content items from RSS feeds. Returns recent items for curation.',
    input_schema: {
      type: 'object',
      properties: {
        since_days: { type: 'number', description: 'Items from last N days', default: 7 },
        unused_only: { type: 'boolean', description: 'Only items not yet used in a send', default: true },
        limit: { type: 'number', description: 'Max items', default: 100 },
      },
    },
  },
  {
    name: 'post_to_listmonk_draft',
    description: 'Post a completed newsletter draft to Listmonk as a campaign draft. Never auto-sends.',
    input_schema: {
      type: 'object',
      properties: {
        list_segment: { type: 'string', description: 'Target list name: creator-economy, ai-for-creators, or editorial' },
        subject: { type: 'string' },
        preview_text: { type: 'string' },
        body_html: { type: 'string' },
        body_text: { type: 'string', description: 'Plain text version' },
      },
      required: ['list_segment', 'subject', 'body_html'],
    },
  },
  {
    name: 'get_recent_sends',
    description: 'Get recently sent newsletter campaigns from Listmonk.',
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', default: 5 },
      },
    },
  },
  {
    name: 'mark_ingestion_used',
    description: 'Mark ingestion items as used in a newsletter send.',
    input_schema: {
      type: 'object',
      properties: {
        item_ids: { type: 'array', items: { type: 'string' }, description: 'UUIDs of ingest_item rows' },
        campaign_id: { type: 'string', description: 'Listmonk campaign ID' },
      },
      required: ['item_ids'],
    },
  },
  {
    name: 'propose_skill_update',
    description: 'Propose an edit to a skill file. Only the editorial composer agent should use this.',
    input_schema: {
      type: 'object',
      properties: {
        skill_name: { type: 'string' },
        proposed_content: { type: 'string' },
        rationale: { type: 'string' },
      },
      required: ['skill_name', 'proposed_content', 'rationale'],
    },
  },
];

/**
 * Tool handlers. Each receives the input and an optional context.
 */
const TOOL_HANDLERS = {
  async read_voice_memory({ topic, include_deprecated, limit }) {
    const pool = getPool();
    let query = 'SELECT * FROM voice_memory WHERE 1=1';
    const params = [];

    if (!include_deprecated) {
      query += ' AND deprecated_at IS NULL';
    }
    if (topic) {
      params.push(`%${topic}%`);
      query += ` AND topic ILIKE $${params.length}`;
    }
    query += ' ORDER BY last_referenced_at DESC NULLS LAST, created_at DESC';
    params.push(limit || 50);
    query += ` LIMIT $${params.length}`;

    const { rows } = await pool.query(query, params);
    return rows;
  },

  async write_voice_memory({ topic, position, context, confidence, source, supersedes_id }, ctx) {
    // Enforce: only editorial_composer can write source='anthony'
    if (source === 'anthony' && ctx?.agentType !== 'editorial_composer_session') {
      throw new Error("Only the editorial composer agent can write source='anthony' entries.");
    }

    const pool = getPool();

    // If superseding, deprecate the old entry
    if (supersedes_id) {
      await pool.query(
        'UPDATE voice_memory SET deprecated_at = NOW(), updated_at = NOW() WHERE id = $1',
        [supersedes_id]
      );
    }

    const { rows } = await pool.query(
      `INSERT INTO voice_memory (topic, position, context, confidence, source, supersedes_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [topic, position, context || null, confidence, source, supersedes_id || null]
    );

    // Update superseded_by on the old entry
    if (supersedes_id && rows[0]) {
      await pool.query(
        'UPDATE voice_memory SET superseded_by = $1, updated_at = NOW() WHERE id = $2',
        [rows[0].id, supersedes_id]
      );
    }

    return rows[0];
  },

  async read_ingestion({ since_days, unused_only, limit }) {
    const pool = getPool();
    const since = new Date(Date.now() - (since_days || 7) * 86400000);
    let query = `SELECT i.*, s.name as source_name, s.source_type
                 FROM ingest_item i JOIN ingest_source s ON i.source_id = s.id
                 WHERE i.created_at >= $1`;
    const params = [since];

    if (unused_only !== false) {
      query += ' AND i.used_in_send IS NULL';
    }
    query += ' ORDER BY i.published_at DESC NULLS LAST';
    params.push(limit || 100);
    query += ` LIMIT $${params.length}`;

    const { rows } = await pool.query(query, params);
    return rows;
  },

  async post_to_listmonk_draft({ list_segment, subject, preview_text, body_html, body_text }) {
    const client = getListmonkClient();
    const listsData = await client.getLists();
    const allLists = listsData.data?.results || [];
    const targetList = allLists.find(l => l.name.toLowerCase().includes(list_segment.replace(/-/g, ' ')));

    if (!targetList) {
      throw new Error(`List segment "${list_segment}" not found in Listmonk.`);
    }

    const result = await client.createDraft({
      name: `${list_segment} - ${new Date().toISOString().slice(0, 10)}`,
      subject,
      lists: [targetList.id],
      fromEmail: 'hello@creatrbase.com',
      body: body_html,
      altbody: body_text || '',
      tags: [list_segment, new Date().toISOString().slice(0, 10)],
    });

    return { campaign_id: result.data?.id, status: 'draft' };
  },

  async get_recent_sends({ limit }) {
    try {
      const client = getListmonkClient();
      const data = await client.getCampaigns({ status: 'finished', perPage: limit || 5 });
      return (data.data?.results || []).map(c => ({
        campaign_id: c.id,
        sent_at: c.sent_at,
        subject: c.subject,
        status: c.status,
      }));
    } catch {
      return [];
    }
  },

  async mark_ingestion_used({ item_ids, campaign_id }) {
    const pool = getPool();
    await pool.query(
      `UPDATE ingest_item SET used_in_send = $1, seen_by_agent_at = NOW()
       WHERE id = ANY($2::uuid[])`,
      [campaign_id || null, item_ids]
    );
    return { marked: item_ids.length };
  },

  async propose_skill_update({ skill_name, proposed_content, rationale }, ctx) {
    const pool = getPool();
    await pool.query(
      `INSERT INTO skill_edit_proposal (skill_name, proposed_content, rationale, proposed_by_agent_run)
       VALUES ($1, $2, $3, $4)`,
      [skill_name, proposed_content, rationale, ctx?.agentRunId || null]
    );
    return { status: 'pending', skill_name };
  },
};

module.exports = { TOOL_DEFINITIONS, TOOL_HANDLERS };
