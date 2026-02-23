const createError = require('http-errors');
const { audit } = require('../utils/audit');
const { body, param, query, validationResult } = require('express-validator');
const User = require('../models/User');
const Role = require('../models/Role');
const escapeRegex = require('../utils/escapeRegex');

exports.me = async (req, res, next) => {
  try {
    if (!req.user) return next(createError(401, 'Authentication required'));
    const user = await User.findById(req.user._id)
      .populate({
        path: 'role',
        populate: { path: 'capabilities' }
      });
    await audit({ action: 'users.me', entityType: 'User', entityId: req.user._id, status: 'success' }, req);
    res.json({ user });
  } catch (err) {
    req.log && req.log.error('Failed to get current user', { error: err });
    next(err);
  }
};

// Validation for profile updates (self)
exports.validateUpdateProfile = [
  body('name').optional().isString().trim().notEmpty(),
  body('phone').optional().isString().trim(),
  body('title').optional().isString().trim(),
  body('photo').optional().isString().trim(),
  body('branch').optional().isObject(),
];

exports.updateProfile = async (req, res, next) => {
  try {
    if (!req.user) return next(createError(401, 'Authentication required'));
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(createError(400, { errors: errors.array() }));
    const allowed = ['name', 'phone', 'title', 'photo', 'branch'];
    const patch = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) patch[key] = req.body[key];
    }
    const updated = await User.findByIdAndUpdate(req.user._id, { $set: patch }, { new: true })
      .select('-password')
      .populate({
        path: 'role',
        populate: { path: 'capabilities' }
      });
    if (!updated) return next(createError(404, 'User not found'));
    await audit({ action: 'users.profile.update', entityType: 'User', entityId: req.user._id, status: 'success' }, req);
    res.json({ user: updated });
  } catch (err) {
    req.log && req.log.error('Failed to update profile', { error: err });
    next(err);
  }
};

// Admin CRUD
exports.validateCreateUser = [
  body('name').isString().trim().notEmpty(),
  body('email').isEmail().normalizeEmail(),
  body('phone').optional().isString().trim(),
  body('role').optional().isString().trim(),
  body('password').isString().isLength({ min: 6 }),
  body('title').optional().isString().trim(),
  body('branch').optional().isObject(),
];

exports.createUser = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(createError(400, { errors: errors.array() }));
    if (req.body.role) {
      const roleExists = await Role.findById(req.body.role);
      if (!roleExists) return next(createError(400, 'Invalid role'));
    }
    const existing = await User.findOne({ email: req.body.email });
    if (existing) return next(createError(409, 'Email already in use'));
    const user = await User.create({
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      role: req.body.role,
      password: req.body.password,
      title: req.body.title,
      branch: req.body.branch,
    }).then(u => u.populate({
      path: 'role',
      populate: { path: 'capabilities' }
    }));
    await audit({ action: 'users.create', entityType: 'User', entityId: user._id, status: 'success' }, req);
    res.status(201).json({ user });
  } catch (err) {
    req.log && req.log.error('Failed to create user', { error: err });
    next(err);
  }
};

exports.validateListUsers = [
  query('role').optional().isString().trim(),
  query('active').optional().isBoolean().toBoolean(),
  query('q').optional().isString().trim(),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('sort').optional().isString().trim(),
];

exports.listUsers = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(createError(400, { errors: errors.array() }));
    const { role, active, q } = req.query;
    const page = req.query.page || 1;
    const limit = req.query.limit || 20;
    const sort = req.query.sort || '-createdAt';
    const filter = {};
    if (role) {
      const roleDoc = await Role.findOne({ slug: role });
      if (roleDoc) filter.role = roleDoc._id;
      else return res.json({ users: [], page, pageSize: limit, total: 0 });
    }
    if (typeof active === 'boolean') filter.isActive = active;
    if (q) {
      const safeQ = escapeRegex(q);
      filter.$or = [
        { name: { $regex: safeQ, $options: 'i' } },
        { email: { $regex: safeQ, $options: 'i' } },
      ];
    }
    const skip = (page - 1) * limit;
    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .select('-password')
      .populate({
        path: 'role',
        populate: { path: 'capabilities' }
      })
      .sort(sort)
      .skip(skip)
      .limit(limit);
    res.json({ users, page, pageSize: limit, total });
  } catch (err) {
    req.log && req.log.error('Failed to list users', { error: err });
    next(err);
  }
};

exports.validateUserId = [param('id').isString().trim().notEmpty()];

exports.getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password')
      .populate({
        path: 'role',
        populate: { path: 'capabilities' }
      });
    if (!user) return next(createError(404, 'User not found'));
    res.json({ user });
  } catch (err) {
    req.log && req.log.error('Failed to get user', { error: err });
    next(err);

  }
};

exports.validateUpdateUser = [
  param('id').isString().trim().notEmpty(),
  body('name').optional().isString().trim().notEmpty(),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional().isString().trim(),
  body('role').optional().isString().trim(),
  body('title').optional().isString().trim(),
  body('branch').optional().isObject(),
  body('isActive').optional().isBoolean(),
];

exports.updateUser = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(createError(400, { errors: errors.array() }));
    const allowed = ['name', 'email', 'phone', 'role', 'title', 'branch', 'isActive'];
    const patch = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) patch[key] = req.body[key];
    }
    if (patch.role) {
      const roleExists = await Role.findById(patch.role);
      if (!roleExists) return next(createError(400, 'Invalid role'));
    }
    const updated = await User.findByIdAndUpdate(req.params.id, { $set: patch }, { new: true })
      .select('-password')
      .populate({
        path: 'role',
        populate: { path: 'capabilities' }
      });
    if (!updated) return next(createError(404, 'User not found'));
    await audit({ action: 'users.update', entityType: 'User', entityId: req.params.id, status: 'success' }, req);
    res.json({ user: updated });
  } catch (err) {
    req.log && req.log.error('Failed to update user', { error: err });
    next(err);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    const updated = await User.findByIdAndUpdate(req.params.id, { $set: { isActive: false } }, { new: true }).select('-password');
    if (!updated) return next(createError(404, 'User not found'));
    await audit({ action: 'users.deactivate', entityType: 'User', entityId: req.params.id, status: 'success' }, req);
    res.json({ success: true });
  } catch (err) {
    req.log && req.log.error('Failed to deactivate user', { error: err });
    next(err);
  }
};

