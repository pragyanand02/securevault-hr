const AuditLog = require('../models/AuditLog');
const { verifyChain, getChainState } = require('../utils/auditChain');
const { logEvent } = require('../middleware/auditLogger');

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// @route GET /api/audit-logs  (Admin only)
exports.getAuditLogs = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const filter = {};

    if (req.query.action) filter.action = req.query.action;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.severity) filter.severity = req.query.severity;
    if (req.query.targetId) filter.targetId = String(req.query.targetId);

    if (req.query.actor) {
      const rx = new RegExp(escapeRegex(req.query.actor), 'i');
      filter.$or = [{ actorEmail: rx }, { actorName: rx }];
    }

    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
    }

    if (req.query.search) {
      const rx = new RegExp(escapeRegex(req.query.search), 'i');
      filter.$and = [
        ...(filter.$and || []),
        { $or: [{ details: rx }, { action: rx }, { actorEmail: rx }, { targetId: rx }] },
      ];
    }

    const [total, logs] = await Promise.all([
      AuditLog.countDocuments(filter),
      AuditLog.find(filter).sort({ sequence: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ]);

    await logEvent({
      req,
      action: 'AUDIT_TRAIL_VIEWED',
      category: 'SYSTEM',
      severity: 'warning',
      details: `Admin viewed the audit trail (page ${page})`,
      metadata: { filters: Object.keys(filter), page, limit },
    });

    return res.status(200).json({
      data: logs,
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
      chain: await getChainState(),
    });
  } catch (error) {
    return next(error);
  }
};

// @route GET /api/audit-logs/verify  (Admin only)
exports.verifyAuditChain = async (req, res, next) => {
  try {
    const result = await verifyChain({ limit: Math.min(20000, Number(req.query.limit) || 10000) });
    await logEvent({
      req,
      action: 'AUDIT_CHAIN_VERIFIED',
      category: 'SYSTEM',
      severity: result.valid ? 'info' : 'critical',
      details: result.valid
        ? 'Audit hash chain verified successfully'
        : `Audit hash chain verification FAILED: ${result.reason}`,
      metadata: { valid: result.valid, total: result.total, brokenAtSequence: result.brokenAtSequence || null },
    });
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

// @route GET /api/audit-logs/stats  (Admin only)
exports.getAuditStats = async (_req, res, next) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [total, last24h, byCategory, bySeverity, sensitiveAccess, failedLogins] = await Promise.all([
      AuditLog.countDocuments(),
      AuditLog.countDocuments({ createdAt: { $gte: since } }),
      AuditLog.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
      AuditLog.aggregate([{ $group: { _id: '$severity', count: { $sum: 1 } } }]),
      AuditLog.countDocuments({
        action: 'SENSITIVE_FIELDS_DECRYPTED',
        createdAt: { $gte: since },
      }),
      AuditLog.countDocuments({
        action: 'AUTH_LOGIN_FAILED',
        createdAt: { $gte: since },
      }),
    ]);

    return res.status(200).json({
      total,
      last24h,
      sensitiveAccessLast24h: sensitiveAccess,
      failedLoginsLast24h: failedLogins,
      byCategory: byCategory.map((c) => ({ category: c._id, count: c.count })),
      bySeverity: bySeverity.map((s) => ({ severity: s._id, count: s.count })),
      chain: await getChainState(),
    });
  } catch (error) {
    return next(error);
  }
};
