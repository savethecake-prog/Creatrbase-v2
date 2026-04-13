'use strict';

// ─── AES-256-GCM token encryption ────────────────────────────────────────────
// Used to encrypt OAuth access/refresh tokens before writing to the database.
// ENCRYPTION_KEY must be a 32-byte value, base64-encoded.
// Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
//
// Wire format stored in the DB: "<iv_b64>:<auth_tag_b64>:<ciphertext_b64>"
// ─────────────────────────────────────────────────────────────────────────────

const crypto = require('crypto');

const ALGORITHM  = 'aes-256-gcm';
const IV_LENGTH  = 12;   // 96-bit IV — recommended for GCM
const TAG_LENGTH = 16;   // 128-bit auth tag

function getKey() {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error('ENCRYPTION_KEY environment variable is not set');
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must decode to exactly 32 bytes (generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))")');
  }
  return key;
}

/**
 * Encrypt a plaintext string with AES-256-GCM.
 * Returns "<iv_b64>:<auth_tag_b64>:<ciphertext_b64>"
 */
function encrypt(plaintext) {
  const key    = getKey();
  const iv     = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

/**
 * Decrypt a value produced by encrypt().
 * Returns the original plaintext string.
 */
function decrypt(encoded) {
  const key   = getKey();
  const parts = encoded.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted token format — expected iv:tag:ciphertext');

  const [ivB64, tagB64, dataB64] = parts;
  const iv         = Buffer.from(ivB64,  'base64');
  const tag        = Buffer.from(tagB64, 'base64');
  const ciphertext = Buffer.from(dataB64,'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8');
}

module.exports = { encrypt, decrypt };
