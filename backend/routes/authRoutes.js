const express = require('express');
const router = express.Router();
const {
  register,
  login,
  refresh,
  logout,
  me,
  changePassword,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimiter');
const {
  registerRules,
  loginRules,
  changePasswordRules,
  handleValidation,
} = require('../middleware/validators');

router.post('/register', registerLimiter, registerRules, handleValidation, register);
router.post('/login', loginLimiter, loginRules, handleValidation, login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', protect, me);
router.put('/password', protect, changePasswordRules, handleValidation, changePassword);

module.exports = router;
