const jwt = require('jsonwebtoken');
const createError = require('http-errors');
const { jwtSecret } = require('../config/env');
const User = require('../models/User');

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(createError(401, 'Authentication required'));
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, jwtSecret);
    req.user = await User.findById(payload.sub).select('-password');
    if (!req.user) return next(createError(401, 'User not found'));
    return next();
  } catch (_err) {
    return next(createError(401, 'Invalid token'));
  }
};

const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user) return next(createError(401, 'Authentication required'));
  if (allowedRoles.length && !allowedRoles.includes(req.user.role)) {
    return next(createError(403, 'Forbidden'));
  }
  return next();
};

module.exports = { authenticate, authorize };

