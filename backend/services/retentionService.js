const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const DataRequest = require('../models/DataRequest');
const { appendAudit } = require('../utils/auditChain');

const RETENTION_YEARS = Number(process.env.RETENTION_YEARS || 7);

// A record is eligible for retention purge only when it has been soft-deleted
// AND its statutory window has actually ended. Active employees are never
// eligible, which is the rule that stops "delete on request" from breaking
// payroll-record obligations.
const isRetentionExpired = (user, now = new Date()) => {
  if (!user || !user.isDeleted || !user.retentionUntil) return false;
  const until = new Date(user.retentionUntil);
  if (Number.isNaN(until.getTime())) return false;
  return until <= new Date(now);
};

// Replaces direct identifiers with non-reversible placeholders while leaving
// the record (and the audit trail) referentially intact.
const anonymiseUser = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return null;

  user.name = 'Erased Data Principal';
  user.email = `erased+${user._id}@invalid.local`;
  user.password = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
  user.department = null;
  user.designation = null;
  user.employeeCode = null;
  user.salary = undefined;
  user.bankDetails = undefined;
  user.isActive = false;
  user.isDeleted = true;
  user.deletedAt = user.deletedAt || new Date();
  user.tokenVersion += 1;
  user.refreshTokenHash = null;
  user.refreshTokenExpiresAt = null;
  await user.save();
  return user;
};

// Idempotent sweep. Dry-run by default; `--apply` performs the purge.
const runRetentionSweep = async ({ dryRun = true, now = new Date(), actor = null } = {}) => {
  const candidates = await User.find({
    isDeleted: true,
    retentionUntil: { $ne: null, $lte: new Date(now) },
    email: { $not: /^erased\+/ },
  })
    .select('name email isDeleted retentionUntil')
    .lean();

  const eligible = candidates.filter((user) => isRetentionExpired(user, now));
  const processed = [];

  for (const user of eligible) {
    if (!dryRun) {
      await anonymiseUser(user._id);
      await appendAudit({
        actor: actor?.id || null,
        actorName: actor?.name || 'Retention automation',
        actorEmail: actor?.email || null,
        actorRole: actor?.role || 'system',
        action: 'RETENTION_PURGED',
        category: 'PRIVACY',
        severity: 'critical',
        targetId: String(user._id),
        targetType: 'User',
        details: 'Retention window ended; record anonymised by the scheduled sweep',
        metadata: { retentionUntil: user.retentionUntil, retentionYears: RETENTION_YEARS },
      });
    }
    processed.push({
      id: String(user._id),
      name: user.name,
      email: user.email,
      retentionUntil: user.retentionUntil,
    });
  }

  const overdueRequests = await DataRequest.find({
    status: { $in: ['pending', 'in_review'] },
    dueAt: { $lte: new Date(now) },
  })
    .select('_id type dueAt user')
    .lean();

  return {
    dryRun,
    ranAt: new Date(now).toISOString(),
    retentionYears: RETENTION_YEARS,
    eligible: processed.length,
    anonymised: dryRun ? 0 : processed.length,
    records: processed,
    overdueRequests: overdueRequests.length,
    overdueRequestIds: overdueRequests.map((request) => String(request._id)),
  };
};

module.exports = {
  RETENTION_YEARS,
  isRetentionExpired,
  anonymiseUser,
  runRetentionSweep,
};
