const express = require('express');
const router = express.Router();
const {
  getMyPrivacy,
  updateConsent,
  exportMyData,
  requestErasure,
  createDataRequest,
  getMyRequests,
  getAllRequests,
  reviewDataRequest,
  getAccessMatrix,
  getPrivacyStats,
  getCompliancePack,
} = require('../controllers/privacyController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { sensitiveLimiter } = require('../middleware/rateLimiter');
const {
  consentRules,
  erasureRules,
  dataRequestReviewRules,
  objectIdParam,
  handleValidation,
} = require('../middleware/validators');

router.use(protect);

// Data-principal self-service
router.get('/me', getMyPrivacy);
router.put('/consents', consentRules, handleValidation, updateConsent);
router.get('/me/export', sensitiveLimiter, exportMyData);
router.post('/erasure', sensitiveLimiter, erasureRules, handleValidation, requestErasure);
router.post('/requests', sensitiveLimiter, createDataRequest);
router.get('/requests/me', getMyRequests);
router.get('/access-matrix', getAccessMatrix);

// Administrator / DPO workspace
router.get('/requests', authorize('admin'), getAllRequests);
router.put('/requests/:id', authorize('admin'), objectIdParam('id'), dataRequestReviewRules, handleValidation, reviewDataRequest);
router.get('/stats', authorize('admin'), getPrivacyStats);
router.get('/compliance-pack', authorize('admin'), sensitiveLimiter, getCompliancePack);

module.exports = router;
