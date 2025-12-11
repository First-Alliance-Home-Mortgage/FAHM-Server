const { validationResult } = require('express-validator');
const createError = require('http-errors');
const User = require('../models/User');
const tokenService = require('../services/tokenService');
const { audit } = require('../utils/audit');

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
    const token = tokenService.sign(user);
    await audit({ action: 'auth.register', entityType: 'User', entityId: user._id.toString() }, req);
    return res.status(201).json({ token, user: { id: user._id, name, email, role, phone } });
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
    const token = tokenService.sign(user);
    await audit({ action: 'auth.login', entityType: 'User', entityId: user._id.toString() }, req);
    return res.json({ token, user: { id: user._id, name: user.name, email, role: user.role } });
  } catch (err) {
    await audit({ action: 'auth.login', status: 'error', metadata: { message: err.message } }, req);
    return next(err);
  }
};

