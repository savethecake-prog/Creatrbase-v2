'use strict';

// ─── Gmail OAuth + outreach send routes ───────────────────────────────────────
//
//   GET  /api/gmail/connect              → redirect to Google consent
//   GET  /api/gmail/callback             → OAuth callback, store tokens + create label
//   GET  /api/gmail/status               → is Gmail connected for this creator?
//   DELETE /api/gmail/disconnect         → revoke + remove connection
//   POST /api/brands/:brandId/send-email → send outreach email via Gmail
// ─────────────────────────────────────────────────────────────────────────────

const { authenticate } = require('../../middleware/authenticate');
const { getPrisma }    = require('../../lib/prisma');
const { encrypt, decrypt } = require('../../lib/crypto');
const {
  refreshGmailToken,
  ensureLabel,
  applyLabel,
  sendEmail,
} = require('../../services/gmail');
const { getPool } = require('../../db/pool');

const APP_URL = process.env.APP_URL || 'https://creatrbase.com';

// Gmail scopes required — send + modify (for labeling + reading threads)
const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
].join(' ');

// ── Resolve creator from JWT ──────────────────────────────────────────────────

async function resolveCreator(userId, tenantId) {
  const prisma = getPrisma();
  return prisma.creator.findFirst({
    where:  { userId, tenantId },
    select: { id: true, displayName: true },
  });
}

// ── Token freshness check + refresh ──────────────────────────────────────────

async function getFreshToken(gmailConn) {
  const prisma = getPrisma();
  const bufferMs = 5 * 60 * 1000;
  const needsRefresh = gmailConn.tokenExpiresAt &&
    (gmailConn.tokenExpiresAt.getTime() - Date.now() < bufferMs);

  if (!needsRefresh) return decrypt(gmailConn.accessToken);

  if (!gmailConn.refreshToken) throw new Error('Gmail token expired and no refresh token');

  const refreshed = await refreshGmailToken(decrypt(gmailConn.refreshToken));
  await prisma.gmailConnection.update({
    where: { id: gmailConn.id },
    data:  {
      accessToken:    encrypt(refreshed.accessToken),
      tokenExpiresAt: refreshed.expiresAt,
    },
  });
  return refreshed.accessToken;
}

// ─────────────────────────────────────────────────────────────────────────────

async function gmailRoutes(app) {

  // ── GET /api/gmail/connect ────────────────────────────────────────────────

  app.get('/api/gmail/connect', { preHandler: authenticate }, async (req, reply) => {
    const params = new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID,
      redirect_uri:  `${APP_URL}/api/gmail/callback`,
      response_type: 'code',
      scope:         GMAIL_SCOPES,
      access_type:   'offline',
      prompt:        'consent',
      state:         req.user.userId, // passed through to callback for identity check
    });
    return reply.redirect(
      `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
    );
  });

  // ── GET /api/gmail/callback ───────────────────────────────────────────────

  app.get('/api/gmail/callback', { preHandler: authenticate }, async (req, reply) => {
    const { code, error } = req.query;

    if (error || !code) {
      return reply.redirect('/connections?gmail_error=denied');
    }

    let tokenData;
    try {
      const params = new URLSearchParams({
        code,
        client_id:     process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri:  `${APP_URL}/api/gmail/callback`,
        grant_type:    'authorization_code',
      });
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    params.toString(),
      });
      if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`);
      tokenData = await res.json();
    } catch (err) {
      app.log.error({ err }, 'Gmail callback token exchange failed');
      return reply.redirect('/connections?gmail_error=token_exchange');
    }

    const accessToken  = tokenData.access_token;
    const refreshToken = tokenData.refresh_token ?? null;
    const expiresAt    = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000)
      : null;

    // Get Gmail address
    let gmailAddress;
    try {
      const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const profile = await profileRes.json();
      gmailAddress = profile.emailAddress;
    } catch {
      return reply.redirect('/connections?gmail_error=profile_fetch');
    }

    // Create Creatrbase label
    let labelId;
    try {
      labelId = await ensureLabel(accessToken);
    } catch (err) {
      app.log.warn({ err }, 'Gmail label creation failed — proceeding without label');
    }

    const prisma  = getPrisma();
    const creator = await resolveCreator(req.user.userId, req.user.tenantId);
    if (!creator) return reply.redirect('/connections?gmail_error=no_creator');

    await prisma.gmailConnection.upsert({
      where:  { creatorId: creator.id },
      create: {
        tenantId:       req.user.tenantId,
        creatorId:      creator.id,
        gmailAddress,
        accessToken:    encrypt(accessToken),
        refreshToken:   refreshToken ? encrypt(refreshToken) : null,
        tokenExpiresAt: expiresAt,
        labelId,
      },
      update: {
        gmailAddress,
        accessToken:    encrypt(accessToken),
        refreshToken:   refreshToken ? encrypt(refreshToken) : null,
        tokenExpiresAt: expiresAt,
        labelId,
      },
    });

    return reply.redirect('/connections?gmail_connected=1');
  });

  // ── GET /api/gmail/status ─────────────────────────────────────────────────

  app.get('/api/gmail/status', { preHandler: authenticate }, async (req) => {
    const prisma  = getPrisma();
    const creator = await resolveCreator(req.user.userId, req.user.tenantId);
    if (!creator) return { connected: false };

    const conn = await prisma.gmailConnection.findUnique({
      where:  { creatorId: creator.id },
      select: { gmailAddress: true, connectedAt: true },
    });

    return conn
      ? { connected: true, gmailAddress: conn.gmailAddress, connectedAt: conn.connectedAt }
      : { connected: false };
  });

  // ── DELETE /api/gmail/disconnect ──────────────────────────────────────────

  app.delete('/api/gmail/disconnect', { preHandler: authenticate }, async (req, reply) => {
    const prisma  = getPrisma();
    const creator = await resolveCreator(req.user.userId, req.user.tenantId);
    if (!creator) return reply.code(404).send({ error: 'Creator not found' });

    await prisma.gmailConnection.deleteMany({ where: { creatorId: creator.id } });
    return { ok: true };
  });

  // ── POST /api/brands/:brandId/send-email ──────────────────────────────────
  // Sends outreach email via creator's connected Gmail account.
  // Body: { to, subject, body, readinessAcknowledged }

  app.post('/api/brands/:brandId/send-email', { preHandler: authenticate }, async (req, reply) => {
    const { brandId } = req.params;
    const { to, subject, body: emailBody, readinessAcknowledged = false } = req.body ?? {};

    if (!to || !subject || !emailBody) {
      return reply.code(400).send({ error: 'to, subject, and body are required.' });
    }

    if (!readinessAcknowledged) {
      return reply.code(400).send({ error: 'You must acknowledge the readiness warning before sending.' });
    }

    const prisma  = getPrisma();
    const creator = await resolveCreator(req.user.userId, req.user.tenantId);
    if (!creator) return reply.code(404).send({ error: 'Creator not found.' });

    // Check Gmail is connected
    const gmailConn = await prisma.gmailConnection.findUnique({
      where: { creatorId: creator.id },
    });
    if (!gmailConn) {
      return reply.code(400).send({ error: 'Gmail not connected. Connect your Gmail account on the Connections page first.' });
    }

    // Get fresh access token
    let accessToken;
    try {
      accessToken = await getFreshToken(gmailConn);
    } catch (err) {
      app.log.error({ err }, 'Gmail token refresh failed');
      return reply.code(400).send({ error: 'Gmail token expired. Please reconnect your Gmail account.' });
    }

    // Send email
    let messageId, threadId;
    try {
      const result = await sendEmail({
        accessToken,
        from:    `${creator.displayName} <${gmailConn.gmailAddress}>`,
        to,
        subject,
        body:    emailBody,
      });
      messageId = result.messageId;
      threadId  = result.threadId;
    } catch (err) {
      app.log.error({ err }, 'Gmail send failed');
      return reply.code(502).send({ error: 'Failed to send email. Please try again.' });
    }

    // Apply Creatrbase label
    if (gmailConn.labelId) {
      try {
        await applyLabel(accessToken, messageId, gmailConn.labelId);
      } catch (err) {
        app.log.warn({ err }, 'Gmail label apply failed — non-fatal');
      }
    }

    // Log outreach interaction with thread ID
    const pool = getPool();
    await pool.query(
      `INSERT INTO brand_creator_interactions
         (brand_id, creator_id, tenant_id, niche, geo, interaction_type,
          interaction_date, evidence_type, confidence, deal_notes,
          is_public, created_by, gmail_thread_id, gmail_message_id)
       VALUES ($1, $2, $3, 'general', 'global', 'outreach_sent',
               CURRENT_DATE, 'user_reported', 'high', NULL,
               FALSE, $4, $5, $6)`,
      [brandId, creator.id, req.user.tenantId, req.user.userId, threadId, messageId]
    );

    app.log.info({ creatorId: creator.id, brandId, threadId }, 'Outreach email sent via Gmail');
    return { ok: true, threadId, gmailAddress: gmailConn.gmailAddress };
  });
}

module.exports = { gmailRoutes };
