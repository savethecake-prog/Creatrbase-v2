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
async function sendEmail({ accessToken, from, to, subject, body }) {
  const raw  = buildMimeMessage({ from, to, subject, body });
  const sent = await gmailPost('/messages/send', accessToken, { raw });
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
    // Thread may have been deleted or is inaccessible
    if (err.message.includes('404')) return { hasReply: false, messageCount: 0, latestSnippet: null };
    throw err;
  }

  const messages = thread.messages ?? [];
  const count    = messages.length;

  // More than 1 message = there's a reply
  const hasReply = count > 1;
  const latest   = messages[count - 1];

  return {
    hasReply,
    messageCount:    count,
    latestSnippet:   latest?.snippet ?? null,
  };
}

module.exports = {
  refreshGmailToken,
  ensureLabel,
  applyLabel,
  sendEmail,
  checkThreadForReply,
};
