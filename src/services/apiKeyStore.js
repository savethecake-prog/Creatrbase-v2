'use strict';

const crypto = require('crypto');

const ALGORITHM  = 'aes-256-gcm';
const IV_LENGTH  = 16;
const TAG_LENGTH = 16;

function getEncryptionKey() {
  const raw = process.env.API_KEY_ENCRYPTION_SECRET;
  if (!raw) throw new Error('API_KEY_ENCRYPTION_SECRET env var not set');
  // Accept 64-char hex (32 bytes) or 32-char raw string
  return raw.length === 64 ? Buffer.from(raw, 'hex') : Buffer.from(raw.padEnd(32, '0').slice(0, 32));
}

function encrypt(plaintext) {
  const key = getEncryptionKey();
  const iv  = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

function decrypt(stored) {
  const key = getEncryptionKey();
  const [ivB64, tagB64, dataB64] = stored.split(':');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Malformed encrypted value');
  const iv        = Buffer.from(ivB64,  'base64');
  const tag       = Buffer.from(tagB64, 'base64');
  const encrypted = Buffer.from(dataB64,'base64');
  const decipher  = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

function mask(rawKey) {
  if (!rawKey || rawKey.length < 12) return '***';
  return `${rawKey.slice(0, 10)}...${rawKey.slice(-4)}`;
}

module.exports = { encrypt, decrypt, mask };
