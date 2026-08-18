// AES-256 field-level encryption for sensitive data (salary, bank details)
const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';

const getKey = () => {
  const secret = process.env.AES_SECRET_KEY || 'securevault-hr-default-secret-key-32';
  return crypto.createHash('sha256').update(secret).digest();
};

exports.encrypt = (text) => {
  if (text === undefined || text === null || text === '') return text;
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
    let encrypted = cipher.update(String(text), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  } catch (err) {
    console.error('Encryption error:', err.message);
    return text;
  }
};

exports.decrypt = (encryptedText) => {
  if (!encryptedText || typeof encryptedText !== 'string' || !encryptedText.includes(':')) {
    return encryptedText;
  }
  try {
    const [ivHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Decryption error:', err.message);
    return encryptedText;
  }
};

