'use strict';

// ─── Unsubscribe route ────────────────────────────────────────────────────────
//
// GET  /api/unsubscribe?token=<hex>&uid=<userId>
//   Verifies HMAC token, sets notifications_opt_out = true on the creator,
//   returns a confirmation page.
//
// POST /api/unsubscribe?token=<hex>&uid=<userId>
//   RFC 8058 one-click endpoint — email clients fire this automatically when
//   the user clicks "Unsubscribe" in the email header UI.
// ─────────────────────────────────────────────────────────────────────────────

const { getPrisma }    = require('../../lib/prisma');
const { verifyToken }  = require('../../services/unsubscribeToken');

const APP_URL = process.env.APP_URL || 'https://creatrbase.com';

function successHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Unsubscribed — Creatrbase</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#05040A;color:#F5F4FF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
    .card{max-width:480px;width:100%;background:#111019;border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:48px 40px;text-align:center}
    .logo{font-size:22px;font-weight:900;color:#9EFFD8;letter-spacing:-0.02em;margin-bottom:32px}
    h1{font-size:28px;font-weight:800;color:#F5F4FF;margin-bottom:12px}
    p{font-size:15px;color:#9B99B0;line-height:1.6;margin-bottom:24px}
    a{display:inline-block;background:#9EFFD8;color:#05040A;font-size:13px;font-weight:700;padding:10px 24px;border-radius:999px;text-decoration:none}
  </style>
</head>
<body>
  <div class="card">
    <p class="logo">creatrbase</p>
    <h1>You're unsubscribed</h1>
    <p>You've been removed from product notification emails. You can re-enable them from your account settings at any time.</p>
    <a href="${APP_URL}">Back to Creatrbase</a>
  </div>
</body>
</html>`;
}

function errorHtml(message) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Unsubscribe Error — Creatrbase</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#05040A;color:#F5F4FF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
    .card{max-width:480px;width:100%;background:#111019;border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:48px 40px;text-align:center}
    .logo{font-size:22px;font-weight:900;color:#9EFFD8;letter-spacing:-0.02em;margin-bottom:32px}
    h1{font-size:24px;font-weight:800;color:#F5F4FF;margin-bottom:12px}
    p{font-size:15px;color:#9B99B0;line-height:1.6;margin-bottom:24px}
    a{display:inline-block;background:#9EFFD8;color:#05040A;font-size:13px;font-weight:700;padding:10px 24px;border-radius:999px;text-decoration:none}
  </style>
</head>
<body>
  <div class="card">
    <p class="logo">creatrbase</p>
    <h1>Something went wrong</h1>
    <p>${message}</p>
    <a href="${APP_URL}">Back to Creatrbase</a>
  </div>
</body>
</html>`;
}

async function unsubscribeCreator(uid) {
  const prisma  = getPrisma();
  const creator = await prisma.creator.findFirst({
    where:  { userId: uid },
    select: { id: true },
  });
  if (creator) {
    await prisma.creator.update({
      where: { id: creator.id },
      data:  { notificationsOptOut: true },
    });
  }
}

async function routes(fastify) {
  // Manual click from email footer
  fastify.get('/api/unsubscribe', async (req, reply) => {
    const { token, uid } = req.query;
    if (!token || !uid) {
      return reply.code(400).type('text/html').send(errorHtml('Invalid unsubscribe link.'));
    }
    if (!verifyToken(uid, token)) {
      return reply.code(400).type('text/html').send(errorHtml('This unsubscribe link is invalid or has expired.'));
    }
    await unsubscribeCreator(uid);
    return reply.type('text/html').send(successHtml());
  });

  // RFC 8058 one-click — email clients fire this automatically
  fastify.post('/api/unsubscribe', async (req, reply) => {
    const { token, uid } = req.query;
    if (!token || !uid || !verifyToken(uid, token)) {
      return reply.code(400).send({ error: 'Invalid' });
    }
    await unsubscribeCreator(uid);
    return reply.code(200).send({ ok: true });
  });
}

module.exports = routes;
