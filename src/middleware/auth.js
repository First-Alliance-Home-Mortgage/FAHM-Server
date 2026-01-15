const jwt = require('jsonwebtoken');
const createError = require('http-errors');
const { jwtSecret } = require('../config/env');
const User = require('../models/User');
const { hasCapability } = require('../config/roles');
const logger = require('../utils/logger');

// Attach the authenticated user to the request (strips password) and reject inactive users
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(createError(401, 'Authentication required'));
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, jwtSecret);

    req.user = await User.findById(payload.sub)
      .select('-password')
      .populate({
        path: 'role',
        populate: { path: 'capabilities' }
      });
    if (!req.user) return next(createError(401, 'User not found'));
    if (req.user.isActive === false) return next(createError(403, 'User is inactive'));
    if (req.log && typeof req.log.child === 'function') {
      req.log = req.log.child({ userId: req.user._id, role: req.user.role?.name });
    } else {
      req.log = logger.child({ requestId: req.id, userId: req.user._id, role: req.user.role?.name });
    }
    return next();
  } catch (err) {
    logger.error('Authentication error', { error: err.message, stack: err.stack });
    return next(createError(401, 'Invalid token'));
  }
};

// Authorize using role/capabilities from the database only
const authorize = (options = {}) => (req, res, next) => {

  if (!req.user) return next(createError(401, 'Authentication required'));
  if (!req.user.role) return next(createError(403, 'User has no role assigned'));
  const allowedRoles = options.roles || [];
  const requiredCapabilities = options.capabilities || [];

  // Always use the populated role object from DB
  const userRoleName = req.user.role.slug;

  // Role-based access (if specified)
  if (allowedRoles.length > 0) {
    const allowed = allowedRoles.map(r => r.toLowerCase());
    if (!allowed.includes(userRoleName)) {
      return next(createError(403, 'Forbidden'));
    }
  }

  // Capability-based access (if specified)
  if (requiredCapabilities.length > 0) {
    const hasAll = requiredCapabilities.every((cap) => hasCapability(req.user.role, cap));
    if (!hasAll) {
      return next(createError(403, 'Insufficient permissions'));
    }
  }

  return next();
};

module.exports = { authenticate, authorize };

