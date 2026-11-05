const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },

  role: {
    type: String,
    enum: ['admin', 'hr_manager', 'employee'],
    default: 'employee',
    index: true,
  },
  department: { type: String, trim: true, maxlength: 80, index: true },
  designation: { type: String, trim: true, maxlength: 120 },
  employeeCode: { type: String, trim: true, maxlength: 40 },

  // Sensitive fields: stored as AES-256-GCM ciphertext (see utils/encryption.js).
  salary: { type: String },
  bankDetails: { type: String },

  // Account lifecycle / security state
  isActive: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date, default: null },
  retentionUntil: { type: Date, default: null },

  tokenVersion: { type: Number, default: 0 },
  refreshTokenHash: { type: String, default: null },
  refreshTokenExpiresAt: { type: Date, default: null },

  lastLoginAt: { type: Date, default: null },
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date, default: null },

  // DPDP: which notice/consent version the employee accepted at onboarding.
  noticeAcceptedAt: { type: Date, default: null },
  noticeVersion: { type: String, default: null },
}, {
  timestamps: true,
  toJSON: {
    transform: (_doc, ret) => {
      delete ret.password;
      delete ret.refreshTokenHash;
      delete ret.refreshTokenExpiresAt;
      delete ret.__v;
      return ret;
    },
  },
});

module.exports = mongoose.model('User', userSchema);
