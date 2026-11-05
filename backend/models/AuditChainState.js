const mongoose = require('mongoose');

// Single-document counter that serialises the audit hash chain.
// In a multi-instance deployment this would be replaced by a distributed lock
// or a database transaction (documented as a scale-up step).
const auditChainStateSchema = new mongoose.Schema({
  _id: { type: String, default: 'primary' },
  sequence: { type: Number, default: 0 },
  lastHash: { type: String, default: 'GENESIS' },
}, { timestamps: true });

module.exports = mongoose.model('AuditChainState', auditChainStateSchema);
