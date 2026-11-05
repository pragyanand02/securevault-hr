const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  sequence: { type: Number, required: true, unique: true, index: true },

  // Actor is denormalised so the trail survives user deletion/anonymisation.
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  actorName: { type: String, default: 'System' },
  actorEmail: { type: String, default: null },
  actorRole: { type: String, default: 'system' },

  action: { type: String, required: true, index: true },
  category: {
    type: String,
    enum: ['AUTH', 'EMPLOYEE', 'LEAVE', 'PRIVACY', 'ACCESS', 'SYSTEM'],
    default: 'SYSTEM',
    index: true,
  },
  severity: {
    type: String,
    enum: ['info', 'warning', 'critical'],
    default: 'info',
    index: true,
  },

  targetId: { type: String, default: null },
  targetType: { type: String, default: null },
  details: { type: String, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },

  ip: { type: String, default: null },
  userAgent: { type: String, default: null },

  // Tamper-evident hash chain
  prevHash: { type: String, required: true },
  hash: { type: String, required: true, index: true },

  createdAt: { type: Date, default: Date.now, index: true },
}, { versionKey: false });

// Application-level append-only guard. Direct database access can still be
// simulated for the tamper-detection demo; verifyChain() catches it.
auditLogSchema.pre('save', function guardSave(next) {
  if (!this.isNew) return next(new Error('Audit logs are append-only and cannot be modified'));
  return next();
});
for (const operation of ['updateOne', 'updateMany', 'findOneAndUpdate', 'deleteOne', 'deleteMany', 'findOneAndDelete']) {
  auditLogSchema.pre(operation, function guardMutation() {
    throw new Error('Audit logs are append-only and cannot be modified or deleted');
  });
}

auditLogSchema.index({ category: 1, createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
