const rateLimit = require('express-rate-limit');

const json = (message) => ({ message });

// Broad protection for the whole API.
exports.apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: json('Too many requests. Please slow down and try again shortly.'),
});

// Brute-force protection for login. Successful logins are not counted, so
// switching between demo accounts during a presentation does not lock the IP.
exports.loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: json('Too many failed login attempts. Please try again after 15 minutes.'),
});

// Prevent mass account creation from one source.
exports.registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: json('Too many registration attempts. Please try again later.'),
});

// Sensitive operations (exports, erasure requests, granting access).
exports.sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: json('Too many sensitive requests. Please try again later.'),
});
