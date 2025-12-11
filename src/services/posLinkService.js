const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const POSSession = require('../models/POSSession');
const ReferralSource = require('../models/ReferralSource');
const logger = require('../utils/logger');

/**
 * POS Link Service
 * Handles secure handoff to POS systems (Blend, Big POS, Encompass Consumer Connect)
 * with encrypted tokens, OAuth, and session management
 */

/**
 * Generate secure POS handoff link
 * @param {Object} params - Session parameters
 * @returns {Object} - Session details with redirect URL
 */
exports.generatePOSLink = async (params) => {
  const {
    userId,
    loanId,
    loanOfficerId,
    referralSourceId,
    posSystem = 'blend',
    purpose = 'new_application',
    source = 'mobile_app',
    expirationMinutes = 60,
    branding = {},
    returnUrl
  } = params;

  try {
    // Generate unique session identifiers
    const sessionToken = POSSession.generateSessionToken();
    const sessionId = POSSession.generateSessionId();

    // Calculate expiration
    const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000);

    // Prepare session data for encryption
    const sessionData = {
      userId,
      loanId,
      loanOfficerId,
      referralSourceId,
      purpose,
      source,
      timestamp: Date.now()
    };

    // Fetch referral source branding if provided
    let brandingConfig = { theme: 'fahm_default' };
    if (referralSourceId) {
      const referralSource = await ReferralSource.findById(referralSourceId);
      if (referralSource && referralSource.status === 'active') {
        const refBranding = referralSource.getBrandingConfig();
        brandingConfig = {
          theme: 'co_branded',
          primaryColor: refBranding.primaryColor,
          secondaryColor: refBranding.secondaryColor,
          logo: 'https://fahm.com/logo.png',
          partnerLogo: refBranding.logo,
          partnerName: refBranding.name || refBranding.companyName
        };
      }
    } else if (branding.theme) {
      brandingConfig = branding;
    }

    // Generate JWT token for secure handoff
    const jwtToken = jwt.sign(
      {
        sessionId,
        userId,
        loanId,
        purpose,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(expiresAt.getTime() / 1000)
      },
      process.env.JWT_SECRET,
      { algorithm: 'HS256' }
    );

    // Create session record
    const session = new POSSession({
      sessionToken,
      sessionId,
      user: userId,
      loan: loanId,
      loanOfficer: loanOfficerId,
      referralSource: referralSourceId,
      posSystem,
      posEnvironment: process.env.POS_ENVIRONMENT || 'production',
      purpose,
      source,
      status: 'pending',
      expiresAt,
      branding: brandingConfig,
      returnUrl: returnUrl || process.env.APP_URL || 'https://app.fahm.com'
    });

    // Encrypt sensitive session data
    session.encryptSessionData(sessionData);

    // Generate POS-specific redirect URL
    const redirectUrl = generatePOSRedirectURL(posSystem, sessionId, jwtToken, brandingConfig);
    session.redirectUrl = redirectUrl;

    // Generate callback URL for POS to report completion
    const callbackUrl = `${process.env.API_URL}/api/v1/pos-link/callback/${sessionId}`;
    session.callbackUrl = callbackUrl;

    // Log audit event
    session.auditLog.push({
      action: 'created',
      details: `POS session created for ${purpose}`,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent
    });

    await session.save();

    logger.info('POS link generated', {
      sessionId,
      userId,
      posSystem,
      purpose
    });

    return {
      sessionId,
      sessionToken,
      redirectUrl,
      callbackUrl,
      returnUrl: session.returnUrl,
      expiresAt,
      posSystem,
      branding: brandingConfig
    };
  } catch (error) {
    logger.error('Error generating POS link:', error);
    throw error;
  }
};

/**
 * Generate POS-specific redirect URL with session data
 * @param {String} posSystem - POS system identifier
 * @param {String} sessionId - Session ID
 * @param {String} jwtToken - JWT token
 * @param {Object} branding - Branding configuration
 * @returns {String} - Complete redirect URL
 */
function generatePOSRedirectURL(posSystem, sessionId, jwtToken, branding) {
  const posConfigs = {
    blend: {
      baseUrl: process.env.BLEND_POS_URL || 'https://blend.com/apply',
      params: {
        token: jwtToken,
        session_id: sessionId,
        partner: 'fahm',
        theme: branding.theme,
        primary_color: branding.primaryColor?.replace('#', ''),
        logo_url: branding.logo
      }
    },
    big_pos: {
      baseUrl: process.env.BIG_POS_URL || 'https://bigpos.fahm.com/apply',
      params: {
        token: jwtToken,
        session: sessionId,
        source: 'fahm_mobile',
        branding: branding.theme
      }
    },
    encompass_consumer_connect: {
      baseUrl: process.env.ENCOMPASS_CONSUMER_CONNECT_URL || 'https://encompass.com/consumer',
      params: {
        access_token: jwtToken,
        session_id: sessionId,
        partner_id: 'fahm'
      }
    }
  };

  const config = posConfigs[posSystem];
  if (!config) {
    throw new Error(`Unsupported POS system: ${posSystem}`);
  }

  const url = new URL(config.baseUrl);
  Object.entries(config.params).forEach(([key, value]) => {
    if (value) url.searchParams.append(key, value);
  });

  return url.toString();
}

/**
 * Validate session token and return session details
 * @param {String} sessionId - Session ID
 * @param {String} sessionToken - Session token
 * @returns {Object} - Session details
 */
exports.validateSession = async (sessionId, sessionToken) => {
  const session = await POSSession.findOne({ sessionId, sessionToken })
    .populate('user', 'name email')
    .populate('loan')
    .populate('loanOfficer', 'name email phone')
    .populate('referralSource', 'name companyName');

  if (!session) {
    throw new Error('Invalid session');
  }

  if (session.isExpired()) {
    session.status = 'expired';
    await session.save();
    throw new Error('Session expired');
  }

  return session;
};

/**
 * Activate POS session when user accesses POS
 * @param {String} sessionId - Session ID
 * @param {Object} analytics - Analytics data
 * @returns {Object} - Updated session
 */
exports.activateSession = async (sessionId, analytics = {}) => {
  const session = await POSSession.findOne({ sessionId });

  if (!session) {
    throw new Error('Session not found');
  }

  if (session.isExpired()) {
    throw new Error('Session expired');
  }

  if (session.status !== 'pending') {
    throw new Error(`Session already ${session.status}`);
  }

  await session.activate(analytics);

  logger.info('POS session activated', {
    sessionId,
    userId: session.user
  });

  return session;
};

/**
 * Track session analytics event
 * @param {String} sessionId - Session ID
 * @param {String} eventType - Event type
 * @param {Object} details - Event details
 * @returns {Object} - Updated session
 */
exports.trackSessionEvent = async (sessionId, eventType, details = {}) => {
  const session = await POSSession.findOne({ sessionId });

  if (!session) {
    throw new Error('Session not found');
  }

  await session.trackEvent(eventType, details);

  return session;
};

/**
 * Complete POS session and process callback data
 * @param {String} sessionId - Session ID
 * @param {Object} completionData - Completion data from POS
 * @returns {Object} - Updated session
 */
exports.completeSession = async (sessionId, completionData) => {
  const session = await POSSession.findOne({ sessionId })
    .populate('loan')
    .populate('user', 'name email');

  if (!session) {
    throw new Error('Session not found');
  }

  if (session.status !== 'active' && session.status !== 'pending') {
    throw new Error(`Cannot complete session with status: ${session.status}`);
  }

  await session.complete(completionData);

  // Update loan application if loan ID exists
  if (session.loan && completionData.applicationId) {
    session.loan.encompassLoanId = completionData.encompassLoanId || completionData.applicationId;
    session.loan.lastEncompassSync = new Date();
    await session.loan.save();
  }

  logger.info('POS session completed', {
    sessionId,
    userId: session.user._id,
    applicationId: completionData.applicationId
  });

  return session;
};

/**
 * Get session analytics
 * @param {String} sessionId - Session ID
 * @returns {Object} - Session analytics
 */
exports.getSessionAnalytics = async (sessionId) => {
  const session = await POSSession.findOne({ sessionId });

  if (!session) {
    throw new Error('Session not found');
  }

  return {
    sessionId: session.sessionId,
    status: session.status,
    posSystem: session.posSystem,
    purpose: session.purpose,
    source: session.source,
    analytics: session.analytics,
    createdAt: session.createdAt,
    activatedAt: session.activatedAt,
    completedAt: session.completedAt,
    expiresAt: session.expiresAt,
    auditLog: session.auditLog
  };
};

/**
 * Get user's POS sessions
 * @param {String} userId - User ID
 * @param {Object} filters - Filter options
 * @returns {Array} - User's sessions
 */
exports.getUserSessions = async (userId, filters = {}) => {
  const query = { user: userId };

  if (filters.status) query.status = filters.status;
  if (filters.posSystem) query.posSystem = filters.posSystem;
  if (filters.purpose) query.purpose = filters.purpose;

  const sessions = await POSSession.find(query)
    .populate('loan', 'amount propertyAddress status')
    .populate('loanOfficer', 'name email')
    .sort({ createdAt: -1 })
    .limit(filters.limit || 50);

  return sessions;
};

/**
 * Generate short-lived OAuth token for POS system
 * @param {String} sessionId - Session ID
 * @returns {String} - OAuth token
 */
exports.generateOAuthToken = (sessionId) => {
  return jwt.sign(
    {
      sessionId,
      type: 'pos_oauth',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 300 // 5 minutes
    },
    process.env.JWT_SECRET,
    { algorithm: 'HS256' }
  );
};

/**
 * Verify OAuth token from POS system
 * @param {String} token - OAuth token
 * @returns {Object} - Decoded token
 */
exports.verifyOAuthToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch (error) {
    throw new Error('Invalid or expired OAuth token');
  }
};

module.exports = exports;
