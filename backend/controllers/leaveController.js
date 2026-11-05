const Leave = require('../models/Leave');
const User = require('../models/User');
const { logEvent } = require('../middleware/auditLogger');
const { canReviewLeave } = require('../utils/policy');

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const daysBetween = (start, end) =>
  Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;

// @route POST /api/leaves
exports.applyLeave = async (req, res, next) => {
  try {
    const { startDate, endDate, reason, leaveType } = req.body;

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start < startOfToday()) {
      return res.status(400).json({ message: 'Leave cannot start in the past' });
    }

    const days = daysBetween(start, end);
    if (days < 1 || days > 30) {
      return res.status(400).json({ message: 'A leave request must be between 1 and 30 days' });
    }

    // Overlap check: two pending/approved leaves cannot cover the same day.
    const overlap = await Leave.findOne({
      employee: req.user.id,
      status: { $in: ['pending', 'approved'] },
      startDate: { $lte: end },
      endDate: { $gte: start },
    });
    if (overlap) {
      return res.status(409).json({
        message: 'This request overlaps with an existing pending or approved leave',
        overlappingLeaveId: overlap._id,
      });
    }

    const leave = await Leave.create({
      employee: req.user.id,
      leaveType: leaveType || 'casual',
      startDate: start,
      endDate: end,
      days,
      reason,
    });

    await logEvent({
      req,
      action: 'LEAVE_APPLIED',
      category: 'LEAVE',
      severity: 'info',
      targetId: leave._id,
      targetType: 'Leave',
      details: `Applied for ${days} day(s) of ${leave.leaveType} leave`,
      metadata: { startDate: start.toISOString(), endDate: end.toISOString(), days },
    });

    return res.status(201).json(leave);
  } catch (error) {
    return next(error);
  }
};

// @route GET /api/leaves/me
exports.getMyLeaves = async (req, res, next) => {
  try {
    const leaves = await Leave.find({ employee: req.user.id }).sort({ createdAt: -1 });
    return res.status(200).json(leaves);
  } catch (error) {
    return next(error);
  }
};

// @route DELETE /api/leaves/:id
exports.cancelMyLeave = async (req, res, next) => {
  try {
    const leave = await Leave.findOne({ _id: req.params.id, employee: req.user.id });
    if (!leave) return res.status(404).json({ message: 'Leave request not found' });
    if (leave.status !== 'pending') {
      return res.status(400).json({ message: 'Only a pending leave request can be cancelled' });
    }

    leave.status = 'cancelled';
    await leave.save();

    await logEvent({
      req,
      action: 'LEAVE_CANCELLED',
      category: 'LEAVE',
      severity: 'info',
      targetId: leave._id,
      targetType: 'Leave',
      details: 'Employee cancelled a pending leave request',
    });

    return res.status(200).json({ message: 'Leave request cancelled' });
  } catch (error) {
    return next(error);
  }
};

// @route GET /api/leaves  (Admin: all; HR: own department only)
exports.getAllLeaves = async (req, res, next) => {
  try {
    const status = (req.query.status || '').trim();
    const filter = {};
    if (status && ['pending', 'approved', 'rejected', 'cancelled'].includes(status)) {
      filter.status = status;
    }

    const leaves = await Leave.find(filter)
      .populate('employee', 'name email department role')
      .populate('reviewedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    const visible = req.user.role === 'admin'
      ? leaves
      : leaves.filter((leave) => {
        const dept = (leave.employee?.department || '').trim().toLowerCase();
        return Boolean(req.user.department) && dept === req.user.department.trim().toLowerCase();
      });

    const scoped = visible.map((leave) => ({
      ...leave,
      canReview: leave.status === 'pending' && canReviewLeave(req.user, leave.employee),
    }));

    return res.status(200).json(scoped);
  } catch (error) {
    return next(error);
  }
};

// @route PUT /api/leaves/:id/review
exports.reviewLeave = async (req, res, next) => {
  try {
    const { status, reviewNote } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status must be approved or rejected' });
    }

    const leave = await Leave.findById(req.params.id).populate('employee', 'name email department');
    if (!leave) return res.status(404).json({ message: 'Leave request not found' });

    if (!canReviewLeave(req.user, leave.employee)) {
      return res.status(403).json({
        message: 'Forbidden: you can only review leave for your own department, and not your own request',
      });
    }

    if (leave.status !== 'pending') {
      return res.status(409).json({ message: `This leave is already ${leave.status}` });
    }

    leave.status = status;
    leave.reviewedBy = req.user.id;
    leave.reviewedAt = new Date();
    leave.reviewNote = reviewNote || '';
    await leave.save();

    await logEvent({
      req,
      action: status === 'approved' ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
      category: 'LEAVE',
      severity: 'warning',
      targetId: leave._id,
      targetType: 'Leave',
      details: `Leave ${status} for ${leave.employee?.email || 'employee'}`,
      metadata: { days: leave.days, employeeDepartment: leave.employee?.department || null },
    });

    return res.status(200).json(leave);
  } catch (error) {
    return next(error);
  }
};

// @route GET /api/leaves/summary  (Admin/HR)
exports.getLeaveSummary = async (_req, res, next) => {
  try {
    const counts = await Leave.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    return res.status(200).json(counts.map((c) => ({ status: c._id, count: c.count })));
  } catch (error) {
    return next(error);
  }
};
