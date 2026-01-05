const { validationResult } = require('express-validator');
const createError = require('http-errors');
const posLinkService = require('../services/posLinkService');
const POSSession = require('../models/POSSession');
const LoanApplication = require('../models/LoanApplication');
const logger = require('../utils/logger');
const roles = require('../config/roles');

/**
 * Generate POS link for borrower or loan officer
 * POST /api/v1/pos-link/generate
 * Access: Authenticated users
 */
exports.generateLink = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, { errors: errors.array() }));
    }

    const {
      loanId,
      loanOfficerId,
      referralSourceId,
      posSystem,
      purpose,
      source,
      expirationMinutes,
      branding,
    } = req.body;

    const userId = req.user.userId;

    // If loan ID provided, verify access
    if (loanId) {
      const loan = await LoanApplication.findById(loanId);
      
      if (!loan) {
        return next(createError(404, 'Loan not found'));
      }

      // Authorization: Borrower can only access own loans, LOs can access assigned loans
      if (req.user.role === roles.BORROWER && loan.borrower.toString() !== userId) {
        return next(createError(403, 'Not authorized to access this loan'));
      } else if (
        (req.user.role === roles.LO_RETAIL || req.user.role === roles.LO_TPO) &&
        loan.assignedOfficer?.toString() !== userId &&
        req.user.role !== roles.ADMIN
      ) {
        return next(createError(403, 'Not authorized to access this loan'));
      }
    }

    // Generate POS link
    const linkData = await posLinkService.generatePOSLink({
      userId,
      loanId,
      loanOfficerId: loanOfficerId || req.user.userId,
      referralSourceId,
      posSystem: posSystem || 'blend',
      purpose: purpose || 'new_application',
      source: source || 'mobile_app',
      expirationMinutes: expirationMinutes || 60,
      branding,
      returnUrl,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    logger.info(`POS link generated: ${linkData.sessionId} by user ${userId}`);

    res.status(201).json({
      success: true,
      data: linkData
    });
  } catch (err) {
    logger.error(`Error generating POS link: ${err.message}`);
    next(err);
  }
};

/**
 * Validate and activate POS session
 * POST /api/v1/pos-link/activate/:sessionId
 * Access: Public (validates session token)
 */
exports.activateSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { sessionToken } = req.body;

    if (!sessionToken) {
      return next(createError(400, 'Session token is required'));
    }

    // Validate session
    const session = await posLinkService.validateSession(sessionId, sessionToken);

    // Activate session with analytics
    const analytics = {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      deviceType: detectDeviceType(req.get('user-agent')),
      platform: detectPlatform(req.get('user-agent'))
    };

    await posLinkService.activateSession(sessionId, analytics);

    logger.info(`POS session activated: ${sessionId}`);

    res.json({
      success: true,
      data: {
        sessionId: session.sessionId,
        redirectUrl: session.redirectUrl,
        returnUrl: session.returnUrl,
        branding: session.branding,
        expiresAt: session.expiresAt
      }
    });
  } catch (err) {
    logger.error(`Error activating POS session: ${err.message}`);
    next(createError(400, err.message));
  }
};

/**
 * Track session event (page view, step completion, etc.)
 * POST /api/v1/pos-link/track/:sessionId
 * Access: Public (POS systems call this)
 */
exports.trackEvent = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { eventType, details } = req.body;

    if (!eventType) {
      return next(createError(400, 'Event type is required'));
    }

    await posLinkService.trackSessionEvent(sessionId, eventType, details);

    res.json({
      success: true,
      message: 'Event tracked successfully'
    });
  } catch (err) {
    logger.error(`Error tracking session event: ${err.message}`);
    next(err);
  }
};

/**
 * POS callback endpoint (called by POS system on completion)
 * POST /api/v1/pos-link/callback/:sessionId
 * Access: Public (validates OAuth token)
 */
exports.callback = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { oauthToken, completionData } = req.body;

    // Verify OAuth token from POS system
    if (oauthToken) {
      try {
        posLinkService.verifyOAuthToken(oauthToken);
      } catch (_error) {
        return next(createError(401, 'Invalid OAuth token'));
      }
    }

    // Complete session
    const session = await posLinkService.completeSession(sessionId, completionData);

    // Track referral source activity if applicable
    if (session.referralSource && completionData.applicationId) {
      const ReferralSource = require('../models/ReferralSource');
      const referralSource = await ReferralSource.findById(session.referralSource);
      
      if (referralSource) {
        await referralSource.incrementApplication();
      }
    }

    logger.info(`POS session completed via callback: ${sessionId}`);

    res.json({
      success: true,
      data: {
        sessionId: session.sessionId,
        status: session.status,
        returnUrl: session.returnUrl,
        completionData: session.completionData
      }
    });
  } catch (err) {
    logger.error(`Error in POS callback: ${err.message}`);
      next(createError(500, err.message));
  }
};

/**
 * Get session details
 * GET /api/v1/pos-link/session/:sessionId
 * Access: Authenticated (owner or LO)
 */
exports.getSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    const session = await POSSession.findOne({ sessionId })
      .populate('user', 'name email')
      .populate('loan', 'amount propertyAddress status')
      .populate('loanOfficer', 'name email phone')
      .populate('referralSource', 'name companyName');

    if (!session) {
      return next(createError(404, 'Session not found'));
    }

    // Authorization check
    const userId = req.user.userId;
    const isOwner = session.user._id.toString() === userId;
    const isLO = session.loanOfficer?._id.toString() === userId;
    const isAdmin = req.user.role === roles.ADMIN;

    if (!isOwner && !isLO && !isAdmin) {
      return next(createError(403, 'Not authorized to view this session'));
    }

    res.json({
      success: true,
      data: session
    });
  } catch (err) {
    logger.error(`Error fetching session: ${err.message}`);
    next(err);
  }
};

/**
 * Get session analytics
 * GET /api/v1/pos-link/analytics/:sessionId
 * Access: Authenticated (owner or LO)
 */
exports.getAnalytics = async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    const session = await POSSession.findOne({ sessionId })
      .populate('user', '_id');

    if (!session) {
      return next(createError(404, 'Session not found'));
    }

    // Authorization check
    const userId = req.user.userId;
    const isOwner = session.user._id.toString() === userId;
    const isLO = session.loanOfficer?.toString() === userId;
    const isAdmin = req.user.role === roles.ADMIN;

    if (!isOwner && !isLO && !isAdmin) {
      return next(createError(403, 'Not authorized to view analytics'));
    }

    const analytics = await posLinkService.getSessionAnalytics(sessionId);

    res.json({
      success: true,
      data: analytics
    });
  } catch (err) {
    logger.error(`Error fetching session analytics: ${err.message}`);
    next(err);
  }
};

/**
 * Get user's POS sessions
 * GET /api/v1/pos-link/my-sessions
 * Access: Authenticated
 */
exports.getMySessions = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { status, posSystem, purpose, limit } = req.query;

    const sessions = await posLinkService.getUserSessions(userId, {
      status,
      posSystem,
      purpose,
      limit: parseInt(limit) || 50
    });

    res.json({
      success: true,
      data: sessions,
      count: sessions.length
    });
  } catch (err) {
    logger.error(`Error fetching user sessions: ${err.message}`);
    next(err);
  }
};

/**
 * Get loan officer's sessions
 * GET /api/v1/pos-link/lo-sessions
 * Access: Loan Officers, Branch Managers, Admins
 */
exports.getLOSessions = async (req, res, next) => {
  try {
    const { loanOfficerId, status, posSystem, purpose, limit, page = 1 } = req.query;

    let query = {};

    // Role-based filtering
    if (req.user.role === roles.LO_RETAIL || req.user.role === roles.LO_TPO) {
      query.loanOfficer = req.user.userId;
    } else if (loanOfficerId) {
      query.loanOfficer = loanOfficerId;
    }

    if (status) query.status = status;
    if (posSystem) query.posSystem = posSystem;
    if (purpose) query.purpose = purpose;

    const limitNum = parseInt(limit) || 50;
    const skip = (parseInt(page) - 1) * limitNum;

    const [sessions, total] = await Promise.all([
      POSSession.find(query)
        .populate('user', 'name email')
        .populate('loan', 'amount propertyAddress status')
        .populate('loanOfficer', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      POSSession.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: sessions,
      pagination: {
        page: parseInt(page),
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    logger.error(`Error fetching LO sessions: ${err.message}`);
    next(err);
  }
};

/**
 * Cancel/expire a session
 * POST /api/v1/pos-link/cancel/:sessionId
 * Access: Session owner or Admin
 */
exports.cancelSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { reason } = req.body;

    const session = await POSSession.findOne({ sessionId });

    if (!session) {
      return next(createError(404, 'Session not found'));
    }

    // Authorization check
    const userId = req.user.userId;
    const isOwner = session.user.toString() === userId;
    const isAdmin = req.user.role === roles.ADMIN;

    if (!isOwner && !isAdmin) {
      return next(createError(403, 'Not authorized to cancel this session'));
    }

    if (session.status === 'completed') {
      return next(createError(400, 'Cannot cancel completed session'));
    }

    session.status = 'cancelled';
    session.auditLog.push({
      action: 'cancelled',
      details: reason || 'Session cancelled by user',
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    await session.save();

    logger.info(`POS session cancelled: ${sessionId} by user ${userId}`);

    res.json({
      success: true,
      message: 'Session cancelled successfully'
    });
  } catch (err) {
    logger.error(`Error cancelling session: ${err.message}`);
    next(err);
  }
};

// Helper functions

function detectDeviceType(userAgent) {
  if (!userAgent) return 'unknown';
  
  if (/mobile/i.test(userAgent)) return 'mobile';
  if (/tablet|ipad/i.test(userAgent)) return 'tablet';
  if (/desktop|windows|mac|linux/i.test(userAgent)) return 'desktop';
  
  return 'unknown';
}

function detectPlatform(userAgent) {
  if (!userAgent) return 'unknown';
  
  if (/android/i.test(userAgent)) return 'android';
  if (/iphone|ipad|ipod/i.test(userAgent)) return 'ios';
  if (/windows|mac|linux/i.test(userAgent)) return 'web';
  
  return 'unknown';
}

module.exports = exports;
