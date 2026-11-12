const express = require('express');
const router = express.Router();
const {
  requestAccess,
  getMyGrants,
  getActiveGrant,
  getAllGrants,
  reviewAccess,
  revokeAccess,
  startAdminSession,
  endAdminSession,
} = require('../controllers/accessController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { sensitiveLimiter } = require('../middleware/rateLimiter');
const {
  accessRequestRules,
  accessReviewRules,
  objectIdParam,
  handleValidation,
} = require('../middleware/validators');

router.use(protect);

router.post('/requests', sensitiveLimiter, accessRequestRules, handleValidation, requestAccess);
router.get('/requests/me', getMyGrants);
router.get('/active', getActiveGrant);

router.get('/requests', authorize('admin'), getAllGrants);
router.post('/admin-session', authorize('admin'), startAdminSession);
router.post('/admin-session/end', authorize('admin'), endAdminSession);
router.put('/requests/:id/review', authorize('admin'), objectIdParam('id'), accessReviewRules, handleValidation, reviewAccess);
router.delete('/requests/:id', authorize('admin'), objectIdParam('id'), handleValidation, revokeAccess);

module.exports = router;
