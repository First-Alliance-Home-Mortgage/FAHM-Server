const { validationResult } = require('express-validator');
const createError = require('http-errors');
const RateAlert = require('../models/RateAlert');
const rateAlertService = require('../services/rateAlertService');
const optimalBlueService = require('../services/optimalBlueService');
const logger = require('../utils/logger');

/**
 * Create rate alert
 * POST /api/v1/rate-alerts
 * Access: Authenticated users
 */
exports.createAlert = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, { errors: errors.array() }));
    }

    const {
      productType,
      loanTerm,
      loanAmount,
      creditScore,
      ltv,
      propertyType,
      triggerType,
      targetRate,
      dropAmount,
      baselineRate,
      notificationMethod,
      expiresAt
    } = req.body;

    // Validate trigger configuration
    if (triggerType === 'drops_by' && !baselineRate) {
      return next(createError(400, 'baselineRate is required for drops_by trigger type'));
    }
    if ((triggerType === 'below' || triggerType === 'above') && !targetRate) {
      return next(createError(400, 'targetRate is required for below/above trigger types'));
    }

    // Create alert
    const alert = new RateAlert({
      user: req.user.userId,
      productType,
      loanTerm,
      loanAmount: loanAmount || 300000,
      creditScore: creditScore || 740,
      ltv: ltv || 80,
      propertyType: propertyType || 'single_family',
      triggerType,
      targetRate,
      dropAmount: dropAmount || 0.125,
      baselineRate,
      notificationMethod: notificationMethod || 'push',
      expiresAt: expiresAt || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    });

    await alert.save();

    logger.info('Rate alert created', {
      userId: req.user.userId,
      alertId: alert._id,
      triggerType,
      productType,
      loanTerm
    });

    res.status(201).json({
      success: true,
      data: alert
    });
  } catch (err) {
    logger.error(`Error creating rate alert: ${err.message}`);
    next(err);
  }
};

/**
 * Get user's rate alerts
 * GET /api/v1/rate-alerts
 * Access: Authenticated users
 */
exports.getAlerts = async (req, res, next) => {
  try {
    const { status, productType, loanTerm, page = 1, limit = 50 } = req.query;

    const query = { user: req.user.userId };
    if (status) query.status = status;
    if (productType) query.productType = productType;
    if (loanTerm) query.loanTerm = parseInt(loanTerm);

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [alerts, total] = await Promise.all([
      RateAlert.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      RateAlert.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: alerts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    logger.error(`Error fetching rate alerts: ${err.message}`);
    next(err);
  }
};

/**
 * Get single rate alert
 * GET /api/v1/rate-alerts/:id
 * Access: Authenticated users
 */
exports.getAlert = async (req, res, next) => {
  try {
    const { id } = req.params;

    const alert = await RateAlert.findById(id);
    if (!alert) {
      return next(createError(404, 'Rate alert not found'));
    }

    // Authorization check
    if (alert.user.toString() !== req.user.userId) {
      return next(createError(403, 'Not authorized to view this alert'));
    }

    res.json({
      success: true,
      data: alert
    });
  } catch (err) {
    logger.error(`Error fetching rate alert: ${err.message}`);
    next(err);
  }
};

/**
 * Update rate alert
 * PATCH /api/v1/rate-alerts/:id
 * Access: Authenticated users
 */
exports.updateAlert = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { targetRate, dropAmount, baselineRate, notificationMethod, status } = req.body;

    const alert = await RateAlert.findById(id);
    if (!alert) {
      return next(createError(404, 'Rate alert not found'));
    }

    // Authorization check
    if (alert.user.toString() !== req.user.userId) {
      return next(createError(403, 'Not authorized to update this alert'));
    }

    // Update allowed fields
    if (targetRate !== undefined) alert.targetRate = targetRate;
    if (dropAmount !== undefined) alert.dropAmount = dropAmount;
    if (baselineRate !== undefined) alert.baselineRate = baselineRate;
    if (notificationMethod) alert.notificationMethod = notificationMethod;
    if (status && ['active', 'paused', 'cancelled'].includes(status)) {
      alert.status = status;
    }

    await alert.save();

    logger.info('Rate alert updated', {
      userId: req.user.userId,
      alertId: alert._id
    });

    res.json({
      success: true,
      data: alert
    });
  } catch (err) {
    logger.error(`Error updating rate alert: ${err.message}`);
    next(err);
  }
};

/**
 * Delete rate alert
 * DELETE /api/v1/rate-alerts/:id
 * Access: Authenticated users
 */
exports.deleteAlert = async (req, res, next) => {
  try {
    const { id } = req.params;

    const alert = await RateAlert.findById(id);
    if (!alert) {
      return next(createError(404, 'Rate alert not found'));
    }

    // Authorization check
    if (alert.user.toString() !== req.user.userId) {
      return next(createError(403, 'Not authorized to delete this alert'));
    }

    await RateAlert.findByIdAndDelete(id);

    logger.info('Rate alert deleted', {
      userId: req.user.userId,
      alertId: id
    });

    res.json({
      success: true,
      message: 'Rate alert deleted successfully'
    });
  } catch (err) {
    logger.error(`Error deleting rate alert: ${err.message}`);
    next(err);
  }
};

/**
 * Check current rate for alert
 * GET /api/v1/rate-alerts/:id/check-rate
 * Access: Authenticated users
 */
exports.checkRate = async (req, res, next) => {
  try {
    const { id } = req.params;

    const alert = await RateAlert.findById(id);
    if (!alert) {
      return next(createError(404, 'Rate alert not found'));
    }

    // Authorization check
    if (alert.user.toString() !== req.user.userId) {
      return next(createError(403, 'Not authorized to check this alert'));
    }

    // Fetch current rate from Optimal Blue
    const rateData = await optimalBlueService.getRateSheet({
      productType: alert.productType,
      loanTerm: alert.loanTerm,
      loanAmount: alert.loanAmount,
      creditScore: alert.creditScore,
      ltv: alert.ltv,
      propertyType: alert.propertyType
    });

    const currentRate = rateData.rate;
    const shouldTrigger = alert.shouldTrigger(currentRate);

    res.json({
      success: true,
      data: {
        currentRate,
        targetRate: alert.targetRate || alert.baselineRate,
        shouldTrigger,
        triggerType: alert.triggerType,
        rateData
      }
    });
  } catch (err) {
    logger.error(`Error checking rate: ${err.message}`);
    next(err);
  }
};

/**
 * Manually trigger alert check (Admin/Testing)
 * POST /api/v1/rate-alerts/:id/trigger-check
 * Access: Authenticated users
 */
exports.triggerCheck = async (req, res, next) => {
  try {
    const { id } = req.params;

    const alert = await RateAlert.findById(id).populate('user', 'name email phone');
    if (!alert) {
      return next(createError(404, 'Rate alert not found'));
    }

    // Authorization check
    if (alert.user._id.toString() !== req.user.userId) {
      return next(createError(403, 'Not authorized to trigger this alert'));
    }

    // Check alert
    const result = await rateAlertService.checkSingleAlert(alert);

    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    logger.error(`Error triggering alert check: ${err.message}`);
    next(err);
  }
};

/**
 * Get alert statistics
 * GET /api/v1/rate-alerts/stats
 * Access: Authenticated users
 */
exports.getStats = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const [total, active, paused, triggered, expired, cancelled] = await Promise.all([
      RateAlert.countDocuments({ user: userId }),
      RateAlert.countDocuments({ user: userId, status: 'active' }),
      RateAlert.countDocuments({ user: userId, status: 'paused' }),
      RateAlert.countDocuments({ user: userId, status: 'triggered' }),
      RateAlert.countDocuments({ user: userId, status: 'expired' }),
      RateAlert.countDocuments({ user: userId, status: 'cancelled' })
    ]);

    // Get recent triggers
    const recentAlerts = await RateAlert.find({
      user: userId,
      status: 'triggered'
    })
      .sort({ triggeredAt: -1 })
      .limit(5)
      .lean();

    const recentTriggers = recentAlerts.map(alert => ({
      alertId: alert._id,
      productType: alert.productType,
      loanTerm: alert.loanTerm,
      triggeredAt: alert.triggeredAt,
      triggeredRate: alert.triggeredRate,
      targetRate: alert.targetRate
    }));

    res.json({
      success: true,
      data: {
        total,
        active,
        paused,
        triggered,
        expired,
        cancelled,
        recentTriggers
      }
    });
  } catch (err) {
    logger.error(`Error fetching alert stats: ${err.message}`);
    next(err);
  }
};

/**
 * Pause alert
 * POST /api/v1/rate-alerts/:id/pause
 * Access: Authenticated users
 */
exports.pauseAlert = async (req, res, next) => {
  try {
    const { id } = req.params;

    const alert = await RateAlert.findById(id);
    if (!alert) {
      return next(createError(404, 'Rate alert not found'));
    }

    // Authorization check
    if (alert.user.toString() !== req.user.userId) {
      return next(createError(403, 'Not authorized to pause this alert'));
    }

    alert.status = 'paused';
    await alert.save();

    logger.info('Rate alert paused', {
      userId: req.user.userId,
      alertId: id
    });

    res.json({
      success: true,
      data: alert
    });
  } catch (err) {
    logger.error(`Error pausing alert: ${err.message}`);
    next(err);
  }
};

/**
 * Resume alert
 * POST /api/v1/rate-alerts/:id/resume
 * Access: Authenticated users
 */
exports.resumeAlert = async (req, res, next) => {
  try {
    const { id } = req.params;

    const alert = await RateAlert.findById(id);
    if (!alert) {
      return next(createError(404, 'Rate alert not found'));
    }

    // Authorization check
    if (alert.user.toString() !== req.user.userId) {
      return next(createError(403, 'Not authorized to resume this alert'));
    }

    if (alert.status === 'paused') {
      alert.status = 'active';
      await alert.save();
    }

    logger.info('Rate alert resumed', {
      userId: req.user.userId,
      alertId: id
    });

    res.json({
      success: true,
      data: alert
    });
  } catch (err) {
    logger.error(`Error resuming alert: ${err.message}`);
    next(err);
  }
};
