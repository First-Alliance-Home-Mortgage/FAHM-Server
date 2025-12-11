const express = require('express');
const { body, param, query } = require('express-validator');
const router = express.Router();

const rateAlertController = require('../controllers/rateAlertController');
const { authenticate } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Rate Alerts
 *   description: Rate monitoring and notification subscriptions
 */

/**
 * @swagger
 * /api/v1/rate-alerts:
 *   post:
 *     summary: Create rate alert
 *     description: Subscribe to rate change notifications with custom triggers
 *     tags: [Rate Alerts]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productType
 *               - loanTerm
 *               - triggerType
 *             properties:
 *               productType:
 *                 type: string
 *                 enum: [conventional, fha, va, usda, jumbo]
 *               loanTerm:
 *                 type: integer
 *                 enum: [10, 15, 20, 25, 30]
 *               loanAmount:
 *                 type: number
 *                 default: 300000
 *               creditScore:
 *                 type: integer
 *                 default: 740
 *               ltv:
 *                 type: number
 *                 default: 80
 *               propertyType:
 *                 type: string
 *                 enum: [single_family, condo, townhouse, multi_family, manufactured]
 *               triggerType:
 *                 type: string
 *                 enum: [below, above, drops_by]
 *               targetRate:
 *                 type: number
 *                 description: Required for below/above trigger types
 *               dropAmount:
 *                 type: number
 *                 description: Required for drops_by trigger type
 *               baselineRate:
 *                 type: number
 *                 description: Required for drops_by trigger type
 *               notificationMethod:
 *                 type: string
 *                 enum: [push, sms, email, all]
 *                 default: push
 *     responses:
 *       201:
 *         description: Rate alert created
 *       400:
 *         description: Validation error
 */
router.post(
  '/',
  authenticate,
  [
    body('productType')
      .isIn(['conventional', 'fha', 'va', 'usda', 'jumbo'])
      .withMessage('Invalid product type'),
    body('loanTerm')
      .isInt({ min: 10, max: 30 })
      .withMessage('Loan term must be 10, 15, 20, 25, or 30 years'),
    body('loanAmount')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Loan amount must be positive'),
    body('creditScore')
      .optional()
      .isInt({ min: 300, max: 850 })
      .withMessage('Credit score must be between 300 and 850'),
    body('ltv')
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage('LTV must be between 0 and 100'),
    body('triggerType')
      .isIn(['below', 'above', 'drops_by'])
      .withMessage('Invalid trigger type'),
    body('targetRate')
      .optional()
      .isFloat({ min: 0, max: 20 })
      .withMessage('Target rate must be between 0 and 20'),
    body('dropAmount')
      .optional()
      .isFloat({ min: 0, max: 5 })
      .withMessage('Drop amount must be between 0 and 5'),
    body('notificationMethod')
      .optional()
      .isIn(['push', 'sms', 'email', 'all'])
      .withMessage('Invalid notification method')
  ],
  rateAlertController.createAlert
);

/**
 * @swagger
 * /api/v1/rate-alerts:
 *   get:
 *     summary: Get user's rate alerts
 *     description: Retrieve all rate alerts for the authenticated user
 *     tags: [Rate Alerts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, paused, triggered, expired, cancelled]
 *       - in: query
 *         name: productType
 *         schema:
 *           type: string
 *       - in: query
 *         name: loanTerm
 *         schema:
 *           type: integer
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
 *         description: Rate alerts retrieved
 */
router.get(
  '/',
  authenticate,
  [
    query('status')
      .optional()
      .isIn(['active', 'paused', 'triggered', 'expired', 'cancelled'])
      .withMessage('Invalid status'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be positive'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 200 })
      .withMessage('Limit must be between 1 and 200')
  ],
  rateAlertController.getAlerts
);

/**
 * @swagger
 * /api/v1/rate-alerts/stats:
 *   get:
 *     summary: Get alert statistics
 *     description: Retrieve user's rate alert statistics
 *     tags: [Rate Alerts]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved
 */
router.get('/stats', authenticate, rateAlertController.getStats);

/**
 * @swagger
 * /api/v1/rate-alerts/{id}:
 *   get:
 *     summary: Get single rate alert
 *     description: Retrieve details of a specific rate alert
 *     tags: [Rate Alerts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Rate alert retrieved
 *       404:
 *         description: Alert not found
 */
router.get(
  '/:id',
  authenticate,
  [param('id').isMongoId().withMessage('Invalid alert ID')],
  rateAlertController.getAlert
);

/**
 * @swagger
 * /api/v1/rate-alerts/{id}:
 *   patch:
 *     summary: Update rate alert
 *     description: Modify rate alert settings
 *     tags: [Rate Alerts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               targetRate:
 *                 type: number
 *               dropAmount:
 *                 type: number
 *               baselineRate:
 *                 type: number
 *               notificationMethod:
 *                 type: string
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Alert updated
 */
router.patch(
  '/:id',
  authenticate,
  [
    param('id').isMongoId().withMessage('Invalid alert ID'),
    body('targetRate')
      .optional()
      .isFloat({ min: 0, max: 20 })
      .withMessage('Invalid target rate'),
    body('notificationMethod')
      .optional()
      .isIn(['push', 'sms', 'email', 'all'])
      .withMessage('Invalid notification method')
  ],
  rateAlertController.updateAlert
);

/**
 * @swagger
 * /api/v1/rate-alerts/{id}:
 *   delete:
 *     summary: Delete rate alert
 *     description: Remove rate alert subscription
 *     tags: [Rate Alerts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Alert deleted
 */
router.delete(
  '/:id',
  authenticate,
  [param('id').isMongoId().withMessage('Invalid alert ID')],
  rateAlertController.deleteAlert
);

/**
 * @swagger
 * /api/v1/rate-alerts/{id}/check-rate:
 *   get:
 *     summary: Check current rate
 *     description: Get current rate and trigger status for alert
 *     tags: [Rate Alerts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Rate checked
 */
router.get(
  '/:id/check-rate',
  authenticate,
  [param('id').isMongoId().withMessage('Invalid alert ID')],
  rateAlertController.checkRate
);

/**
 * @swagger
 * /api/v1/rate-alerts/{id}/trigger-check:
 *   post:
 *     summary: Manually trigger alert check
 *     description: Force check of alert and send notification if triggered
 *     tags: [Rate Alerts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Alert checked
 */
router.post(
  '/:id/trigger-check',
  authenticate,
  [param('id').isMongoId().withMessage('Invalid alert ID')],
  rateAlertController.triggerCheck
);

/**
 * @swagger
 * /api/v1/rate-alerts/{id}/pause:
 *   post:
 *     summary: Pause rate alert
 *     description: Temporarily pause rate alert notifications
 *     tags: [Rate Alerts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Alert paused
 */
router.post(
  '/:id/pause',
  authenticate,
  [param('id').isMongoId().withMessage('Invalid alert ID')],
  rateAlertController.pauseAlert
);

/**
 * @swagger
 * /api/v1/rate-alerts/{id}/resume:
 *   post:
 *     summary: Resume rate alert
 *     description: Resume paused rate alert
 *     tags: [Rate Alerts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Alert resumed
 */
router.post(
  '/:id/resume',
  authenticate,
  [param('id').isMongoId().withMessage('Invalid alert ID')],
  rateAlertController.resumeAlert
);

module.exports = router;
