const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

process.env.AES_SECRET_KEY = 'test-only-secret-key-that-is-long-enough-123456';
process.env.AES_KEY_ID = 'k1';

const { encrypt, decrypt, isEncrypted } = require('../utils/encryption');

test('AES-256-GCM round-trips a sensitive value', () => {
  const plaintext = 'AC: 50100234567891 / IFSC: HDFC0000123';
  const ciphertext = encrypt(plaintext);

  assert.notEqual(ciphertext, plaintext);
  assert.ok(ciphertext.startsWith('v2:k1:'), 'new payloads must use the v2 keyed format');
  assert.equal(decrypt(ciphertext), plaintext);
});

test('every encryption uses a fresh IV', () => {
  const a = encrypt('same value');
  const b = encrypt('same value');
  assert.notEqual(a, b);
  assert.equal(decrypt(a), 'same value');
  assert.equal(decrypt(b), 'same value');
});

test('tampered ciphertext is rejected by the GCM auth tag', () => {
  const ciphertext = encrypt('78000');
  const parts = ciphertext.split(':');
  // Flip the last hex character of the ciphertext.
  const last = parts[4];
  const tamperedLast = `${last.slice(0, -1)}${last.endsWith('a') ? 'b' : 'a'}`;
  const tampered = [...parts.slice(0, 4), tamperedLast].join(':');

  assert.throws(() => decrypt(tampered), /auth|tag|unable|malformed/i);
});

test('legacy AES-CBC values from v1 can still be read', () => {
  const key = crypto.createHash('sha256').update(process.env.AES_SECRET_KEY).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const body = Buffer.concat([cipher.update('legacy-salary', 'utf8'), cipher.final()]);
  const legacy = `${iv.toString('hex')}:${body.toString('hex')}`;

  assert.equal(isEncrypted(legacy), true);
  assert.equal(decrypt(legacy), 'legacy-salary');
});

test('plaintext legacy values and empty values are handled safely', () => {
  assert.equal(decrypt('not-encrypted-yet'), 'not-encrypted-yet');
  assert.equal(decrypt(null), null);
  assert.equal(encrypt(''), '');
});
