const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const ACCESS_TTL = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_DAYS = Number(process.env.JWT_REFRESH_EXPIRES_DAYS || 7);

const basePayload = (user) => ({
  id: user._id.toString(),
  role: user.role,
  tokenVersion: user.tokenVersion || 0,
});

exports.signAccessToken = (user) =>
  jwt.sign(
    { ...basePayload(user), type: 'access' },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TTL, issuer: 'securevault-hr', audience: 'securevault-web' }
  );

exports.signRefreshToken = (user) =>
  jwt.sign(
    { ...basePayload(user), type: 'refresh' },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: `${REFRESH_DAYS}d`, issuer: 'securevault-hr', audience: 'securevault-web' }
  );

exports.hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

exports.refreshCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/api/auth',
  maxAge: REFRESH_DAYS * 24 * 60 * 60 * 1000,
});

exports.clearCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/api/auth',
});

exports.accessTtlSeconds = () => {
  const match = /^(\d+)([smhd])$/.exec(ACCESS_TTL);
  if (!match) return 900;
  const amount = Number(match[1]);
  const unit = match[2];
  return amount * { s: 1, m: 60, h: 3600, d: 86400 }[unit];
};

exports.refreshExpiryDate = () =>
  new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);

exports.publicUser = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
  department: user.department || '',
  designation: user.designation || '',
});
