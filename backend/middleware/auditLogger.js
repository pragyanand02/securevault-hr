const AuditLog = require('../models/AuditLog');

// Call this helper inside controllers after a sensitive action succeeds
exports.logAction = async (userId, action, targetId, details = '') => {
  try {
    await AuditLog.create({ user: userId, action, targetId, details });
  } catch (error) {
    console.log('Audit log error:', error.message);
  }
};
