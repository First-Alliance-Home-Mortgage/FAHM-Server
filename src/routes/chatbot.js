const express = require('express');
const { body, param, query } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/auth');
const roles = require('../config/roles');
const chatbotController = require('../controllers/chatbotController');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Chatbot
 *   description: AI-powered chatbot assistant with Azure OpenAI integration
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     ChatbotSession:
 *       type: object
 *       properties:
 *         sessionId:
 *           type: string
 *           description: Unique session identifier
 *         status:
 *           type: string
 *           enum: [active, escalated, resolved, closed]
 *         messages:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [user, assistant, system, function]
 *               content:
 *                 type: string
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *         loan:
 *           type: object
 *           description: Associated loan application
 *         escalation:
 *           type: object
 *           properties:
 *             escalatedAt:
 *               type: string
 *               format: date-time
 *             escalatedTo:
 *               type: object
 *               description: Loan officer handling escalation
 *             escalationType:
 *               type: string
 *               enum: [teams, in_app_chat, sms, email]
 *             reason:
 *               type: string
 */

/**
 * @swagger
 * /api/v1/chatbot/start:
 *   post:
 *     summary: Start new chatbot conversation session
 *     tags: [Chatbot]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               loanId:
 *                 type: string
 *                 description: Optional loan ID for context
 *               initialMessage:
 *                 type: string
 *                 description: Optional first message to AI
 *               deviceType:
 *                 type: string
 *                 enum: [mobile, tablet, desktop, unknown]
 *               voiceEnabled:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Session started successfully
 *       400:
 *         description: Validation error
 */
router.post(
  '/start',
  authenticate,
  [
    body('loanId').optional().isMongoId().withMessage('Invalid loan ID'),
    body('initialMessage').optional().isString().trim().isLength({ max: 1000 }),
    body('deviceType').optional().isIn(['mobile', 'tablet', 'desktop', 'unknown']),
    body('voiceEnabled').optional().isBoolean()
  ],
  chatbotController.startSession
);

/**
 * @swagger
 * /api/v1/chatbot/message:
 *   post:
 *     summary: Send message in existing chatbot session
 *     tags: [Chatbot]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionId
 *               - message
 *             properties:
 *               sessionId:
 *                 type: string
 *                 description: Chat session ID
 *               message:
 *                 type: string
 *                 description: User's message
 *     responses:
 *       200:
 *         description: Message sent and AI response received
 *       400:
 *         description: Validation error
 *       404:
 *         description: Session not found
 *       410:
 *         description: Session expired
 */
router.post(
  '/message',
  authenticate,
  [
    body('sessionId').notEmpty().isString().withMessage('Session ID required'),
    body('message').notEmpty().isString().trim().isLength({ min: 1, max: 1000 }).withMessage('Message must be 1-1000 characters')
  ],
  chatbotController.sendMessage
);

/**
 * @swagger
 * /api/v1/chatbot/session/{sessionId}:
 *   get:
 *     summary: Get conversation history for session
 *     tags: [Chatbot]
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
 *         description: Session details retrieved
 *       404:
 *         description: Session not found
 */
router.get(
  '/session/:sessionId',
  authenticate,
  [
    param('sessionId').notEmpty().isString().withMessage('Session ID required')
  ],
  chatbotController.getSession
);

/**
 * @swagger
 * /api/v1/chatbot/sessions:
 *   get:
 *     summary: Get user's chat sessions
 *     tags: [Chatbot]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, escalated, resolved, closed]
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: Sessions list retrieved
 */
router.get(
  '/sessions',
  authenticate,
  [
    query('status').optional().isIn(['active', 'escalated', 'resolved', 'closed']),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('page').optional().isInt({ min: 1 })
  ],
  chatbotController.getUserSessions
);

/**
 * @swagger
 * /api/v1/chatbot/session/{sessionId}/escalate:
 *   post:
 *     summary: Escalate session to human loan officer
 *     tags: [Chatbot]
 *     security:
 *       - bearerAuth: []
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
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for escalation
 *               escalationType:
 *                 type: string
 *                 enum: [teams, in_app_chat, sms, email]
 *                 default: in_app_chat
 *               urgency:
 *                 type: string
 *                 enum: [low, medium, high]
 *                 default: medium
 *     responses:
 *       200:
 *         description: Session escalated successfully
 *       400:
 *         description: Session already escalated or validation error
 *       404:
 *         description: Session not found
 */
router.post(
  '/session/:sessionId/escalate',
  authenticate,
  [
    param('sessionId').notEmpty().isString().withMessage('Session ID required'),
    body('reason').notEmpty().isString().trim().isLength({ min: 10, max: 500 }).withMessage('Reason must be 10-500 characters'),
    body('escalationType').optional().isIn(['teams', 'in_app_chat', 'sms', 'email']),
    body('urgency').optional().isIn(['low', 'medium', 'high'])
  ],
  chatbotController.escalateSession
);

/**
 * @swagger
 * /api/v1/chatbot/session/{sessionId}/close:
 *   post:
 *     summary: Close chatbot session
 *     tags: [Chatbot]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               satisfactionRating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 description: User satisfaction rating (1-5)
 *               feedback:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Optional feedback text
 *     responses:
 *       200:
 *         description: Session closed successfully
 *       400:
 *         description: Session already closed or validation error
 *       404:
 *         description: Session not found
 */
router.post(
  '/session/:sessionId/close',
  authenticate,
  [
    param('sessionId').notEmpty().isString().withMessage('Session ID required'),
    body('satisfactionRating').optional().isInt({ min: 1, max: 5 }),
    body('feedback').optional().isString().trim().isLength({ max: 1000 })
  ],
  chatbotController.closeSession
);

/**
 * @swagger
 * /api/v1/chatbot/stats:
 *   get:
 *     summary: Get chatbot usage statistics (Admin/BM only)
 *     tags: [Chatbot]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Statistics retrieved
 *       403:
 *         description: Insufficient permissions
 */
router.get(
  '/stats',
  authenticate,
  authorize(roles.ADMIN, roles.BRANCH_MANAGER),
  [
    query('startDate').optional().isISO8601().toDate(),
    query('endDate').optional().isISO8601().toDate()
  ],
  chatbotController.getStats
);

/**
 * @swagger
 * /api/v1/chatbot/escalated:
 *   get:
 *     summary: Get escalated sessions (LO/Admin/BM only)
 *     tags: [Chatbot]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Escalated sessions retrieved
 *       403:
 *         description: Insufficient permissions
 */
router.get(
  '/escalated',
  authenticate,
  authorize(roles.ADMIN, roles.BRANCH_MANAGER, roles.LO_RETAIL, roles.LO_TPO),
  chatbotController.getEscalatedSessions
);

/**
 * @swagger
 * /api/v1/chatbot/session/{sessionId}/resolve:
 *   post:
 *     summary: Resolve escalated session (LO/Admin only)
 *     tags: [Chatbot]
 *     security:
 *       - bearerAuth: []
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
 *               - resolutionNotes
 *             properties:
 *               resolutionNotes:
 *                 type: string
 *                 description: Notes about how the issue was resolved
 *     responses:
 *       200:
 *         description: Session resolved successfully
 *       400:
 *         description: Session not escalated or validation error
 *       404:
 *         description: Session not found
 */
router.post(
  '/session/:sessionId/resolve',
  authenticate,
  authorize(roles.ADMIN, roles.LO_RETAIL, roles.LO_TPO),
  [
    param('sessionId').notEmpty().isString().withMessage('Session ID required'),
    body('resolutionNotes').notEmpty().isString().trim().isLength({ min: 10, max: 1000 }).withMessage('Resolution notes must be 10-1000 characters')
  ],
  chatbotController.resolveSession
);

module.exports = router;
