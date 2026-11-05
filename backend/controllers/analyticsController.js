const User = require('../models/User');
const Leave = require('../models/Leave');
const Consent = require('../models/Consent');

// @route GET /api/analytics/summary  (Admin: all; HR: own department)
exports.getSummary = async (req, res, next) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const userFilter = isAdmin
      ? { isDeleted: false }
      : { isDeleted: false, department: req.user.department || '__none__' };

    const scopedUsers = await User.find(userFilter).select('_id department role').lean();
    const scopedIds = scopedUsers.map((u) => u._id);

    const [departmentCounts, leaveStatusCounts, roleCounts, consentGranted] = await Promise.all([
      User.aggregate([
        { $match: userFilter },
        { $group: { _id: { $ifNull: ['$department', 'Unassigned'] }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Leave.aggregate([
        { $match: { employee: { $in: scopedIds } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      User.aggregate([
        { $match: userFilter },
        { $group: { _id: '$role', count: { $sum: 1 } } },
      ]),
      Consent.countDocuments({ user: { $in: scopedIds }, granted: true }),
    ]);

    return res.status(200).json({
      scope: isAdmin ? 'all' : req.user.department || 'none',
      headcount: scopedUsers.length,
      consentsGranted: consentGranted,
      departmentCounts: departmentCounts.map((d) => ({ label: d._id, count: d.count })),
      leaveStatusCounts: leaveStatusCounts.map((l) => ({ label: l._id, count: l.count })),
      roleCounts: roleCounts.map((r) => ({ label: r._id, count: r.count })),
    });
  } catch (error) {
    return next(error);
  }
};
