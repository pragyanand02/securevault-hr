// Field-level authenticated encryption for sensitive HR data.
//
// v2 format: v2:<keyId>:<ivHex>:<authTagHex>:<ciphertextHex>
//   - AES-256-GCM provides confidentiality AND integrity (tamper detection).
//   - A fresh 96-bit IV per record.
//   - AAD binds the ciphertext to the payload version + key id.
//   - Key ids allow rotation without re-encrypting the whole database at once.
//
// Legacy support: the first version of SecureVault used AES-256-CBC as
// "ivHex:ciphertextHex". We can still READ that format so existing data is not
// lost, but every new write uses v2. Use scripts/rotate-encryption.js to migrate.
const crypto = require('crypto');

const CURRENT_VERSION = 'v2';
const ALGORITHM = 'aes-256-gcm';
const LEGACY_ALGORITHM = 'aes-256-cbc';

const currentKeyId = () => process.env.AES_KEY_ID || 'k1';

const requireSecret = () => {
  const secret = process.env.AES_SECRET_KEY;
  if (!secret || secret.length < 32) {
    throw new Error('AES_SECRET_KEY is missing or shorter than 32 characters');
  }
  return secret;
};

// New keys are derived with the key id in the KDF input, so a rotated key
// never equals the previous key even if the operator reuses a passphrase.
const deriveKey = (secret, keyId) =>
  crypto.createHash('sha256').update(`${keyId}:${secret}`).digest();

const getKey = (keyId) => {
  const activeId = currentKeyId();
  if (keyId === activeId) return deriveKey(requireSecret(), keyId);

  const previousId = process.env.AES_KEY_ID_PREVIOUS || 'k0';
  if (keyId === previousId && process.env.AES_SECRET_KEY_PREVIOUS) {
    return deriveKey(process.env.AES_SECRET_KEY_PREVIOUS, keyId);
  }

  throw new Error(`No key material available for encryption key id "${keyId}"`);
};

// Legacy CBC key derivation (no key id) - read-only compatibility.
const getLegacyKey = () =>
  crypto.createHash('sha256').update(requireSecret()).digest();

exports.isEncrypted = (value) =>
  typeof value === 'string' && (value.startsWith(`${CURRENT_VERSION}:`) || /^[a-f0-9]{32}:[a-f0-9]+$/i.test(value));

exports.encrypt = (plaintext) => {
  if (plaintext === undefined || plaintext === null || plaintext === '') return plaintext;

  const keyId = currentKeyId();
  const iv = crypto.randomBytes(12); // 96-bit IV is the GCM recommendation
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(keyId), iv);
  cipher.setAAD(Buffer.from(`securevault:${CURRENT_VERSION}:${keyId}`, 'utf8'));

  const ciphertext = Buffer.concat([
    cipher.update(String(plaintext), 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    CURRENT_VERSION,
    keyId,
    iv.toString('hex'),
    authTag.toString('hex'),
    ciphertext.toString('hex'),
  ].join(':');
};

exports.decrypt = (payload) => {
  if (payload === undefined || payload === null || payload === '') return payload;
  if (typeof payload !== 'string') return payload;

  // v2 authenticated payload
  if (payload.startsWith(`${CURRENT_VERSION}:`)) {
    const parts = payload.split(':');
    if (parts.length !== 5) throw new Error('Malformed encrypted field');

    const [, keyId, ivHex, tagHex, ciphertextHex] = parts;
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      getKey(keyId),
      Buffer.from(ivHex, 'hex')
    );
    decipher.setAAD(Buffer.from(`securevault:${CURRENT_VERSION}:${keyId}`, 'utf8'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));

    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextHex, 'hex')),
      decipher.final(),
    ]).toString('utf8');
  }

  // Legacy CBC payload (ivHex:ciphertextHex)
  if (/^[a-f0-9]{32}:[a-f0-9]+$/i.test(payload)) {
    const [ivHex, ciphertextHex] = payload.split(':');
    const decipher = crypto.createDecipheriv(
      LEGACY_ALGORITHM,
      getLegacyKey(),
      Buffer.from(ivHex, 'hex')
    );
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextHex, 'hex')),
      decipher.final(),
    ]).toString('utf8');
  }

  // Old plaintext value from before encryption was introduced.
  return payload;
};

// Controllers should use this so one corrupt record cannot break an entire list.
exports.safeDecrypt = (payload) => {
  try {
    return exports.decrypt(payload);
  } catch (error) {
    console.error('Decryption failed (possible tampering or wrong key):', error.message);
    return null;
  }
};

exports.encryptionInfo = () => ({
  algorithm: ALGORITHM,
  keyId: currentKeyId(),
  version: CURRENT_VERSION,
  rotationSupported: Boolean(process.env.AES_SECRET_KEY_PREVIOUS),
});
