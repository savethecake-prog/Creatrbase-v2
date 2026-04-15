'use strict';

// ─── Support chat routes ───────────────────────────────────────────────────────
//
//   GET  /api/support/chat/history  — load current open ticket messages
//   POST /api/support/chat          — send a message, get a response
//
// Security:
//   - Max 500 chars per user message (rejected before Claude sees it)
//   - Max 20 messages per ticket (hard cap)
//   - Max 3 open tickets per tenant per day (rate limit)
//   - Only last 4 messages sent to Claude (prevents context poisoning)
//   - Hardened system prompt rejects roleplay / instruction injection
//   - claude-haiku-4-5-20251001 at max_tokens 250 (fast, cheap, focused)
// ─────────────────────────────────────────────────────────────────────────────

const fs        = require('fs');
const path      = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { Resend } = require('resend');
const { authenticate } = require('../../middleware/authenticate');
const { getPrisma }    = require('../../lib/prisma');

const SYSTEM_PROMPT   = fs.readFileSync(
  path.join(__dirname, '../../prompts/support-v1.txt'), 'utf8'
);
const MODEL           = 'claude-haiku-4-5-20251001';
const MAX_TOKENS      = 250;
const MAX_MSG_LENGTH  = 500;
const MAX_MSGS_PER_TICKET = 20;
const MAX_TICKETS_PER_DAY = 3;
const HISTORY_WINDOW  = 4;   // messages sent to Claude
const APP_URL         = process.env.APP_URL || 'https://creatrbase.com';
const OPERATOR_EMAIL  = process.env.OPERATOR_EMAIL || 'savethecake@gmail.com';

function getAnthropicClient() {
  return new Anthropic();
}

function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

// Strip control characters and normalise whitespace
function sanitise(str) {
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
}

async function sendEscalationEmail({ tenantId, userEmail, reason, messages }) {
  const resend = getResend();
  if (!resend) return;

  const history = messages
    .map(m => `[${m.role}] ${m.content}`)
    .join('\n');

  await resend.emails.send({
    from:    'Creatrbase <digest@dashboard.creatrbase.com>',
    to:      OPERATOR_EMAIL,
    subject: `Support escalation — ${userEmail}`,
    html: `<pre style="font-family:monospace;font-size:13px;white-space:pre-wrap">
Tenant: ${tenantId}
User: ${userEmail}
Reason: ${reason}

--- Conversation ---
${history}
</pre>`,
  });
}

async function supportRoutes(app) {
  // ── GET /api/support/chat/history ─────────────────────────────────────────

  app.get('/api/support/chat/history', { preHandler: authenticate }, async (req) => {
    const prisma  = getPrisma();
    const ticket  = await prisma.supportTicket.findFirst({
      where:   { tenantId: req.user.tenantId, status: 'open' },
      orderBy: { createdAt: 'desc' },
      select:  { id: true, messages: true },
    });
    return { messages: ticket?.messages ?? [] };
  });

  // ── POST /api/support/chat ────────────────────────────────────────────────

  app.post('/api/support/chat', { preHandler: authenticate }, async (req, reply) => {
    const prisma = getPrisma();
    const raw    = req.body?.message ?? '';
    const message = sanitise(String(raw));

    if (!message) {
      return reply.code(400).send({ error: 'Message is required.' });
    }
    if (message.length > MAX_MSG_LENGTH) {
      return reply.code(400).send({ error: `Message must be ${MAX_MSG_LENGTH} characters or fewer.` });
    }

    // ── Rate limit: max 3 open tickets per tenant per day ─────────────────

    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);

    const todayTicketCount = await prisma.supportTicket.count({
      where: {
        tenantId:  req.user.tenantId,
        createdAt: { gte: dayStart },
      },
    });

    if (todayTicketCount >= MAX_TICKETS_PER_DAY) {
      return reply.code(429).send({ error: 'Too many support conversations today. Please try again tomorrow or email support.' });
    }

    // ── Get or create open ticket ─────────────────────────────────────────

    let ticket = await prisma.supportTicket.findFirst({
      where:   { tenantId: req.user.tenantId, status: 'open' },
      orderBy: { createdAt: 'desc' },
    });

    if (!ticket) {
      ticket = await prisma.supportTicket.create({
        data: { tenantId: req.user.tenantId, messages: [] },
      });
    }

    const messages = Array.isArray(ticket.messages) ? ticket.messages : [];

    // ── Hard cap: close ticket and reject if at message limit ────────────

    if (messages.length >= MAX_MSGS_PER_TICKET) {
      await prisma.supportTicket.update({
        where: { id: ticket.id },
        data:  { status: 'resolved' },
      });
      return reply.code(429).send({ error: 'This conversation has reached its limit. Start a new chat.' });
    }

    // ── Build Claude conversation (last HISTORY_WINDOW messages only) ─────

    const userMsg = { role: 'user', content: message, ts: new Date().toISOString() };
    const history = messages.slice(-HISTORY_WINDOW);

    const claudeMessages = [
      ...history.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ];

    // ── Call Claude ───────────────────────────────────────────────────────

    let rawReply;
    try {
      const response = await getAnthropicClient().messages.create({
        model:      MODEL,
        max_tokens: MAX_TOKENS,
        system:     SYSTEM_PROMPT,
        messages:   claudeMessages,
      });
      rawReply = response.content[0]?.text?.trim() ?? '';
    } catch (err) {
      app.log.error({ err }, 'Support Claude call failed');
      return reply.code(502).send({ error: 'Support is temporarily unavailable. Please try again shortly.' });
    }

    // ── Detect escalation ─────────────────────────────────────────────────

    let escalated   = false;
    let replyText   = rawReply;
    let escalReason = null;

    try {
      const parsed = JSON.parse(rawReply);
      if (parsed?.escalate === true) {
        escalated   = true;
        escalReason = parsed.reason ?? 'Escalation requested';
        replyText   = "I've flagged this for the Creatrbase team — someone will follow up with you by email shortly.";
      }
    } catch {
      // Not JSON — normal text response
    }

    // ── Persist messages ──────────────────────────────────────────────────

    const assistantMsg = { role: 'assistant', content: replyText, ts: new Date().toISOString() };
    const updatedMessages = [...messages, userMsg, assistantMsg];

    await prisma.supportTicket.update({
      where: { id: ticket.id },
      data:  {
        messages: updatedMessages,
        status:   escalated ? 'escalated' : 'open',
        updatedAt: new Date(),
      },
    });

    // ── Send escalation email ─────────────────────────────────────────────

    if (escalated) {
      sendEscalationEmail({
        tenantId:  req.user.tenantId,
        userEmail: req.user.email,
        reason:    escalReason,
        messages:  updatedMessages,
      }).catch(err => app.log.error({ err }, 'Escalation email failed'));
    }

    return { reply: replyText, escalated };
  });
}

module.exports = { supportRoutes };
