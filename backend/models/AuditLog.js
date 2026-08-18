const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true }, // e.g. "UPDATE_EMPLOYEE", "DELETE_EMPLOYEE", "APPROVE_LEAVE"
  targetId: { type: mongoose.Schema.Types.ObjectId }, // id of the record affected
  details: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('AuditLog', auditLogSchema);
