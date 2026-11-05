const mongoose = require('mongoose');

// A data-principal rights request (DPDP: access, correction, erasure,
// grievance redressal). dueAt implements a 30-day response SLA.
const dataRequestSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: {
    type: String,
    enum: ['access', 'correction', 'erasure', 'grievance'],
    required: true,
  },
  reason: { type: String, trim: true, maxlength: 1000, default: '' },
  status: {
    type: String,
    // "deferred" records a request that is acknowledged but cannot be actioned
    // until a statutory retention hold ends (e.g. payroll records of an employee).
    enum: ['pending', 'in_review', 'completed', 'rejected', 'deferred'],
    default: 'pending',
    index: true,
  },
  legalHold: { type: Boolean, default: false },
  legalHoldReason: { type: String, default: null },
  dueAt: { type: Date, required: true },
  resolvedAt: { type: Date, default: null },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  resolutionNote: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('DataRequest', dataRequestSchema);
