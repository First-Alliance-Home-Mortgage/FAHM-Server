const createError = require('http-errors');
const { validationResult } = require('express-validator');
const RateSnapshot = require('../models/RateSnapshot');
const RateAlert = require('../models/RateAlert');
const ProductPricing = require('../models/ProductPricing');
const RateLock = require('../models/RateLock');
const LoanApplication = require('../models/LoanApplication');
const Notification = require('../models/Notification');
const optimalBlueService = require('../services/optimalBlueService');
const totalExpertService = require('../services/totalExpertService');
const logger = require('../utils/logger');

/**
 * Get current rates from Optimal Blue
 * GET /api/v1/rates/current
 */
exports.getCurrentRates = async (req, res, next) => {
  try {
    const {
      loanAmount,
      productType,
      loanTerm,
      loanPurpose,
      propertyType,
      occupancy,
      ltv,
      creditScore,
      refresh,
      ttlMs,
    } = req.query;

    const scenario = {
      loanAmount: loanAmount ? parseFloat(loanAmount) : undefined,
      productType,
      loanTerm: loanTerm ? parseInt(loanTerm) : undefined,
      loanPurpose,
      propertyType,
      occupancy,
      ltv: ltv ? parseFloat(ltv) : undefined,
      creditScore: creditScore ? parseInt(creditScore) : undefined,
    };

    const useCache = refresh !== 'true';
    const ttl = ttlMs ? parseInt(ttlMs, 10) : undefined;

    // Fetch rates from Optimal Blue with optional caching for responsiveness
    const ratesFromOB = useCache
      ? await optimalBlueService.getRateSheetCached(scenario, ttl)
      : await optimalBlueService.getRateSheet(scenario);

    // Save snapshots to database for compliance history
    const savedSnapshots = [];
    for (const rateData of ratesFromOB) {
      const snapshot = new RateSnapshot(rateData);
      await snapshot.save();
      savedSnapshots.push(snapshot);
    }

    logger.info('Fetched current rates from Optimal Blue', {
      userId: req.user._id,
      count: savedSnapshots.length
    });

    res.json({
      success: true,
      data: savedSnapshots
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

        // Log to CRM
        await totalExpertService.logActivity(alert.user._id, {
          type: 'rate_alert_triggered',
          subject: `Rate Alert Triggered: ${alert.productType} ${alert.loanTerm}yr`,
          description: `Rate dropped to ${currentRate}% (target: ${alert.targetRate}%)`,
          metadata: {
            alertId: alert._id,
            productType: alert.productType,
            loanTerm: alert.loanTerm,
            targetRate: alert.targetRate,
            currentRate,
            triggerType: alert.triggerType
          }
        });

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
 * Submit rate lock request
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

    // Submit to Optimal Blue
    const lockResult = await optimalBlueService.submitRateLock({
      loanId: loan._id,
      rate: snapshot.rate,
      lockPeriod,
      loanAmount: loan.loanAmount,
      productType: snapshot.productType,
      loanTerm: snapshot.loanTerm,
      borrower: {
        name: req.user.name,
        creditScore: loan.creditScore || 700
      },
      property: {
        address: loan.propertyAddress,
        type: loan.propertyType,
        occupancy: loan.occupancy,
        value: loan.propertyValue
      }
    });

    // Create rate lock record
    const rateLock = new RateLock({
      loan: loanId,
      borrower: loan.borrower,
      lockedBy: req.user._id,
      optimalBlueLockId: lockResult.optimalBlueLockId,
      rateSnapshot: rateSnapshotId,
      lockedRate: snapshot.rate,
      lockedAPR: snapshot.apr,
      points: snapshot.points,
      lockPeriod,
      lockExpiresAt: lockResult.lockExpiresAt,
      status: lockResult.status,
      confirmedAt: lockResult.confirmedAt,
      loanAmount: loan.loanAmount,
      productType: snapshot.productType,
      loanTerm: snapshot.loanTerm,
      loanPurpose: snapshot.loanPurpose,
      propertyType: loan.propertyType,
      occupancy: loan.occupancy,
      ltv: loan.ltv,
      creditScore: loan.creditScore,
      pricing: {
        baseRate: snapshot.rate,
        adjustments: snapshot.adjustments.total,
        totalAdjustment: snapshot.adjustments.total
      },
      investorName: lockResult.investorName,
      investorLockConfirmation: lockResult.investorLockConfirmation,
      notes
    });

    await rateLock.save();

    // Update loan with rate lock info
    loan.interestRate = snapshot.rate;
    loan.rateLockExpiresAt = lockResult.lockExpiresAt;
    await loan.save();

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
 * Extend rate lock
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

    // Submit extension to Optimal Blue
    const extensionResult = await optimalBlueService.extendRateLock(
      rateLock.optimalBlueLockId,
      extensionDays,
      reason
    );

    // Update rate lock record
    const originalExpiration = rateLock.lockExpiresAt;
    rateLock.lockExpiresAt = extensionResult.newExpiration;
    rateLock.status = 'extended';
    rateLock.extensionHistory.push({
      extendedBy: req.user._id,
      extendedAt: new Date(),
      originalExpiration,
      newExpiration: extensionResult.newExpiration,
      extensionDays,
      extensionFee: extensionResult.extensionFee,
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
 * Get product pricing from Optimal Blue
 * GET /api/v1/rates/products
 */
exports.getProductPricing = async (req, res, next) => {
  try {
    const { productType, loanTerm, investorName } = req.query;

    // Fetch from Optimal Blue
    const products = await optimalBlueService.getProductPricing({
      productType,
      loanTerm: loanTerm ? parseInt(loanTerm) : undefined,
      investorName
    });

    // Save to database
    for (const productData of products) {
      await ProductPricing.findOneAndUpdate(
        { optimalBlueProductId: productData.optimalBlueProductId },
        productData,
        { upsert: true, new: true }
      );
    }

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
    
    // SMS and email would integrate with external services (e.g., Twilio, SendGrid)
    // Placeholder implementation
    logger.info(`Rate alert ${method} notification sent`, {
      userId: user._id,
      alertId: alert._id,
      method
    });
  }
}

module.exports = exports;
