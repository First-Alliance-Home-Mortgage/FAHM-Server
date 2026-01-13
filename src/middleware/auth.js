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

    req.user = await User.findById(payload.sub).select('-password').populate('role');

    if (!req.user) return next(createError(401, 'User not found'));
    if (req.user.isActive === false) return next(createError(403, 'User is inactive'));
    if (req.log && typeof req.log.child === 'function') {
      req.log = req.log.child({ userId: req.user._id, role: req.user.role?.name });
    } else {
      req.log = logger.child({ requestId: req.id, userId: req.user._id, role: req.user.role?.name });
    }
    return next();
  } catch (_err) {
    return next(createError(401, 'Invalid token'));
  }
};

// Supports legacy signature authorize(roleA, roleB) and an object signature authorize({ roles, capabilities })
const authorize = (...args) => (req, res, next) => {
  if (!req.user) return next(createError(401, 'Authentication required'));

  const opts = args.length === 1 && typeof args[0] === 'object' && !Array.isArray(args[0])
    ? args[0]
    : { roles: args };

  const allowedRoles = opts.roles || [];
  const requiredCapabilities = opts.capabilities || [];

  // Get role name from populated role object or fallback to string comparison
  const userRoleName = req.user.role?.slug || req.user.role;

  if (allowedRoles.length && !allowedRoles.includes(userRoleName)) {
    return next(createError(403, 'Forbidden'));
  }

  if (requiredCapabilities.length && !requiredCapabilities.some((cap) => hasCapability(userRoleName, cap))) {
    return next(createError(403, 'Forbidden'));
  }

  return next();
};

module.exports = { authenticate, authorize };

