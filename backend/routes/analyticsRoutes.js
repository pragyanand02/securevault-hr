const express = require('express');
const router = express.Router();
const { getSummary } = require('../controllers/analyticsController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);
router.get('/summary', authorize('admin', 'hr_manager'), getSummary);

module.exports = router;
