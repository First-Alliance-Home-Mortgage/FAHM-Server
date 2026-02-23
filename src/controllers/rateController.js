const createError = require('http-errors');
const { validationResult } = require('express-validator');
const RateSnapshot = require('../models/RateSnapshot');
const RateAlert = require('../models/RateAlert');
const ProductPricing = require('../models/ProductPricing');
const RateLock = require('../models/RateLock');
const LoanApplication = require('../models/LoanApplication');
const Notification = require('../models/Notification');
const logger = require('../utils/logger');

/**
 * Get current rates from local database
 * GET /api/v1/rates/current
 */
exports.getCurrentRates = async (req, res, next) => {
  try {
    const {
      productType,
      loanTerm,
      loanPurpose,
    } = req.query;

    const query = { isActive: true };

    if (productType) {
      query.productType = productType;
    }

    if (loanTerm) {
      query.loanTerm = parseInt(loanTerm);
    }

    if (loanPurpose) {
      query.loanPurpose = loanPurpose;
    }

    // Get the most recent active rates (within last 24 hours)
    query.effectiveDate = { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) };

    const rates = await RateSnapshot.find(query)
      .sort({ effectiveDate: -1 })
      .limit(50);

    logger.info('Fetched current rates from local data', {
      userId: req.user._id,
      count: rates.length
    });

    res.json({
      success: true,
      data: rates
    });
  } catch (error) {
    logger.error('Error fetching current rates:', error);
    next(error);
  }
};

/**
 * Get rate history for compliance and trending
 * GET /api/v1/rates/history
 */
exports.getRateHistory = async (req, res, next) => {
  try {
    const { productType, loanTerm, startDate, endDate, limit = 100 } = req.query;

    const query = { isActive: true };

    if (productType) {
      query.productType = productType;
    }

    if (loanTerm) {
      query.loanTerm = parseInt(loanTerm);
    }

    if (startDate || endDate) {
      query.effectiveDate = {};
      if (startDate) {
        query.effectiveDate.$gte = new Date(startDate);
      }
      if (endDate) {
        query.effectiveDate.$lte = new Date(endDate);
      }
    }

    const rateHistory = await RateSnapshot.find(query)
      .sort({ effectiveDate: -1 })
      .limit(parseInt(limit));

    logger.info('Retrieved rate history', {
      userId: req.user._id,
      count: rateHistory.length
    });

    res.json({
      success: true,
      data: rateHistory
    });
  } catch (error) {
    logger.error('Error retrieving rate history:', error);
    next(error);
  }
};

/**
 * Create rate alert for user
 * POST /api/v1/rates/alerts
 */
exports.createRateAlert = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, { errors: errors.array() }));
    }

    const {
      productType,
      loanTerm,
      targetRate,
      triggerType,
      dropAmount,
      notificationMethod,
      loan
    } = req.body;

    const alertData = {
      user: req.user._id,
      productType,
      loanTerm,
      targetRate,
      triggerType,
      notificationMethod,
      status: 'active'
    };

    if (dropAmount !== undefined) {
      alertData.dropAmount = dropAmount;
    }

    if (loan) {
      // Verify user has access to this loan
      const loanApp = await LoanApplication.findById(loan);
      if (!loanApp) {
        return next(createError(404, 'Loan not found'));
      }
      if (loanApp.borrower.toString() !== req.user._id.toString() &&
          loanApp.assignedOfficer?.toString() !== req.user._id.toString()) {
        return next(createError(403, 'Access denied to this loan'));
      }
      alertData.loan = loan;
    }

    const alert = new RateAlert(alertData);
    await alert.save();

    logger.info('Created rate alert', {
      userId: req.user._id,
      alertId: alert._id,
      productType,
      loanTerm,
      targetRate
    });

    res.status(201).json({
      success: true,
      data: alert
    });
  } catch (error) {
    logger.error('Error creating rate alert:', error);
    next(error);
  }
};

/**
 * Get user's rate alerts
 * GET /api/v1/rates/alerts
 */
exports.getUserAlerts = async (req, res, next) => {
  try {
    const { status } = req.query;

    const query = { user: req.user._id };
    if (status) {
      query.status = status;
    }

    const alerts = await RateAlert.find(query)
      .populate('loan', 'loanAmount propertyAddress status')
      .sort({ createdAt: -1 });

    logger.info('Retrieved user rate alerts', {
      userId: req.user._id,
      count: alerts.length
    });

    res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    logger.error('Error retrieving user alerts:', error);
    next(error);
  }
};

/**
 * Update rate alert
 * PUT /api/v1/rates/alerts/:alertId
 */
exports.updateRateAlert = async (req, res, next) => {
  try {
    const { alertId } = req.params;
    const { targetRate, notificationMethod, status } = req.body;

    const alert = await RateAlert.findById(alertId);
    if (!alert) {
      return next(createError(404, 'Rate alert not found'));
    }

    if (alert.user.toString() !== req.user._id.toString()) {
      return next(createError(403, 'Access denied to this alert'));
    }

    if (targetRate !== undefined) alert.targetRate = targetRate;
    if (notificationMethod) alert.notificationMethod = notificationMethod;
    if (status) alert.status = status;

    await alert.save();

    logger.info('Updated rate alert', {
      userId: req.user._id,
      alertId: alert._id
    });

    res.json({
      success: true,
      data: alert
    });
  } catch (error) {
    logger.error('Error updating rate alert:', error);
    next(error);
  }
};

/**
 * Delete rate alert
 * DELETE /api/v1/rates/alerts/:alertId
 */
exports.deleteRateAlert = async (req, res, next) => {
  try {
    const { alertId } = req.params;

    const alert = await RateAlert.findById(alertId);
    if (!alert) {
      return next(createError(404, 'Rate alert not found'));
    }

    if (alert.user.toString() !== req.user._id.toString()) {
      return next(createError(403, 'Access denied to this alert'));
    }

    alert.status = 'cancelled';
    await alert.save();

    logger.info('Cancelled rate alert', {
      userId: req.user._id,
      alertId: alert._id
    });

    res.json({
      success: true,
      message: 'Rate alert cancelled'
    });
  } catch (error) {
    logger.error('Error deleting rate alert:', error);
    next(error);
  }
};

/**
 * Check all active alerts against current rates (used by scheduler)
 * POST /api/v1/rates/alerts/check
 */
exports.checkRateAlerts = async (req, res, next) => {
  try {
    const activeAlerts = await RateAlert.find({ status: 'active' })
      .populate('user', 'name email phone')
      .populate('loan', 'loanAmount');

    const triggeredAlerts = [];

    for (const alert of activeAlerts) {
      // Get current rate for this product/term combination
      const currentRates = await RateSnapshot.find({
        productType: alert.productType,
        loanTerm: alert.loanTerm,
        isActive: true,
        effectiveDate: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      })
        .sort({ effectiveDate: -1 })
        .limit(1);

      if (currentRates.length === 0) continue;

      const currentRate = currentRates[0].rate;
      let shouldTrigger = false;

      switch (alert.triggerType) {
        case 'below':
          shouldTrigger = currentRate <= alert.targetRate;
          break;
        case 'above':
          shouldTrigger = currentRate >= alert.targetRate;
          break;
        case 'drops_by':
          if (alert.baselineRate) {
            const drop = alert.baselineRate - currentRate;
            shouldTrigger = drop >= alert.dropAmount;
          } else {
            alert.baselineRate = currentRate;
            await alert.save();
          }
          break;
      }

      if (shouldTrigger) {
        alert.status = 'triggered';
        alert.triggeredAt = new Date();
        alert.triggeredRate = currentRate;
        await alert.save();

        // Send notification based on preference
        await sendRateAlertNotification(alert, currentRate);

        triggeredAlerts.push(alert);
      }

      alert.lastCheckedAt = new Date();
      await alert.save();
    }

    logger.info('Checked rate alerts', {
      totalChecked: activeAlerts.length,
      triggered: triggeredAlerts.length
    });

    res.json({
      success: true,
      data: {
        checked: activeAlerts.length,
        triggered: triggeredAlerts.length,
        alerts: triggeredAlerts
      }
    });
  } catch (error) {
    logger.error('Error checking rate alerts:', error);
    next(error);
  }
};

/**
 * Submit rate lock request (local)
 * POST /api/v1/rates/locks
 */
exports.submitRateLock = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, { errors: errors.array() }));
    }

    const { loanId, rateSnapshotId, lockPeriod, notes } = req.body;

    // Verify loan exists and user has access
    const loan = await LoanApplication.findById(loanId);
    if (!loan) {
      return next(createError(404, 'Loan not found'));
    }

    // Only borrower or assigned LO can lock rate
    if (loan.borrower.toString() !== req.user._id.toString() &&
        loan.assignedOfficer?.toString() !== req.user._id.toString()) {
      return next(createError(403, 'Access denied to this loan'));
    }

    // Get rate snapshot
    const snapshot = await RateSnapshot.findById(rateSnapshotId);
    if (!snapshot || !snapshot.isActive) {
      return next(createError(404, 'Rate snapshot not found or expired'));
    }

    // Calculate lock expiration
    const lockExpiresAt = new Date(Date.now() + lockPeriod * 24 * 60 * 60 * 1000);

    // Create rate lock record locally
    const rateLock = new RateLock({
      loan: loanId,
      borrower: loan.borrower,
      lockedBy: req.user._id,
      rateSnapshot: rateSnapshotId,
      lockedRate: snapshot.rate,
      lockedAPR: snapshot.apr,
      points: snapshot.points,
      lockPeriod,
      lockExpiresAt,
      status: 'confirmed',
      confirmedAt: new Date(),
      loanAmount: loan.amount,
      productType: snapshot.productType,
      loanTerm: snapshot.loanTerm,
      loanPurpose: snapshot.loanPurpose,
      pricing: {
        baseRate: snapshot.rate,
        adjustments: snapshot.adjustments?.total || 0,
        totalAdjustment: snapshot.adjustments?.total || 0
      },
      notes
    });

    await rateLock.save();

    // Notify borrower
    await Notification.create({
      user: loan.borrower,
      type: 'rate_lock_confirmed',
      title: 'Rate Lock Confirmed',
      message: `Your rate of ${snapshot.rate}% has been locked for ${lockPeriod} days`,
      relatedLoan: loanId
    });

    logger.info('Rate lock submitted', {
      userId: req.user._id,
      loanId,
      rateLockId: rateLock._id,
      rate: snapshot.rate,
      lockPeriod
    });

    res.status(201).json({
      success: true,
      data: rateLock
    });
  } catch (error) {
    logger.error('Error submitting rate lock:', error);
    next(error);
  }
};

/**
 * Get rate locks for a loan
 * GET /api/v1/rates/locks/loan/:loanId
 */
exports.getLoanRateLocks = async (req, res, next) => {
  try {
    const { loanId } = req.params;

    const loan = await LoanApplication.findById(loanId);
    if (!loan) {
      return next(createError(404, 'Loan not found'));
    }

    if (loan.borrower.toString() !== req.user._id.toString() &&
        loan.assignedOfficer?.toString() !== req.user._id.toString()) {
      return next(createError(403, 'Access denied to this loan'));
    }

    const rateLocks = await RateLock.find({ loan: loanId })
      .populate('rateSnapshot')
      .populate('lockedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: rateLocks
    });
  } catch (error) {
    logger.error('Error retrieving loan rate locks:', error);
    next(error);
  }
};

/**
 * Extend rate lock (local)
 * POST /api/v1/rates/locks/:lockId/extend
 */
exports.extendRateLock = async (req, res, next) => {
  try {
    const { lockId } = req.params;
    const { extensionDays, reason } = req.body;

    const rateLock = await RateLock.findById(lockId).populate('loan');
    if (!rateLock) {
      return next(createError(404, 'Rate lock not found'));
    }

    // Only assigned LO can extend
    if (rateLock.loan.assignedOfficer?.toString() !== req.user._id.toString()) {
      return next(createError(403, 'Only assigned loan officer can extend rate lock'));
    }

    if (rateLock.status === 'expired' || rateLock.status === 'released') {
      return next(createError(400, 'Cannot extend expired or released rate lock'));
    }

    // Calculate new expiration locally
    const originalExpiration = rateLock.lockExpiresAt;
    const newExpiration = new Date(originalExpiration.getTime() + extensionDays * 24 * 60 * 60 * 1000);

    rateLock.lockExpiresAt = newExpiration;
    rateLock.status = 'extended';
    rateLock.extensionHistory.push({
      extendedBy: req.user._id,
      extendedAt: new Date(),
      originalExpiration,
      newExpiration,
      extensionDays,
      extensionFee: 0,
      reason
    });

    await rateLock.save();

    logger.info('Rate lock extended', {
      userId: req.user._id,
      lockId: rateLock._id,
      extensionDays
    });

    res.json({
      success: true,
      data: rateLock
    });
  } catch (error) {
    logger.error('Error extending rate lock:', error);
    next(error);
  }
};

/**
 * Get product pricing from local database
 * GET /api/v1/rates/products
 */
exports.getProductPricing = async (req, res, next) => {
  try {
    const { productType, loanTerm, investorName } = req.query;

    const query = { isActive: true };

    if (productType) {
      query.productType = productType;
    }

    if (loanTerm) {
      query.loanTerm = parseInt(loanTerm);
    }

    if (investorName) {
      query.investorName = { $regex: investorName, $options: 'i' };
    }

    const products = await ProductPricing.find(query)
      .sort({ productType: 1, loanTerm: 1 });

    logger.info('Retrieved product pricing', {
      userId: req.user._id,
      count: products.length
    });

    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    logger.error('Error retrieving product pricing:', error);
    next(error);
  }
};

/**
 * Helper: Send rate alert notification
 */
async function sendRateAlertNotification(alert, currentRate) {
  const user = alert.user;
  const methods = alert.notificationMethod === 'all'
    ? ['push', 'sms', 'email']
    : [alert.notificationMethod];

  const message = `Rate Alert: ${alert.productType.toUpperCase()} ${alert.loanTerm}-year rate is now ${currentRate}% (your target: ${alert.targetRate}%)`;

  for (const method of methods) {
    if (method === 'push') {
      await Notification.create({
        user: user._id,
        type: 'rate_alert',
        title: 'Rate Alert Triggered',
        message,
        relatedLoan: alert.loan
      });
    }

    logger.info(`Rate alert ${method} notification sent`, {
      userId: user._id,
      alertId: alert._id,
      method
    });
  }
}

module.exports = exports;
