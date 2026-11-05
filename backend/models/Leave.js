const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  leaveType: {
    type: String,
    enum: ['casual', 'sick', 'earned', 'unpaid'],
    default: 'casual',
  },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  days: { type: Number, required: true, min: 1, max: 30 },
  reason: { type: String, required: true, trim: true, maxlength: 500 },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    default: 'pending',
    index: true,
  },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  reviewNote: { type: String, default: '' },
}, { timestamps: true });

leaveSchema.index({ employee: 1, startDate: 1, endDate: 1 });

module.exports = mongoose.model('Leave', leaveSchema);
