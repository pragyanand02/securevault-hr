const Leave = require('../models/Leave');
const { logAction } = require('../middleware/auditLogger');

// @route POST /api/leaves   (Employee applies for leave)
exports.applyLeave = async (req, res) => {
  try {
    const { startDate, endDate, reason } = req.body;

    const leave = await Leave.create({
      employee: req.user.id,
      startDate,
      endDate,
      reason,
    });

    await logAction(req.user.id, 'APPLY_LEAVE', leave._id, `Applied for leave from ${startDate} to ${endDate}`);

    res.status(201).json(leave);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route GET /api/leaves/me   (Employee views own leave history)
exports.getMyLeaves = async (req, res) => {
  try {
    const leaves = await Leave.find({ employee: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json(leaves);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route DELETE /api/leaves/:id   (Employee cancels own pending leave)
exports.cancelMyLeave = async (req, res) => {
  try {
    const leave = await Leave.findOne({ _id: req.params.id, employee: req.user.id });
    if (!leave) return res.status(404).json({ message: 'Leave request not found' });
    if (leave.status !== 'pending') {
      return res.status(400).json({ message: 'Cannot cancel a leave that has already been reviewed' });
    }

    await leave.deleteOne();
    await logAction(req.user.id, 'CANCEL_LEAVE', req.params.id, 'Cancelled pending leave request');

    res.status(200).json({ message: 'Leave request cancelled successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route GET /api/leaves   (Admin, HR Manager view all leave requests)
exports.getAllLeaves = async (req, res) => {
  try {
    const leaves = await Leave.find().populate('employee', 'name email department').sort({ createdAt: -1 });
    res.status(200).json(leaves);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route PUT /api/leaves/:id/review   (Admin, HR Manager approve/reject)
exports.reviewLeave = async (req, res) => {
  try {
    const { status } = req.body; // 'approved' or 'rejected'
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status must be approved or rejected' });
    }

    const leave = await Leave.findById(req.params.id);
    if (!leave) return res.status(404).json({ message: 'Leave request not found' });

    leave.status = status;
    leave.reviewedBy = req.user.id;
    await leave.save();

    await logAction(req.user.id, `LEAVE_${status.toUpperCase()}`, leave._id, `Leave request ${status}`);

    res.status(200).json(leave);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

