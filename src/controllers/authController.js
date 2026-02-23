const { validationResult } = require('express-validator');
const createError = require('http-errors');
const User = require('../models/User');
const tokenService = require('../services/tokenService');
const refreshTokenService = require('../services/refreshTokenService');
const { audit } = require('../utils/audit');

const buildTokenMetadata = (req = {}) => {
  const headers = req.headers || {};
  return {
    ip: req.ip,
    userAgent: headers['user-agent'] || headers['User-Agent'],
  };
};

/**
 * Populate user with role and capabilities for API responses.
 * Returns a clean user object (no password) with the full role tree.
 */
const populateUserForResponse = async (userId) => {
  return User.findById(userId)
    .select('-password')
    .populate({
      path: 'role',
      populate: { path: 'capabilities' },
    });
};

exports.register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, { errors: errors.array() }));
    }
    const { name, email, password, role, phone } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return next(createError(409, 'Email already registered'));
    }
    const user = await User.create({ name, email, password, role, phone });

    // Populate role + capabilities for the response
    const populatedUser = await populateUserForResponse(user._id);

    const token = tokenService.sign(populatedUser);
    const { token: refreshToken } = await refreshTokenService.createToken({
      userId: user._id,
      metadata: buildTokenMetadata(req),
    });
    await audit({ action: 'auth.register', entityType: 'User', entityId: user._id.toString() }, req);
    return res.status(201).json({
      token,
      refreshToken,
      user: populatedUser,
    });
  } catch (err) {
    await audit({ action: 'auth.register', status: 'error', metadata: { message: err.message } }, req);
    return next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, { errors: errors.array() }));
    }
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) return next(createError(401, 'Invalid credentials'));
    const match = await user.comparePassword(password);
    if (!match) return next(createError(401, 'Invalid credentials'));

    // Populate role + capabilities for the response
    const populatedUser = await populateUserForResponse(user._id);

    const token = tokenService.sign(populatedUser);
    const { token: refreshToken } = await refreshTokenService.createToken({
      userId: user._id,
      metadata: buildTokenMetadata(req),
    });
    await audit({ action: 'auth.login', entityType: 'User', entityId: user._id.toString() }, req);
    return res.json({
      token,
      refreshToken,
      user: populatedUser,
    });
  } catch (err) {
    await audit({ action: 'auth.login', status: 'error', metadata: { message: err.message } }, req);
    return next(err);
  }
};

exports.refresh = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, { errors: errors.array() }));
    }
    const { refreshToken } = req.body;
    const rotation = await refreshTokenService.rotateToken({
      tokenValue: refreshToken,
      metadata: buildTokenMetadata(req),
    });

    // Populate role + capabilities for both the JWT and the response
    const populatedUser = await populateUserForResponse(rotation.userId);
    if (!populatedUser) {
      return next(createError(401, 'User not found'));
    }
    const token = tokenService.sign(populatedUser);
    await audit({ action: 'auth.refresh', entityType: 'User', entityId: rotation.userId.toString() }, req);
    return res.json({
      token,
      refreshToken: rotation.refreshToken,
      user: populatedUser,
    });
  } catch (err) {
    await audit({ action: 'auth.refresh', status: 'error', metadata: { message: err.message } }, req);
    return next(err);
  }
};

exports.logout = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, { errors: errors.array() }));
    }

    if (!req.user) {
      return next(createError(401, 'Authentication required'));
    }

    const providedToken = req.body?.refreshToken;
    let resolvedUserId = req.user._id.toString();

    if (providedToken) {
      const revokedDoc = await refreshTokenService.revokeToken(
        providedToken,
        'user_logout',
        buildTokenMetadata(req)
      );
      if (!revokedDoc) {
        return next(createError(401, 'Invalid refresh token'));
      }
      resolvedUserId = revokedDoc.user?.toString() || resolvedUserId;
    } else {
      await refreshTokenService.revokeTokensForUser(req.user._id, 'user_logout_all');
    }
    await audit(
      {
        action: 'auth.logout',
        entityType: 'User',
        entityId: resolvedUserId,
      },
      req,
    );
    return res.status(204).send();
  } catch (err) {
    await audit({ action: 'auth.logout', status: 'error', metadata: { message: err.message } }, req);
    return next(err);
  }
};

