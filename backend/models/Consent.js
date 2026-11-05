const mongoose = require('mongoose');

// DPDP-oriented consent / lawful-basis record.
// Mandatory purposes rely on contract or legal obligation and cannot be
// withdrawn while the employment relationship is active; optional purposes
// can be withdrawn at any time from the "My Data" page.
const CONSENT_PURPOSES = [
  'core_hr',
  'payroll',
  'statutory_compliance',
  'benefits',
  'background_verification',
  'analytics',
  'marketing',
];

const consentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  purpose: { type: String, enum: CONSENT_PURPOSES, required: true },
  lawfulBasis: {
    type: String,
    enum: ['consent', 'contract', 'legal_obligation', 'legitimate_use'],
    required: true,
  },
  mandatory: { type: Boolean, default: false },
  granted: { type: Boolean, default: false },
  noticeVersion: { type: String, default: '2026-11' },
  grantedAt: { type: Date, default: null },
  withdrawnAt: { type: Date, default: null },
  ip: { type: String, default: null },
  userAgent: { type: String, default: null },
  evidence: { type: String, default: null },
}, { timestamps: true });

consentSchema.index({ user: 1, purpose: 1 }, { unique: true });

consentSchema.statics.PURPOSES = CONSENT_PURPOSES;

module.exports = mongoose.model('Consent', consentSchema);
