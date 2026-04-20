'use strict';

// ─── Gmail API service ────────────────────────────────────────────────────────
// Handles all Gmail API calls: token refresh, label management,
// sending email, applying labels, and thread reply detection.
// ─────────────────────────────────────────────────────────────────────────────

const GMAIL_BASE  = 'https://gmail.googleapis.com/gmail/v1/users/me';
const LABEL_NAME  = 'Creatrbase';

// ─── Token refresh ────────────────────────────────────────────────────────────

async function refreshGmailToken(refreshToken) {
  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    grant_type:    'refresh_token',
    refresh_token: refreshToken,
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    params.toString(),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gmail token refresh failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    expiresAt:   data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
  };
}

// ─── Helix helper ─────────────────────────────────────────────────────────────

async function gmailGet(path, accessToken) {
  const res = await fetch(`${GMAIL_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gmail GET ${path} failed (${res.status}): ${body}`);
  }
  return res.json();
}

async function gmailPost(path, accessToken, body) {
  const res = await fetch(`${GMAIL_BASE}${path}`, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail POST ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

// ─── Label management ─────────────────────────────────────────────────────────

/**
 * Ensure the "Creatrbase" label exists. Returns its ID.
 * Creates it if missing.
 */
async function ensureLabel(accessToken) {
  const { labels } = await gmailGet('/labels', accessToken);
  const existing = labels?.find(l => l.name === LABEL_NAME);
  if (existing) return existing.id;

  const created = await gmailPost('/labels', accessToken, {
    name:                  LABEL_NAME,
    labelListVisibility:   'labelShow',
    messageListVisibility: 'show',
    color: {
      backgroundColor: '#16a765',
      textColor:       '#ffffff',
    },
  });
  return created.id;
}

/**
 * Apply a label to a Gmail message.
 */
async function applyLabel(accessToken, messageId, labelId) {
  await gmailPost(`/messages/${messageId}/modify`, accessToken, {
    addLabelIds: [labelId],
  });
}

// ─── Send email ───────────────────────────────────────────────────────────────

/**
 * Build a base64url-encoded RFC 2822 MIME message.
 */
function buildMimeMessage({ from, to, subject, body }) {
  // Encode subject with RFC 2047 UTF-8 encoding to handle non-ASCII characters (em dashes etc.)
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`;

  const mime = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(body).toString('base64'),
  ].join('\r\n');

  return Buffer.from(mime)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Send an email via Gmail API.
 * Returns { messageId, threadId }.
 */
async function sendEmail({ accessToken, from, to, subject, body, threadId }) {
  const raw     = buildMimeMessage({ from, to, subject, body });
  const payload = { raw };
  if (threadId) payload.threadId = threadId;
  const sent = await gmailPost('/messages/send', accessToken, payload);
  return {
    messageId: sent.id,
    threadId:  sent.threadId,
  };
}

// ─── Thread reply detection ───────────────────────────────────────────────────

/**
 * Check a Gmail thread for replies.
 * Returns { hasReply, messageCount, latestSnippet }.
 */
async function checkThreadForReply(accessToken, threadId) {
  let thread;
  try {
    thread = await gmailGet(`/threads/${threadId}?format=metadata`, accessToken);
  } catch (err) {
    if (err.message.includes('404')) return { hasReply: false, messageCount: 0, latestSnippet: null };
    throw err;
  }

  const messages = thread.messages ?? [];
  const count    = messages.length;
  const hasReply = count > 1;
  const latest   = messages[count - 1];

  return {
    hasReply,
    messageCount:    count,
    latestSnippet:   latest?.snippet ?? null,
  };
}

// ─── Full thread content ──────────────────────────────────────────────────────

function extractTextBody(payload) {
  if (!payload) return '';

  // Direct text/plain body
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf-8');
  }

  // Recurse into parts
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractTextBody(part);
      if (text) return text;
    }
  }

  return '';
}

function getHeader(headers, name) {
  return headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
}

/**
 * Fetch the full content of a Gmail thread.
 * Returns { threadId, messages: [{ from, internalDate, body }] }.
 * Each message body is truncated to 800 chars to keep LLM token cost low.
 */
async function getThreadContent(accessToken, threadId) {
  let thread;
  try {
    thread = await gmailGet(`/threads/${threadId}?format=full`, accessToken);
  } catch (err) {
    if (err.message.includes('404')) return { threadId, messages: [] };
    throw err;
  }

  const messages = (thread.messages ?? []).map((msg) => {
    const headers = msg.payload?.headers ?? [];
    const rawBody = extractTextBody(msg.payload);
    // Strip quoted reply chains (lines starting with >) to keep content lean
    const body = rawBody
      .split('\n')
      .filter(line => !line.trimStart().startsWith('>'))
      .join('\n')
      .replace(/\s{3,}/g, '\n\n')
      .trim()
      .slice(0, 800);

    return {
      from:         getHeader(headers, 'From'),
      internalDate: parseInt(msg.internalDate ?? '0', 10), // Unix ms
      body,
    };
  });

  // Only keep the last 12 messages — enough context, avoids token bloat
  return {
    threadId,
    messages: messages.slice(-12),
  };
}

// ─── Gmail Watch (Pub/Sub push) ───────────────────────────────────────────────

const GMAIL_WATCH_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

/**
 * Register (or renew) a Gmail push watch for the authenticated user's inbox.
 * topicName: full Pub/Sub topic resource name, e.g.
 *   'projects/my-project/topics/creatrbase-gmail-notifications'
 * Returns { historyId: string, expiration: Date }.
 * Watch expires ~7 days after creation — store expiration and renew before it lapses.
 */
async function setupGmailWatch(accessToken, topicName) {
  const res = await fetch(`${GMAIL_WATCH_BASE}/watch`, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      topicName,
      labelIds:        ['INBOX'],
      labelFilterBehavior: 'include',
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail watch setup failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return {
    historyId:  String(data.historyId),
    expiration: new Date(parseInt(data.expiration, 10)),
  };
}

/**
 * Fetch all new INBOX messages since a stored historyId checkpoint.
 * Returns { messages: [{ messageId, threadId }], nextHistoryId: string }.
 * If the historyId has expired (410 Gone), throws so the caller can re-watch.
 */
async function getHistorySince(accessToken, startHistoryId) {
  const params = new URLSearchParams({
    startHistoryId,
    historyTypes: 'messageAdded',
    labelId:      'INBOX',
  });
  const res = await fetch(`${GMAIL_WATCH_BASE}/history?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail history fetch failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  const messages = [];
  for (const record of data.history ?? []) {
    for (const added of record.messagesAdded ?? []) {
      const m = added.message;
      if (m?.id && m?.threadId) {
        messages.push({ messageId: m.id, threadId: m.threadId });
      }
    }
  }
  return {
    messages,
    nextHistoryId: data.historyId ? String(data.historyId) : startHistoryId,
  };
}

module.exports = {
  refreshGmailToken,
  ensureLabel,
  applyLabel,
  sendEmail,
  checkThreadForReply,
  getThreadContent,
  setupGmailWatch,
  getHistorySince,
};
