const express = require('express');
const router = express.Router();
const {
  getAuditLogs,
  verifyAuditChain,
  getAuditAnchor,
  getAuditStats,
} = require('../controllers/auditController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect, authorize('admin'));

router.get('/verify', verifyAuditChain);
router.get('/anchor', getAuditAnchor);
router.get('/stats', getAuditStats);
router.get('/', getAuditLogs);

module.exports = router;
