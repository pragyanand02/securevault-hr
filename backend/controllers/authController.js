const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { ensureDefaultConsents } = require('../services/consentService');
const {
  signAccessToken,
  signRefreshToken,
  hashToken,
  refreshCookieOptions,
  clearCookieOptions,
  accessTtlSeconds,
  publicUser,
  refreshExpiryDate,
} = require('../services/tokenService');
const { logEvent } = require('../middleware/auditLogger');
const { getClientIp, getUserAgent } = require('../utils/request');

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

const issueSession = async (user, res) => {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  user.refreshTokenHash = hashToken(refreshToken);
  user.refreshTokenExpiresAt = refreshExpiryDate();
  await user.save();

  res.cookie('refreshToken', refreshToken, refreshCookieOptions());

  return {
    accessToken,
    expiresIn: accessTtlSeconds(),
    user: publicUser(user),
  };
};

// @route POST /api/auth/register
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, department, acceptNotice } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: 'An account already exists with this email' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: 'employee', // public registration can never self-assign a privileged role
      department: department || '',
      noticeAcceptedAt: acceptNotice ? new Date() : null,
      noticeVersion: acceptNotice ? (process.env.PRIVACY_NOTICE_VERSION || '2026-11') : null,
    });

    await ensureDefaultConsents(user, { req });

    await logEvent({
      req,
      actor: { id: user._id.toString(), name: user.name, email: user.email, role: user.role },
      action: 'ACCOUNT_REGISTERED',
      category: 'AUTH',
      severity: 'info',
      targetId: user._id,
      targetType: 'User',
      details: `Employee self-registration (${user.email})`,
    });

    const session = await issueSession(user, res);
    return res.status(201).json({ message: 'Account created successfully', ...session });
  } catch (error) {
    return next(error);
  }
};

// @route POST /api/auth/login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user || user.isDeleted) {
      await logEvent({
        req,
        actor: { name: 'Unknown', email, role: 'anonymous' },
        action: 'AUTH_LOGIN_FAILED',
        category: 'AUTH',
        severity: 'warning',
        details: `Failed login for unknown/removed account (${email})`,
        metadata: { reason: 'unknown_account' },
      });
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'This account is inactive. Contact an administrator.' });
    }

    if (user.lockUntil && user.lockUntil > new Date()) {
      await logEvent({
        req,
        actor: { id: user._id.toString(), name: user.name, email: user.email, role: user.role },
        action: 'AUTH_LOGIN_BLOCKED',
        category: 'AUTH',
        severity: 'warning',
        targetId: user._id,
        targetType: 'User',
        details: 'Login attempt while account is temporarily locked',
      });
      return res.status(429).json({ message: 'Too many failed attempts. Try again later.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      user.failedLoginAttempts += 1;
      if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
        user.failedLoginAttempts = 0;
      }
      await user.save();

      await logEvent({
        req,
        actor: { id: user._id.toString(), name: user.name, email: user.email, role: user.role },
        action: 'AUTH_LOGIN_FAILED',
        category: 'AUTH',
        severity: 'warning',
        targetId: user._id,
        targetType: 'User',
        details: `Failed password attempt (${email})`,
        metadata: { lockUntil: user.lockUntil },
      });

      return res.status(401).json({ message: 'Invalid email or password' });
    }

    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.lastLoginAt = new Date();

    const session = await issueSession(user, res);

    await logEvent({
      req,
      actor: { id: user._id.toString(), name: user.name, email: user.email, role: user.role },
      action: 'AUTH_LOGIN_SUCCESS',
      category: 'AUTH',
      severity: 'info',
      targetId: user._id,
      targetType: 'User',
      details: `Successful login (${user.email})`,
      metadata: { ip: getClientIp(req), userAgent: getUserAgent(req) },
    });

    return res.status(200).json({ message: 'Login successful', ...session });
  } catch (error) {
    return next(error);
  }
};

// @route POST /api/auth/refresh
exports.refresh = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ message: 'No refresh session' });

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json({ message: 'Refresh session expired, please sign in again' });
    }

    if (decoded.type !== 'refresh') {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    const user = await User.findById(decoded.id);
    if (!user || user.isDeleted || !user.isActive) {
      return res.status(401).json({ message: 'Account is inactive or no longer exists' });
    }

    if (user.tokenVersion !== decoded.tokenVersion) {
      return res.status(401).json({ message: 'Session revoked, please sign in again' });
    }

    if (!user.refreshTokenHash || user.refreshTokenHash !== hashToken(token)) {
      return res.status(401).json({ message: 'Refresh token has already been used or revoked' });
    }

    if (user.refreshTokenExpiresAt && user.refreshTokenExpiresAt < new Date()) {
      return res.status(401).json({ message: 'Refresh session expired' });
    }

    // Refresh-token rotation: every refresh invalidates the previous token.
    const session = await issueSession(user, res);
    return res.status(200).json(session);
  } catch (error) {
    return next(error);
  }
};

// @route POST /api/auth/logout
exports.logout = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
        const user = await User.findById(decoded.id);
        if (user) {
          user.refreshTokenHash = null;
          user.refreshTokenExpiresAt = null;
          await user.save();

          await logEvent({
            req,
            actor: { id: user._id.toString(), name: user.name, email: user.email, role: user.role },
            action: 'AUTH_LOGOUT',
            category: 'AUTH',
            severity: 'info',
            targetId: user._id,
            targetType: 'User',
            details: 'User signed out',
          });
        }
      } catch {
        // Expired/invalid refresh token: still clear the cookie.
      }
    }

    res.clearCookie('refreshToken', clearCookieOptions());
    return res.status(200).json({ message: 'Logged out' });
  } catch (error) {
    return res.status(200).json({ message: 'Logged out' });
  }
};

// @route GET /api/auth/me
exports.me = async (req, res) => {
  res.status(200).json({ user: req.user });
};

// @route PUT /api/auth/password
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'Account not found' });

    const matches = await bcrypt.compare(currentPassword, user.password);
    if (!matches) return res.status(401).json({ message: 'Current password is incorrect' });

    user.password = await bcrypt.hash(newPassword, 12);
    user.tokenVersion += 1; // revoke every existing session
    user.refreshTokenHash = null;
    user.refreshTokenExpiresAt = null;
    await user.save();

    await logEvent({
      req,
      action: 'PASSWORD_CHANGED',
      category: 'AUTH',
      severity: 'warning',
      targetId: user._id,
      targetType: 'User',
      details: 'Password changed; all sessions revoked',
    });

    res.clearCookie('refreshToken', clearCookieOptions());
    return res.status(200).json({ message: 'Password changed. Please sign in again.' });
  } catch (error) {
    return next(error);
  }
};
