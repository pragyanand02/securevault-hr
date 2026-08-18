const User = require('../models/User');
const Leave = require('../models/Leave');

// @route GET /api/analytics/summary   (Admin, HR Manager)
exports.getSummary = async (req, res) => {
  try {
    const departmentCounts = await User.aggregate([
      { $group: { _id: { $ifNull: ['$department', 'Unassigned'] }, count: { $sum: 1 } } },
    ]);

    const leaveStatusCounts = await Leave.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const roleCounts = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]);

    res.status(200).json({
      departmentCounts: departmentCounts.map((d) => ({ label: d._id, count: d.count })),
      leaveStatusCounts: leaveStatusCounts.map((l) => ({ label: l._id, count: l.count })),
      roleCounts: roleCounts.map((r) => ({ label: r._id, count: r.count })),
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
