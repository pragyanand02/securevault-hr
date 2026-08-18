const express = require('express');
const router = express.Router();
const {
  applyLeave,
  getMyLeaves,
  cancelMyLeave,
  getAllLeaves,
  reviewLeave,
} = require('../controllers/leaveController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { leaveRules, handleValidation } = require('../middleware/validators');

router.use(protect);

router.post('/', leaveRules, handleValidation, applyLeave); // employee applies
router.get('/me', getMyLeaves); // employee views own leaves
router.delete('/:id', cancelMyLeave); // employee cancels pending leave
router.get('/', authorize('admin', 'hr_manager'), getAllLeaves); // admin/hr view all
router.put('/:id/review', authorize('admin', 'hr_manager'), reviewLeave); // admin/hr approve/reject

module.exports = router;

