const express = require('express');
const { body, param, query } = require('express-validator');
const router = express.Router();

const smsController = require('../controllers/smsController');
const { authenticate, authorize } = require('../middleware/auth');
const roles = require('../config/roles');

/**
 * @swagger
 * tags:
 *   name: SMS
 *   description: SMS messaging and Encompass texting integration
 */

/**
 * @swagger
 * /api/v1/sms/send:
 *   post:
 *     summary: Send SMS message
 *     description: Send SMS via Twilio with automatic Encompass logging
 *     tags: [SMS]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - to
 *               - body
 *             properties:
 *               to:
 *                 type: string
 *                 description: Recipient phone number (E.164 format preferred)
 *                 example: "+12025551234"
 *               body:
 *                 type: string
 *                 description: Message body (max 1600 characters)
 *                 example: "Your loan application has been approved!"
 *               loanId:
 *                 type: string
 *                 description: Associated loan ID for Encompass logging
 *               messageType:
 *                 type: string
 *                 enum: [manual, automated, notification, reminder, alert, milestone_update]
 *                 default: manual
 *               purpose:
 *                 type: string
 *                 enum: [loan_update, document_request, appointment_reminder, general_inquiry, marketing, servicing, collection]
 *                 default: loan_update
 *     responses:
 *       200:
 *         description: SMS sent successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Not authorized
 *       500:
 *         description: Failed to send SMS
 */
router.post(
  '/send',
  authenticate,
  [
    body('to')
      .trim()
      .notEmpty()
      .withMessage('Phone number is required')
      .matches(/^[\d\s\+\-\(\)]+$/)
      .withMessage('Invalid phone number format'),
    body('body')
      .trim()
      .notEmpty()
      .withMessage('Message body is required')
      .isLength({ max: 1600 })
      .withMessage('Message body must not exceed 1600 characters'),
    body('loanId')
      .optional()
      .isMongoId()
      .withMessage('Invalid loan ID'),
    body('messageType')
      .optional()
      .isIn(['manual', 'automated', 'notification', 'reminder', 'alert', 'milestone_update'])
      .withMessage('Invalid message type'),
    body('purpose')
      .optional()
      .isIn(['loan_update', 'document_request', 'appointment_reminder', 'general_inquiry', 'marketing', 'servicing', 'collection'])
      .withMessage('Invalid purpose')
  ],
  smsController.sendMessage
);

/**
 * @swagger
 * /api/v1/sms/webhook/receive:
 *   post:
 *     summary: Twilio inbound message webhook
 *     description: Webhook endpoint for receiving inbound SMS from Twilio
 *     tags: [SMS]
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               MessageSid:
 *                 type: string
 *               From:
 *                 type: string
 *               To:
 *                 type: string
 *               Body:
 *                 type: string
 *               NumMedia:
 *                 type: string
 *     responses:
 *       200:
 *         description: Webhook received
 *         content:
 *           text/xml:
 *             schema:
 *               type: string
 */
router.post('/webhook/receive', smsController.receiveWebhook);

/**
 * @swagger
 * /api/v1/sms/webhook/status:
 *   post:
 *     summary: Twilio status callback webhook
 *     description: Webhook endpoint for SMS delivery status updates
 *     tags: [SMS]
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               MessageSid:
 *                 type: string
 *               MessageStatus:
 *                 type: string
 *               ErrorCode:
 *                 type: string
 *               ErrorMessage:
 *                 type: string
 *     responses:
 *       200:
 *         description: Status update received
 */
router.post('/webhook/status', smsController.statusWebhook);

/**
 * @swagger
 * /api/v1/sms/conversation/{phone}:
 *   get:
 *     summary: Get conversation thread
 *     description: Retrieve conversation thread with a specific phone number
 *     tags: [SMS]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: phone
 *         required: true
 *         schema:
 *           type: string
 *         description: Phone number to retrieve conversation with
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Maximum number of messages to retrieve
 *     responses:
 *       200:
 *         description: Conversation thread retrieved
 *       401:
 *         description: Not authenticated
 */
router.get(
  '/conversation/:phone',
  authenticate,
  [
    param('phone')
      .trim()
      .notEmpty()
      .matches(/^[\d\s\+\-\(\)]+$/)
      .withMessage('Invalid phone number format'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 200 })
      .withMessage('Limit must be between 1 and 200')
  ],
  smsController.getConversation
);

/**
 * @swagger
 * /api/v1/sms/loan/{loanId}:
 *   get:
 *     summary: Get messages for a loan
 *     description: Retrieve all SMS messages associated with a loan
 *     tags: [SMS]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: loanId
 *         required: true
 *         schema:
 *           type: string
 *         description: Loan application ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Loan messages retrieved
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Loan not found
 */
router.get(
  '/loan/:loanId',
  authenticate,
  [
    param('loanId')
      .isMongoId()
      .withMessage('Invalid loan ID'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 200 })
      .withMessage('Limit must be between 1 and 200')
  ],
  smsController.getLoanMessages
);

/**
 * @swagger
 * /api/v1/sms/my-messages:
 *   get:
 *     summary: Get user's messages
 *     description: Retrieve all SMS messages for the authenticated user
 *     tags: [SMS]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: direction
 *         schema:
 *           type: string
 *           enum: [inbound, outbound]
 *     responses:
 *       200:
 *         description: User messages retrieved
 *       401:
 *         description: Not authenticated
 */
router.get(
  '/my-messages',
  authenticate,
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 200 })
      .withMessage('Limit must be between 1 and 200'),
    query('direction')
      .optional()
      .isIn(['inbound', 'outbound'])
      .withMessage('Direction must be inbound or outbound')
  ],
  smsController.getMyMessages
);

/**
 * @swagger
 * /api/v1/sms/{messageId}/read:
 *   patch:
 *     summary: Mark message as read
 *     description: Mark an SMS message as read by the recipient
 *     tags: [SMS]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *         description: Message ID (sms_timestamp_hex format)
 *     responses:
 *       200:
 *         description: Message marked as read
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Message not found
 */
router.patch(
  '/:messageId/read',
  authenticate,
  [
    param('messageId')
      .trim()
      .matches(/^sms_\d+_[a-f0-9]+$/)
      .withMessage('Invalid message ID format')
  ],
  smsController.markAsRead
);

/**
 * @swagger
 * /api/v1/sms/stats:
 *   get:
 *     summary: Get SMS statistics
 *     description: Retrieve SMS usage statistics and analytics
 *     tags: [SMS]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: loanId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Statistics retrieved
 *       403:
 *         description: Not authorized
 */
router.get(
  '/stats',
  authenticate,
  authorize(roles.LO_RETAIL, roles.LO_TPO, roles.BRANCH_MANAGER, roles.ADMIN),
  [
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Invalid start date format'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('Invalid end date format'),
    query('loanId')
      .optional()
      .isMongoId()
      .withMessage('Invalid loan ID')
  ],
  smsController.getStats
);

/**
 * @swagger
 * /api/v1/sms/sync-to-encompass:
 *   post:
 *     summary: Sync messages to Encompass
 *     description: Manually trigger sync of unsynced messages to Encompass (Admin only)
 *     tags: [SMS]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Sync completed
 *       403:
 *         description: Not authorized
 */
router.post(
  '/sync-to-encompass',
  authenticate,
  authorize(roles.ADMIN),
  smsController.syncToEncompass
);

module.exports = router;
