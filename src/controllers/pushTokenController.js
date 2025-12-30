const createError = require('http-errors');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const logger = require('../utils/logger');

exports.validatePushToken = [
  body('userId').notEmpty().withMessage('userId is required'),
  body('expoPushToken').notEmpty().withMessage('expoPushToken is required'),
];

exports.registerPushToken = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, { errors: errors.array() }));
    }
    console.log('Registering push token with data:', req.body);
    const { userId, expoPushToken } = req.body;
    const user = await User.findByIdAndUpdate(
      userId,
      { expoPushToken },
      { new: true }
    );
    if (!user) {
      return next(createError(404, 'User not found'));
    }
    logger.info('Expo push token registered/updated', { userId, expoPushToken });
    res.json({ success: true, message: 'Push token registered', user: { _id: user._id, expoPushToken: user.expoPushToken } });
  } catch (error) {
    logger.error('Error registering push token:', error);
    next(error);
  }
};
