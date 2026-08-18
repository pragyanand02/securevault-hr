const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['admin', 'hr_manager', 'employee'],
    default: 'employee',
  },
  department: { type: String },
  // Sensitive fields - stored encrypted (see utils/encryption.js), only Admin can view decrypted
  salary: { type: String }, // encrypted string
  bankDetails: { type: String }, // encrypted string
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
