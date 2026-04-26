'use strict';

// ─── Unsubscribe token helper ──────────────────────────────────────────────────
//
// Generates and verifies HMAC-SHA256 tokens for one-click unsubscribe URLs.
// Token = HMAC(userId + ':unsub')  — scoped to unsubscribe so it cannot be
// reused for any other signed-URL purpose even if the secret leaks from one use.
//
// URL shape:  /api/unsubscribe?token=<hex64>&uid=<userId>
// ─────────────────────────────────────────────────────────────────────────────

const crypto = require('crypto');

function getSecret() {
  const s = process.env.UNSUBSCRIBE_SECRET || process.env.JWT_SECRET || process.env.SESSION_SECRET;
  if (!s) throw new Error('No signing secret configured (set UNSUBSCRIBE_SECRET)');
  return s;
}

function generateToken(userId) {
  return crypto.createHmac('sha256', getSecret()).update(userId + ':unsub').digest('hex');
}

function verifyToken(userId, token) {
  if (!token || token.length !== 64) return false;
  try {
    const expected = generateToken(userId);
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(token,    'hex'),
    );
  } catch (_) {
    return false;
  }
}

async function isOptedOut(prisma, creatorId) {
  const row = await prisma.creator.findUnique({
    where:  { id: creatorId },
    select: { notificationsOptOut: true },
  });
  return row?.notificationsOptOut === true;
}

module.exports = { generateToken, verifyToken, isOptedOut };
