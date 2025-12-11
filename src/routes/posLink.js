const express = require('express');
const { body, query } = require('express-validator');
const router = express.Router();
const posLinkController = require('../controllers/posLinkController');
const { authenticate, authorize } = require('../middleware/auth');
const roles = require('../config/roles');

/**
 * @swagger
 * components:
 *   schemas:
 *     POSSession:
 *       type: object
 *       required:
 *         - sessionId
 *         - posSystem
 *         - purpose
 *       properties:
 *         sessionId:
 *           type: string
 *           example: "pos_1702345678901_a1b2c3d4"
 *         sessionToken:
 *           type: string
 *           example: "abc123def456..."
 *         redirectUrl:
 *           type: string
 *           example: "https://blend.com/apply?token=..."
 *         callbackUrl:
 *           type: string
 *           example: "https://api.fahm.com/api/v1/pos-link/callback/..."
 *         returnUrl:
 *           type: string
 *           example: "https://app.fahm.com/dashboard"
 *         posSystem:
 *           type: string
 *           enum: [blend, big_pos, encompass_consumer_connect]
 *           example: "blend"
 *         purpose:
 *           type: string
 *           enum: [new_application, continue_application, document_upload, rate_lock, disclosure_review]
 *           example: "new_application"
 *         status:
 *           type: string
 *           enum: [pending, active, completed, expired, cancelled, failed]
 *           example: "pending"
 *         expiresAt:
 *           type: string
 *           format: date-time
 *         branding:
 *           type: object
 *           properties:
 *             theme:
 *               type: string
 *               enum: [fahm_default, co_branded, white_label]
 *             primaryColor:
 *               type: string
 *             secondaryColor:
 *               type: string
 *             logo:
 *               type: string
 *             partnerLogo:
 *               type: string
 *             partnerName:
 *               type: string
 */

/**
 * @swagger
 * /api/v1/pos-link/generate:
 *   post:
 *     summary: Generate secure POS handoff link
 *     tags: [POS Link]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               loanId:
 *                 type: string
 *                 format: objectId
 *               loanOfficerId:
 *                 type: string
 *                 format: objectId
 *               referralSourceId:
 *                 type: string
 *                 format: objectId
 *               posSystem:
 *                 type: string
 *                 enum: [blend, big_pos, encompass_consumer_connect]
 *                 default: "blend"
 *               purpose:
 *                 type: string
 *                 enum: [new_application, continue_application, document_upload, rate_lock, disclosure_review]
 *                 default: "new_application"
 *               source:
 *                 type: string
 *                 enum: [mobile_app, web_app, business_card, calculator, preapproval_letter, email_link]
 *                 default: "mobile_app"
 *               expirationMinutes:
 *                 type: integer
 *                 default: 60
 *               returnUrl:
 *                 type: string
 *               branding:
 *                 type: object
 *     responses:
 *       201:
 *         description: POS link generated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Loan not found
 */
router.post(
  '/generate',
  authenticate,
  [
    body('loanId').optional().isMongoId().withMessage('Invalid loan ID'),
    body('loanOfficerId').optional().isMongoId().withMessage('Invalid loan officer ID'),
    body('referralSourceId').optional().isMongoId().withMessage('Invalid referral source ID'),
    body('posSystem').optional().isIn(['blend', 'big_pos', 'encompass_consumer_connect']),
    body('purpose').optional().isIn(['new_application', 'continue_application', 'document_upload', 'rate_lock', 'disclosure_review']),
    body('source').optional().isIn(['mobile_app', 'web_app', 'business_card', 'calculator', 'preapproval_letter', 'email_link']),
    body('expirationMinutes').optional().isInt({ min: 5, max: 1440 }).withMessage('Expiration must be between 5 and 1440 minutes'),
    body('returnUrl').optional().isURL()
  ],
  posLinkController.generateLink
);

/**
 * @swagger
 * /api/v1/pos-link/activate/{sessionId}:
 *   post:
 *     summary: Activate POS session (public endpoint for POS systems)
 *     tags: [POS Link]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionToken
 *             properties:
 *               sessionToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Session activated successfully
 *       400:
 *         description: Invalid session or expired
 *       404:
 *         description: Session not found
 */
router.post(
  '/activate/:sessionId',
  [
    body('sessionToken').notEmpty().withMessage('Session token is required')
  ],
  posLinkController.activateSession
);

/**
 * @swagger
 * /api/v1/pos-link/track/{sessionId}:
 *   post:
 *     summary: Track session analytics event (public endpoint for POS systems)
 *     tags: [POS Link]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - eventType
 *             properties:
 *               eventType:
 *                 type: string
 *                 enum: [page_view, document_upload, step_complete]
 *               details:
 *                 type: object
 *     responses:
 *       200:
 *         description: Event tracked successfully
 *       400:
 *         description: Invalid event type
 *       404:
 *         description: Session not found
 */
router.post(
  '/track/:sessionId',
  [
    body('eventType').isIn(['page_view', 'document_upload', 'step_complete']).withMessage('Invalid event type'),
    body('details').optional().isObject()
  ],
  posLinkController.trackEvent
);

/**
 * @swagger
 * /api/v1/pos-link/callback/{sessionId}:
 *   post:
 *     summary: POS system callback endpoint for completion
 *     tags: [POS Link]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               oauthToken:
 *                 type: string
 *               completionData:
 *                 type: object
 *                 properties:
 *                   applicationId:
 *                     type: string
 *                   loanNumber:
 *                     type: string
 *                   encompassLoanId:
 *                     type: string
 *                   status:
 *                     type: string
 *                   completedSteps:
 *                     type: array
 *                     items:
 *                       type: string
 *                   documentsSubmitted:
 *                     type: array
 *                     items:
 *                       type: object
 *     responses:
 *       200:
 *         description: Callback processed successfully
 *       400:
 *         description: Invalid callback data
 *       401:
 *         description: Invalid OAuth token
 *       404:
 *         description: Session not found
 */
router.post(
  '/callback/:sessionId',
  [
    body('oauthToken').optional().isString(),
    body('completionData').optional().isObject()
  ],
  posLinkController.callback
);

/**
 * @swagger
 * /api/v1/pos-link/session/{sessionId}:
 *   get:
 *     summary: Get session details
 *     tags: [POS Link]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session details
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Session not found
 */
router.get(
  '/session/:sessionId',
  authenticate,
  posLinkController.getSession
);

/**
 * @swagger
 * /api/v1/pos-link/analytics/{sessionId}:
 *   get:
 *     summary: Get session analytics
 *     tags: [POS Link]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session analytics
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Session not found
 */
router.get(
  '/analytics/:sessionId',
  authenticate,
  posLinkController.getAnalytics
);

/**
 * @swagger
 * /api/v1/pos-link/my-sessions:
 *   get:
 *     summary: Get current user's POS sessions
 *     tags: [POS Link]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, active, completed, expired, cancelled, failed]
 *       - in: query
 *         name: posSystem
 *         schema:
 *           type: string
 *           enum: [blend, big_pos, encompass_consumer_connect]
 *       - in: query
 *         name: purpose
 *         schema:
 *           type: string
 *           enum: [new_application, continue_application, document_upload, rate_lock, disclosure_review]
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: User's POS sessions
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/my-sessions',
  authenticate,
  [
    query('status').optional().isIn(['pending', 'active', 'completed', 'expired', 'cancelled', 'failed']),
    query('posSystem').optional().isIn(['blend', 'big_pos', 'encompass_consumer_connect']),
    query('purpose').optional().isIn(['new_application', 'continue_application', 'document_upload', 'rate_lock', 'disclosure_review']),
    query('limit').optional().isInt({ min: 1, max: 200 })
  ],
  posLinkController.getMySessions
);

/**
 * @swagger
 * /api/v1/pos-link/lo-sessions:
 *   get:
 *     summary: Get loan officer's POS sessions
 *     tags: [POS Link]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: loanOfficerId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: posSystem
 *         schema:
 *           type: string
 *       - in: query
 *         name: purpose
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: Loan officer's POS sessions
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/lo-sessions',
  authenticate,
  authorize(roles.LO_RETAIL, roles.LO_TPO, roles.BRANCH_MANAGER, roles.ADMIN),
  [
    query('loanOfficerId').optional().isMongoId(),
    query('status').optional().isIn(['pending', 'active', 'completed', 'expired', 'cancelled', 'failed']),
    query('posSystem').optional().isIn(['blend', 'big_pos', 'encompass_consumer_connect']),
    query('purpose').optional().isIn(['new_application', 'continue_application', 'document_upload', 'rate_lock', 'disclosure_review']),
    query('limit').optional().isInt({ min: 1, max: 200 }),
    query('page').optional().isInt({ min: 1 })
  ],
  posLinkController.getLOSessions
);

/**
 * @swagger
 * /api/v1/pos-link/cancel/{sessionId}:
 *   post:
 *     summary: Cancel POS session
 *     tags: [POS Link]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Session cancelled successfully
 *       400:
 *         description: Cannot cancel completed session
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Session not found
 */
router.post(
  '/cancel/:sessionId',
  authenticate,
  [
    body('reason').optional().isString().withMessage('Reason must be a string')
  ],
  posLinkController.cancelSession
);

module.exports = router;
