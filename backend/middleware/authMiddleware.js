const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verifies the access token AND re-checks the account in the database on every
// request. This means a role change, deactivation, deletion or logout (token
// version bump) takes effect immediately instead of waiting for JWT expiry.
exports.protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Not authorized, no access token provided' });
    }

    const token = authHeader.slice(7);
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: 'Not authorized, access token invalid or expired' });
    }

    if (decoded.type !== 'access') {
      return res.status(401).json({ message: 'Not authorized, wrong token type' });
    }

    const user = await User.findById(decoded.id)
      .select('name email role department isActive isDeleted tokenVersion');

    if (!user || user.isDeleted || !user.isActive) {
      return res.status(401).json({ message: 'Account is inactive or no longer exists' });
    }

    if (user.tokenVersion !== decoded.tokenVersion) {
      return res.status(401).json({ message: 'Session revoked, please sign in again' });
    }

    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
    };

    return next();
  } catch (error) {
    return next(error);
  }
};

// Restricts a route to specific roles, e.g. authorize('admin', 'hr_manager')
exports.authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      message: 'Forbidden: your role does not have permission for this action',
    });
  }
  return next();
};
