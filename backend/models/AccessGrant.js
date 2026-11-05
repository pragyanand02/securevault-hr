const mongoose = require('mongoose');

// Just-in-time, time-bound access grant for sensitive fields.
// Example: an HR manager needs salary data for a compensation review, requests
// it with a reason, an admin approves for 60 minutes, and access auto-expires.
const accessGrantSchema = new mongoose.Schema({
  grantee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  field: {
    type: String,
    enum: ['salary', 'bankDetails', 'sensitive_fields'],
    default: 'sensitive_fields',
  },
  scope: {
    type: String,
    enum: ['department', 'all'],
    default: 'department',
  },
  reason: { type: String, required: true, trim: true, maxlength: 500 },
  status: {
    type: String,
    enum: ['pending', 'approved', 'denied', 'revoked', 'expired'],
    default: 'pending',
    index: true,
  },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  expiresAt: { type: Date, default: null, index: true },
  reviewNote: { type: String, default: '' },
}, { timestamps: true });

accessGrantSchema.index({ grantee: 1, status: 1, expiresAt: 1 });

module.exports = mongoose.model('AccessGrant', accessGrantSchema);
