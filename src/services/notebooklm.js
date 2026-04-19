'use strict';

const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

// Notebook IDs from the platform registry
const NOTEBOOKS = {
  'ai-for-creators':  'e5b38cf3-9597-4c25-b141-ebd16423ce4b',
  'creator-economy':  'e291a0e0-e377-4b01-98f1-1904fb161498',
  'seo-distribution': 'f42165a8-c38e-4415-93e7-6cd2c546725c',
};

// TTLs in hours per notebook key
const BRIEF_TTLS = {
  'ai-for-creators':  48,
  'creator-economy':  168,  // 7 days
  'seo-distribution': 168,
};

// Source TTLs in hours per notebook key
const SOURCE_TTLS = {
  'ai-for-creators':  48,
  'creator-economy':  168,
  'seo-distribution': 168,
};

function getNotebookId(key) {
  const id = NOTEBOOKS[key];
  if (!id) throw new Error(`Unknown notebook key: ${key}`);
  return id;
}

function getBriefTtlHours(key) {
  return BRIEF_TTLS[key] || 168;
}

function getSourceTtlHours(key) {
  return SOURCE_TTLS[key] || 168;
}

async function run(args, timeoutMs = 60000) {
  const env = { ...process.env };
  try {
    const { stdout } = await execFileAsync('notebooklm', args, {
      env,
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
    });
    return stdout.trim();
  } catch (err) {
    throw new Error(`notebooklm ${args[0]} failed: ${err.message}`);
  }
}

async function ask(notebookKey, query, opts = {}) {
  const notebookId = getNotebookId(notebookKey);
  const args = ['ask', query, '--notebook', notebookId, '--json'];
  if (opts.saveAsNote) {
    args.push('--save-as-note');
    if (opts.noteTitle) args.push('--note-title', opts.noteTitle);
  }
  const raw = await run(args, opts.timeoutMs || 120000);
  try {
    return JSON.parse(raw);
  } catch {
    return { answer: raw };
  }
}

async function getSourceFulltext(notebookKey, sourceId) {
  const notebookId = getNotebookId(notebookKey);
  const raw = await run(['source', 'fulltext', sourceId, '--notebook', notebookId, '--json']);
  return JSON.parse(raw);
}

async function addResearch(notebookKey, query) {
  const notebookId = getNotebookId(notebookKey);
  const raw = await run(['source', 'add-research', query, '--notebook', notebookId, '--json'], 180000);
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

async function addSource(notebookKey, url) {
  const notebookId = getNotebookId(notebookKey);
  const raw = await run(['source', 'add', url, '--notebook', notebookId, '--json'], 60000);
  return JSON.parse(raw);
}

async function deleteSource(notebookKey, sourceId) {
  const notebookId = getNotebookId(notebookKey);
  await run(['source', 'delete', sourceId, '--notebook', notebookId]);
}

async function listSources(notebookKey) {
  const notebookId = getNotebookId(notebookKey);
  const raw = await run(['source', 'list', '--notebook', notebookId, '--json']);
  return JSON.parse(raw);
}

module.exports = {
  NOTEBOOKS,
  getNotebookId,
  getBriefTtlHours,
  getSourceTtlHours,
  ask,
  getSourceFulltext,
  addResearch,
  addSource,
  deleteSource,
  listSources,
};
