const express = require('express');
const router = express.Router();
const {
  applyLeave,
  getMyLeaves,
  cancelMyLeave,
  getAllLeaves,
  reviewLeave,
  getLeaveSummary,
} = require('../controllers/leaveController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { leaveRules, objectIdParam, handleValidation } = require('../middleware/validators');

router.use(protect);

router.get('/summary', authorize('admin', 'hr_manager'), getLeaveSummary);
router.get('/me', getMyLeaves);
router.post('/', leaveRules, handleValidation, applyLeave);
router.delete('/:id', objectIdParam('id'), handleValidation, cancelMyLeave);
router.get('/', authorize('admin', 'hr_manager'), getAllLeaves);
router.put('/:id/review', authorize('admin', 'hr_manager'), objectIdParam('id'), handleValidation, reviewLeave);

module.exports = router;
