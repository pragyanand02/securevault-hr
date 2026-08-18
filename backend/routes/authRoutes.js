const express = require('express');
const router = express.Router();
const { register, login } = require('../controllers/authController');
const { loginLimiter } = require('../middleware/rateLimiter');
const { registerRules, loginRules, handleValidation } = require('../middleware/validators');

router.post('/register', registerRules, handleValidation, register);
router.post('/login', loginLimiter, loginRules, handleValidation, login);

module.exports = router;
