const ConsentManagement = require('../models/ConsentManagement');
const User = require('../models/User');
const LoanApplication = require('../models/LoanApplication');
const createError = require('http-errors');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

/**
 * @desc    Request consent from borrower
 * @route   POST /api/v1/consent/request
 * @access  Private (Realtor, Broker, LO)
 */
exports.requestConsent = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, { errors: errors.array() }));
    }

    const {
      borrowerId,
      loanId,
      dataScope,
      purpose,
      purposeDescription,
      expirationDays
    } = req.body;

    // Verify borrower exists
    const borrower = await User.findById(borrowerId);
    if (!borrower || borrower.role !== 'borrower') {
      return next(createError(404, 'Borrower not found'));
    }

    // Verify loan if provided
    if (loanId) {
      const loan = await LoanApplication.findById(loanId);
      if (!loan) {
        return next(createError(404, 'Loan not found'));
      }

      // Verify loan belongs to borrower
      if (loan.borrower.toString() !== borrowerId) {
        return next(createError(403, 'Loan does not belong to this borrower'));
      }
    }

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (expirationDays || 365));

    // Generate consent text
    const consentText = exports.generateConsentText(req.user, dataScope, purpose);

    // Create consent request
    const consent = await ConsentManagement.create({
      borrower: borrowerId,
      grantedTo: req.user.userId,
      grantedToRole: req.user.role,
      loan: loanId || null,
      dataScope,
      purpose,
      purposeDescription,
      status: 'pending',
      expiresAt,
      consentText,
      consentVersion: '1.0',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      auditLog: [{
        action: 'created',
        performedBy: req.user.userId,
        timestamp: new Date(),
        details: 'Consent request created',
        ipAddress: req.ip
      }]
    });

    logger.info('Consent request created', {
      consentId: consent._id,
      borrowerId,
      requestedBy: req.user.userId
    });

    res.status(201).json({
      success: true,
      data: { consent },
      message: 'Consent request sent to borrower'
    });
  } catch (error) {
    logger.error('Error requesting consent:', error);
    next(error);
  }
};

/**
 * @desc    Grant consent (borrower approves)
 * @route   POST /api/v1/consent/:id/grant
 * @access  Private (Borrower only)
 */
exports.grantConsent = async (req, res, next) => {
  try {
    const { id } = req.params;

    const consent = await ConsentManagement.findById(id)
      .populate('grantedTo', 'name email role')
      .populate('loan', 'loanAmount status');

    if (!consent) {
      return next(createError(404, 'Consent request not found'));
    }

    // Only borrower can grant consent
    if (consent.borrower.toString() !== req.user.userId) {
      return next(createError(403, 'Not authorized to grant this consent'));
    }

    // Check if already granted or revoked
    if (consent.status !== 'pending') {
      return next(createError(400, `Consent is already ${consent.status}`));
    }

    // Grant consent
    await consent.grant();

    logger.info('Consent granted', {
      consentId: consent._id,
      borrowerId: consent.borrower,
      grantedTo: consent.grantedTo._id
    });

    res.json({
      success: true,
      data: { consent },
      message: 'Consent granted successfully'
    });
  } catch (error) {
    logger.error('Error granting consent:', error);
    next(error);
  }
};

/**
 * @desc    Revoke consent
 * @route   POST /api/v1/consent/:id/revoke
 * @access  Private (Borrower or Admin)
 */
exports.revokeConsent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const consent = await ConsentManagement.findById(id);
    if (!consent) {
      return next(createError(404, 'Consent not found'));
    }

    // Only borrower or admin can revoke
    if (
      consent.borrower.toString() !== req.user.userId &&
      req.user.role?.slug !== 'admin'
    ) {
      return next(createError(403, 'Not authorized to revoke this consent'));
    }

    // Check if already revoked
    if (consent.status === 'revoked') {
      return next(createError(400, 'Consent is already revoked'));
    }

    // Revoke consent
    await consent.revoke(req.user.userId, reason);

    logger.info('Consent revoked', {
      consentId: consent._id,
      revokedBy: req.user.userId,
      reason
    });

    res.json({
      success: true,
      message: 'Consent revoked successfully'
    });
  } catch (error) {
    logger.error('Error revoking consent:', error);
    next(error);
  }
};

/**
 * @desc    Get user's consents
 * @route   GET /api/v1/consent
 * @access  Private
 */
exports.getConsents = async (req, res, next) => {
  try {
    const { status, role, includeExpired } = req.query;

    let query = {};

    // Borrowers see consents they granted
    if (req.user.role?.slug === 'borrower') {
      query.borrower = req.user.userId;
    } else {
      // Others see consents granted to them
      query.grantedTo = req.user.userId;
    }

    // Filter by status
    if (status) {
      query.status = status;
    } else if (!includeExpired) {
      query.status = { $in: ['pending', 'active'] };
    }

    // Filter by role (for borrowers)
    if (role && req.user.role?.slug === 'borrower') {
      query.grantedToRole = role;
    }

    const consents = await ConsentManagement.find(query)
      .populate('borrower', 'name email')
      .populate('grantedTo', 'name email role')
      .populate('loan', 'loanAmount status')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: consents.length,
      data: { consents }
    });
  } catch (error) {
    logger.error('Error fetching consents:', error);
    next(error);
  }
};

/**
 * @desc    Get single consent details
 * @route   GET /api/v1/consent/:id
 * @access  Private
 */
exports.getConsent = async (req, res, next) => {
  try {
    const { id } = req.params;

    const consent = await ConsentManagement.findById(id)
      .populate('borrower', 'name email phone')
      .populate('grantedTo', 'name email role phone')
      .populate('loan', 'loanAmount status propertyAddress')
      .populate('auditLog.performedBy', 'name email');

    if (!consent) {
      return next(createError(404, 'Consent not found'));
    }

    // Authorization check
    if (
      consent.borrower._id.toString() !== req.user.userId &&
      consent.grantedTo._id.toString() !== req.user.userId &&
      req.user.role?.slug !== 'admin'
    ) {
      return next(createError(403, 'Not authorized to view this consent'));
    }

    res.json({
      success: true,
      data: { consent }
    });
  } catch (error) {
    logger.error('Error fetching consent:', error);
    next(error);
  }
};

/**
 * @desc    Check if user has access to borrower data
 * @route   GET /api/v1/consent/check-access
 * @access  Private
 */
exports.checkAccess = async (req, res, next) => {
  try {
    const { borrowerId, dataScope } = req.query;

    if (!borrowerId) {
      return next(createError(400, 'Borrower ID is required'));
    }

    const hasAccess = await ConsentManagement.hasActiveConsent(
      borrowerId,
      req.user.userId,
      dataScope
    );

    res.json({
      success: true,
      data: {
        hasAccess,
        borrowerId,
        userId: req.user.userId,
        dataScope: dataScope || 'all'
      }
    });
  } catch (error) {
    logger.error('Error checking access:', error);
    next(error);
  }
};

/**
 * @desc    Log consent access (for audit trail)
 * @route   POST /api/v1/consent/:id/log-access
 * @access  Private
 */
exports.logAccess = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { details } = req.body;

    const consent = await ConsentManagement.findById(id);
    if (!consent) {
      return next(createError(404, 'Consent not found'));
    }

    // Verify user has consent
    if (consent.grantedTo.toString() !== req.user.userId) {
      return next(createError(403, 'Not authorized'));
    }

    // Log access
    await consent.logAccess(req.user.userId, details, req.ip);

    res.json({
      success: true,
      message: 'Access logged successfully'
    });
  } catch (error) {
    logger.error('Error logging access:', error);
    next(error);
  }
};

/**
 * Generate consent text
 */
exports.generateConsentText = function(requester, dataScope, purpose) {
  const scopeDescriptions = [];
  
  if (dataScope.personalInfo) scopeDescriptions.push('personal information (name, email, phone, address)');
  if (dataScope.financialInfo) scopeDescriptions.push('financial information (income, assets, debts, credit score)');
  if (dataScope.loanDetails) scopeDescriptions.push('loan details (amount, rate, terms, status)');
  if (dataScope.documents) scopeDescriptions.push('uploaded documents and files');
  if (dataScope.milestones) scopeDescriptions.push('loan progress and milestone updates');
  if (dataScope.communications) scopeDescriptions.push('messages and notifications');

  const scopeText = scopeDescriptions.join(', ');

  return `By granting this consent, you authorize ${requester.name || 'the requesting party'} to access your ${scopeText} for the purpose of ${purpose}. This consent can be revoked at any time from your account settings. Your data will be handled in accordance with FAHM's Privacy Policy and applicable regulations (GLBA, CCPA).`;
};
