const jwt = require('jsonwebtoken');
const createError = require('http-errors');
const { validationResult } = require('express-validator');
const { jwtSecret } = require('../config/env');
const defaults = require('../config/defaults');
const { audit } = require('../utils/audit');
const blendPOSService = require('../services/blendPOSService');
const bigPOSService = require('../services/bigPOSService');
const encompassService = require('../services/encompassService');
const totalExpertService = require('../services/totalExpertService');
const LoanApplication = require('../models/LoanApplication');
const User = require('../models/User');
const logger = require('../utils/logger');
const { assertSafeUrl } = require('../utils/ssrf');

// simple in-memory rate limit for token mints per user per minute
const mintWindow = new Map();

function withinRateLimit(userId) {
  const now = Date.now();
  const windowStart = now - 60 * 1000;
  const events = mintWindow.get(userId) || [];
  const recent = events.filter((t) => t >= windowStart);
  recent.push(now);
  mintWindow.set(userId, recent);
  return recent.length <= defaults.pos.maxMintsPerMinute;
}

exports.createHandoff = async (req, res, next) => {
  try {
    if (!withinRateLimit(req.user._id.toString())) {
      return next(createError(429, 'Too many POS handoff requests, try again shortly'));
    }

    const payload = {
      sub: req.user._id.toString(),
      loan: req.body.loanId,
      role: req.user.role,
    };
    const token = jwt.sign(payload, jwtSecret, { expiresIn: `${defaults.pos.tokenTtlMinutes}m` });
    const deepLink = `${defaults.pos.deepLinkBase}?token=${encodeURIComponent(token)}`;

    await audit(
      {
        action: 'pos.handoff',
        entityType: 'POS',
        metadata: { loan: req.body.loanId, deepLinkBase: defaults.pos.deepLinkBase },
      },
      req
    );

    return res.json({ token, deepLink, expiresInMinutes: defaults.pos.tokenTtlMinutes });
  } catch (err) {
    await audit(
      {
        action: 'pos.handoff',
        entityType: 'POS',
        status: 'error',
        metadata: { message: err.message },
      },
      req
    );
    return next(err);
  }
};

/**
 * Initiate POS application with Blend or Big POS
 * @route POST /api/v1/pos/initiate
 */
exports.initiateApplication = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, { errors: errors.array() }));
    }

    const { loanId, posSystem, returnUrl, logoUrl, primaryColor, secondaryColor } = req.body;

    // SSRF guard on optional callback assets
    if (returnUrl) assertSafeUrl(returnUrl);
    if (logoUrl) assertSafeUrl(logoUrl);

    // Get loan application
    const loan = await LoanApplication.findById(loanId)
      .populate('borrower')
      .populate('assignedOfficer', 'name nmls');

    if (!loan) {
      return next(createError(404, 'Loan application not found'));
    }

    // Authorization check
    if (req.user.role === 'borrower' && loan.borrower._id.toString() !== req.user._id.toString()) {
      return next(createError(403, 'Not authorized to access this loan'));
    }

    // Prepare borrower data
    const borrowerData = {
      email: loan.borrower.email,
      firstName: loan.borrower.name.split(' ')[0],
      lastName: loan.borrower.name.split(' ').slice(1).join(' ') || loan.borrower.name.split(' ')[0],
      phone: loan.borrower.phone,
      ssn: loan.borrower.ssn
    };

    // Prepare loan data
    const loanData = {
      loanAmount: loan.loanAmount,
      propertyAddress: loan.propertyAddress,
      propertyValue: loan.purchasePrice || loan.loanAmount / 0.8,
      loanPurpose: loan.loanPurpose || 'purchase',
      productType: loan.productType,
      fahmLoanId: loan._id.toString(),
      loanOfficerId: loan.assignedOfficer?._id.toString(),
      loanOfficerName: loan.assignedOfficer?.name,
      loanOfficerNMLS: loan.assignedOfficer?.nmls,
      referralSource: loan.referralSource
    };

    // Options
    const options = {
      returnUrl: returnUrl || 'https://app.fahm.com/dashboard',
      cancelUrl: 'https://app.fahm.com/dashboard',
      logoUrl,
      primaryColor,
      secondaryColor
    };

    // Initiate with selected POS system
    let result;
    if (posSystem === 'blend') {
      result = await blendPOSService.createSSOHandoff(borrowerData, loanData, options);
    } else if (posSystem === 'big_pos') {
      result = await bigPOSService.createSSOHandoff(borrowerData, loanData, options);
    } else {
      return next(createError(400, 'Invalid POS system. Must be "blend" or "big_pos"'));
    }

    // Update loan with POS application ID
    loan.posSystem = posSystem;
    loan.posApplicationId = result.applicationId;
    await loan.save();

    await audit({
      action: 'pos.initiate',
      entityType: 'POS',
      entityId: result.applicationId,
      metadata: { loanId, posSystem }
    }, req);

    res.status(201).json({
      success: true,
      posSystem,
      applicationId: result.applicationId,
      ssoUrl: result.ssoUrl,
      expiresAt: result.expiresAt,
      message: 'POS application initiated successfully'
    });
  } catch (error) {
    logger.error('Initiate POS application error:', error);
    next(error);
  }
};

/**
 * Get POS application status
 * @route GET /api/v1/pos/application/:applicationId/status
 */
exports.getApplicationStatus = async (req, res, next) => {
  try {
    const { applicationId } = req.params;
    const { posSystem } = req.query;

    if (!posSystem || !['blend', 'big_pos'].includes(posSystem)) {
      return next(createError(400, 'Invalid or missing posSystem query parameter'));
    }

    let result;
    if (posSystem === 'blend') {
      result = await blendPOSService.getApplicationStatus(applicationId);
    } else {
      result = await bigPOSService.getApplicationStatus(applicationId);
    }

    res.json(result);
  } catch (error) {
    logger.error('Get POS application status error:', error);
    next(error);
  }
};

/**
 * Sync borrower data to POS
 * @route POST /api/v1/pos/application/:applicationId/sync-borrower
 */
exports.syncBorrowerData = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, { errors: errors.array() }));
    }

    const { applicationId } = req.params;
    const { posSystem, borrowerData } = req.body;

    if (!posSystem || !['blend', 'big_pos'].includes(posSystem)) {
      return next(createError(400, 'Invalid or missing posSystem'));
    }

    let result;
    if (posSystem === 'blend') {
      result = await blendPOSService.syncBorrowerData(applicationId, borrowerData);
    } else {
      result = await bigPOSService.syncBorrowerData(applicationId, borrowerData);
    }

    await audit({
      action: 'pos.sync_borrower',
      entityType: 'POS',
      entityId: applicationId,
      metadata: { posSystem }
    }, req);

    res.json(result);
  } catch (error) {
    logger.error('Sync borrower data to POS error:', error);
    next(error);
  }
};

/**
 * Get POS application documents
 * @route GET /api/v1/pos/application/:applicationId/documents
 */
exports.getDocuments = async (req, res, next) => {
  try {
    const { applicationId } = req.params;
    const { posSystem } = req.query;

    if (!posSystem || !['blend', 'big_pos'].includes(posSystem)) {
      return next(createError(400, 'Invalid or missing posSystem query parameter'));
    }

    let result;
    if (posSystem === 'blend') {
      result = await blendPOSService.getDocuments(applicationId);
    } else {
      result = await bigPOSService.getDocuments(applicationId);
    }

    res.json(result);
  } catch (error) {
    logger.error('Get POS documents error:', error);
    next(error);
  }
};

/**
 * Submit POS application
 * @route POST /api/v1/pos/application/:applicationId/submit
 */
exports.submitApplication = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, { errors: errors.array() }));
    }

    const { applicationId } = req.params;
    const { posSystem, submissionData } = req.body;

    if (!posSystem || !['blend', 'big_pos'].includes(posSystem)) {
      return next(createError(400, 'Invalid or missing posSystem'));
    }

    let result;
    if (posSystem === 'blend') {
      result = await blendPOSService.submitApplication(applicationId);
    } else {
      result = await bigPOSService.submitApplication(applicationId, submissionData);
    }

    await audit({
      action: 'pos.submit',
      entityType: 'POS',
      entityId: applicationId,
      metadata: { posSystem, confirmationNumber: result.confirmationNumber }
    }, req);

    res.json(result);
  } catch (error) {
    logger.error('Submit POS application error:', error);
    next(error);
  }
};

/**
 * Handle webhook from Blend POS
 * @route POST /api/v1/pos/webhooks/blend
 */
exports.handleBlendWebhook = async (req, res, next) => {
  try {
    const signature = req.get('X-Blend-Signature');
    const event = req.body;

    // Verify webhook signature
    if (!signature || !blendPOSService.verifyWebhookSignature(event, signature)) {
      return next(createError(401, 'Invalid webhook signature'));
    }

    // Process webhook event
    const result = await blendPOSService.processWebhookEvent(event);

    // Trigger CRM sync if needed
    if (result.shouldSyncCRM) {
      try {
        const loan = await LoanApplication.findOne({ posApplicationId: event.application_id });
        if (loan && loan.borrower) {
          const user = await User.findById(loan.borrower);
          if (user.totalExpertContactId) {
            await totalExpertService.logActivity(user.totalExpertContactId, {
              activityType: 'pos_application_submitted',
              description: `POS application submitted via Blend`,
              metadata: { applicationId: event.application_id }
            });
          }
        }
      } catch (crmError) {
        logger.error('CRM sync error after Blend webhook:', crmError);
      }
    }

    // Trigger Encompass sync if needed
    if (result.shouldSyncEncompass) {
      try {
        const loan = await LoanApplication.findOne({ posApplicationId: event.application_id });
        if (loan && loan.encompassLoanId) {
          await encompassService.updateLoanStatus(loan.encompassLoanId, {
            status: 'Application Submitted',
            lastUpdated: new Date()
          });
        }
      } catch (encompassError) {
        logger.error('Encompass sync error after Blend webhook:', encompassError);
      }
    }

    logger.info('Blend webhook processed successfully:', result);
    res.json({ success: true, processed: true });
  } catch (error) {
    logger.error('Blend webhook error:', error);
    next(error);
  }
};

/**
 * Handle webhook from Big POS
 * @route POST /api/v1/pos/webhooks/big-pos
 */
exports.handleBigPOSWebhook = async (req, res, next) => {
  try {
    const signature = req.get('X-BigPOS-Signature');
    const event = req.body;

    // Verify webhook signature
    if (!signature || !bigPOSService.verifyWebhookSignature(event, signature)) {
      return next(createError(401, 'Invalid webhook signature'));
    }

    // Process webhook event
    const result = await bigPOSService.processWebhookEvent(event);

    // Trigger CRM sync if needed
    if (result.shouldSyncCRM) {
      try {
        const loan = await LoanApplication.findOne({ posApplicationId: event.applicationId });
        if (loan && loan.borrower) {
          const user = await User.findById(loan.borrower);
          if (user.totalExpertContactId) {
            await totalExpertService.logActivity(user.totalExpertContactId, {
              activityType: 'pos_application_submitted',
              description: `POS application submitted via Big POS`,
              metadata: { applicationId: event.applicationId, confirmationNumber: result.confirmationNumber }
            });
          }
        }
      } catch (crmError) {
        logger.error('CRM sync error after Big POS webhook:', crmError);
      }
    }

    // Trigger Encompass sync if needed
    if (result.shouldSyncEncompass) {
      try {
        const loan = await LoanApplication.findOne({ posApplicationId: event.applicationId });
        if (loan && loan.encompassLoanId) {
          await encompassService.updateLoanStatus(loan.encompassLoanId, {
            status: 'Application Submitted',
            lastUpdated: new Date()
          });
        }
      } catch (encompassError) {
        logger.error('Encompass sync error after Big POS webhook:', encompassError);
      }
    }

    logger.info('Big POS webhook processed successfully:', result);
    res.json({ success: true, processed: true });
  } catch (error) {
    logger.error('Big POS webhook error:', error);
    next(error);
  }
};


