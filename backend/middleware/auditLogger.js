const { appendAudit } = require('../utils/auditChain');
const { getClientIp, getUserAgent } = require('../utils/request');

// Single entry point for every audit event.
// Never pass raw salary/bank values in `details` or `metadata` - log field names
// and record ids, not the protected data itself.
exports.logEvent = async ({
  req,
  actor,
  action,
  category = 'SYSTEM',
  severity = 'info',
  targetId = null,
  targetType = null,
  details = '',
  metadata = {},
}) => {
  const current = actor || req?.user || null;

  try {
    return await appendAudit({
      actor: current?.id || null,
      actorName: current?.name || 'System',
      actorEmail: current?.email || null,
      actorRole: current?.role || 'system',
      action,
      category,
      severity,
      targetId,
      targetType,
      details,
      metadata,
      ip: req ? getClientIp(req) : null,
      userAgent: req ? getUserAgent(req) : null,
    });
  } catch (error) {
    // Audit failure must be visible in logs, but should not crash the request.
    console.error('AUDIT LOG FAILURE:', error.message);
    return null;
  }
};
