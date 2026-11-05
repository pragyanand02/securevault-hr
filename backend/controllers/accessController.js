const AccessGrant = require('../models/AccessGrant');
const User = require('../models/User');
const { logEvent } = require('../middleware/auditLogger');

const expireStale = () => AccessGrant.updateMany(
  { status: 'approved', expiresAt: { $lt: new Date() } },
  { $set: { status: 'expired' } }
);

// @route POST /api/access/requests
exports.requestAccess = async (req, res, next) => {
  try {
    const { reason, field = 'sensitive_fields', scope = 'department' } = req.body;

    if (!['admin', 'hr_manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only HR/Admin roles can request elevated access' });
    }

    const existing = await AccessGrant.findOne({
      grantee: req.user.id,
      status: { $in: ['pending', 'approved'] },
      $or: [{ field }, { field: 'sensitive_fields' }],
    });
    if (existing && existing.status === 'approved' && existing.expiresAt > new Date()) {
      return res.status(409).json({ message: 'You already have an active grant', grant: existing });
    }
    if (existing && existing.status === 'pending') {
      return res.status(409).json({ message: 'You already have a pending request', grant: existing });
    }

    const grant = await AccessGrant.create({
      grantee: req.user.id,
      field,
      scope,
      reason,
    });

    await logEvent({
      req,
      action: 'JIT_ACCESS_REQUESTED',
      category: 'ACCESS',
      severity: 'warning',
      targetId: grant._id,
      targetType: 'AccessGrant',
      details: `Requested time-bound access to ${field} (${scope})`,
      metadata: { field, scope, reason },
    });

    return res.status(201).json({ message: 'Access request submitted for admin review', grant });
  } catch (error) {
    return next(error);
  }
};

// @route GET /api/access/requests/me
exports.getMyGrants = async (req, res, next) => {
  try {
    await expireStale();
    const grants = await AccessGrant.find({ grantee: req.user.id }).sort({ createdAt: -1 }).limit(50);
    return res.status(200).json(grants);
  } catch (error) {
    return next(error);
  }
};

// @route GET /api/access/active
exports.getActiveGrant = async (req, res, next) => {
  try {
    await expireStale();
    const grant = await AccessGrant.findOne({
      grantee: req.user.id,
      status: 'approved',
      expiresAt: { $gt: new Date() },
    }).sort({ expiresAt: -1 });
    return res.status(200).json({ grant: grant || null });
  } catch (error) {
    return next(error);
  }
};

// @route GET /api/access/requests  (Admin)
exports.getAllGrants = async (_req, res, next) => {
  try {
    await expireStale();
    const grants = await AccessGrant.find()
      .populate('grantee', 'name email role department isActive isDeleted')
      .populate('reviewedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(200);
    return res.status(200).json(grants);
  } catch (error) {
    return next(error);
  }
};

// @route PUT /api/access/requests/:id/review  (Admin)
exports.reviewAccess = async (req, res, next) => {
  try {
    const { status, durationMinutes = 60, reviewNote } = req.body;

    const grant = await AccessGrant.findById(req.params.id).populate('grantee', 'name email role department isActive isDeleted');
    if (!grant) return res.status(404).json({ message: 'Access request not found' });
    if (grant.status !== 'pending') {
      return res.status(409).json({ message: `Request is already ${grant.status}` });
    }
    if (grant.grantee?._id?.toString() === req.user.id) {
      return res.status(403).json({ message: 'You cannot approve your own access request' });
    }
    if (!grant.grantee || grant.grantee.isDeleted || !grant.grantee.isActive) {
      return res.status(400).json({ message: 'Grantee account is not active' });
    }

    grant.status = status;
    grant.reviewedBy = req.user.id;
    grant.reviewedAt = new Date();
    grant.reviewNote = reviewNote || '';
    grant.expiresAt = status === 'approved'
      ? new Date(Date.now() + durationMinutes * 60 * 1000)
      : null;
    await grant.save();

    await logEvent({
      req,
      action: status === 'approved' ? 'JIT_ACCESS_APPROVED' : 'JIT_ACCESS_DENIED',
      category: 'ACCESS',
      severity: status === 'approved' ? 'critical' : 'warning',
      targetId: grant._id,
      targetType: 'AccessGrant',
      details: status === 'approved'
        ? `Approved ${grant.field} access for ${grant.grantee.email} until ${grant.expiresAt.toISOString()}`
        : `Denied ${grant.field} access request for ${grant.grantee.email}`,
      metadata: {
        field: grant.field,
        scope: grant.scope,
        durationMinutes: status === 'approved' ? durationMinutes : null,
      },
    });

    return res.status(200).json({ message: `Access request ${status}`, grant });
  } catch (error) {
    return next(error);
  }
};

// @route DELETE /api/access/requests/:id  (Admin revoke)
exports.revokeAccess = async (req, res, next) => {
  try {
    const grant = await AccessGrant.findById(req.params.id);
    if (!grant) return res.status(404).json({ message: 'Access grant not found' });
    if (grant.status !== 'approved') {
      return res.status(409).json({ message: `Only an approved grant can be revoked (current: ${grant.status})` });
    }

    grant.status = 'revoked';
    grant.reviewedBy = req.user.id;
    grant.reviewedAt = new Date();
    await grant.save();

    await logEvent({
      req,
      action: 'JIT_ACCESS_REVOKED',
      category: 'ACCESS',
      severity: 'critical',
      targetId: grant._id,
      targetType: 'AccessGrant',
      details: 'Time-bound access grant revoked early',
    });

    return res.status(200).json({ message: 'Access grant revoked', grant });
  } catch (error) {
    return next(error);
  }
};
