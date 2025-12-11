const express = require('express');
const { body, query } = require('express-validator');
const router = express.Router();
const rateController = require('../controllers/rateController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/auth');
const roles = require('../config/roles');

/**
 * @swagger
 * tags:
 *   name: Rate & Pricing
 *   description: Optimal Blue rate sheets, rate locks, and rate alerts
 */

/**
 * @swagger
 * /api/v1/rates/current:
 *   get:
 *     summary: Get current rates from Optimal Blue
 *     tags: [Rate & Pricing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: loanAmount
 *         schema:
 *           type: number
 *         description: Loan amount
 *       - in: query
 *         name: productType
 *         schema:
 *           type: string
 *           enum: [conventional, fha, va, usda, jumbo]
 *       - in: query
 *         name: loanTerm
 *         schema:
 *           type: integer
 *           enum: [15, 20, 30]
 *       - in: query
 *         name: loanPurpose
 *         schema:
 *           type: string
 *           enum: [purchase, refinance, cashout_refinance]
 *       - in: query
 *         name: propertyType
 *         schema:
 *           type: string
 *       - in: query
 *         name: occupancy
 *         schema:
 *           type: string
 *       - in: query
 *         name: ltv
 *         schema:
 *           type: number
 *       - in: query
 *         name: creditScore
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Current rates retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/current', authenticate, rateController.getCurrentRates);

/**
 * @swagger
 * /api/v1/rates/history:
 *   get:
 *     summary: Get rate history for compliance and trending
 *     tags: [Rate & Pricing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: productType
 *         schema:
 *           type: string
 *           enum: [conventional, fha, va, usda, jumbo]
 *       - in: query
 *         name: loanTerm
 *         schema:
 *           type: integer
 *           enum: [15, 20, 30]
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
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *     responses:
 *       200:
 *         description: Rate history retrieved successfully
 */
router.get('/history', authenticate, rateController.getRateHistory);

/**
 * @swagger
 * /api/v1/rates/products:
 *   get:
 *     summary: Get product pricing from Optimal Blue
 *     tags: [Rate & Pricing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: productType
 *         schema:
 *           type: string
 *           enum: [conventional, fha, va, usda, jumbo]
 *       - in: query
 *         name: loanTerm
 *         schema:
 *           type: integer
 *           enum: [15, 20, 30]
 *       - in: query
 *         name: investorName
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Product pricing retrieved successfully
 */
router.get('/products', authenticate, rateController.getProductPricing);

/**
 * @swagger
 * /api/v1/rates/alerts:
 *   post:
 *     summary: Create rate alert for user
 *     tags: [Rate & Pricing]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productType
 *               - loanTerm
 *               - targetRate
 *               - triggerType
 *               - notificationMethod
 *             properties:
 *               productType:
 *                 type: string
 *                 enum: [conventional, fha, va, usda, jumbo]
 *               loanTerm:
 *                 type: integer
 *                 enum: [15, 20, 30]
 *               targetRate:
 *                 type: number
 *                 example: 6.5
 *               triggerType:
 *                 type: string
 *                 enum: [below, above, drops_by]
 *               dropAmount:
 *                 type: number
 *                 example: 0.125
 *                 description: Required if triggerType is drops_by
 *               notificationMethod:
 *                 type: string
 *                 enum: [push, sms, email, all]
 *               loan:
 *                 type: string
 *                 description: Optional loan ID to associate alert with
 *     responses:
 *       201:
 *         description: Rate alert created successfully
 *       400:
 *         description: Validation error
 */
router.post(
  '/alerts',
  authenticate,
  [
    body('productType').isIn(['conventional', 'fha', 'va', 'usda', 'jumbo']),
    body('loanTerm').isIn([15, 20, 30]),
    body('targetRate').isFloat({ min: 0, max: 20 }),
    body('triggerType').isIn(['below', 'above', 'drops_by']),
    body('notificationMethod').isIn(['push', 'sms', 'email', 'all']),
    body('dropAmount').optional().isFloat({ min: 0 }),
    body('loan').optional().isMongoId()
  ],
  rateController.createRateAlert
);

/**
 * @swagger
 * /api/v1/rates/alerts:
 *   get:
 *     summary: Get user's rate alerts
 *     tags: [Rate & Pricing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, triggered, expired, cancelled]
 *     responses:
 *       200:
 *         description: Rate alerts retrieved successfully
 */
router.get('/alerts', authenticate, rateController.getUserAlerts);

/**
 * @swagger
 * /api/v1/rates/alerts/{alertId}:
 *   put:
 *     summary: Update rate alert
 *     tags: [Rate & Pricing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alertId
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
 *               notificationMethod:
 *                 type: string
 *                 enum: [push, sms, email, all]
 *               status:
 *                 type: string
 *                 enum: [active, cancelled]
 *     responses:
 *       200:
 *         description: Rate alert updated successfully
 */
router.put('/alerts/:alertId', authenticate, rateController.updateRateAlert);

/**
 * @swagger
 * /api/v1/rates/alerts/{alertId}:
 *   delete:
 *     summary: Cancel rate alert
 *     tags: [Rate & Pricing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Rate alert cancelled successfully
 */
router.delete('/alerts/:alertId', authenticate, rateController.deleteRateAlert);

/**
 * @swagger
 * /api/v1/rates/alerts/check:
 *   post:
 *     summary: Check all active alerts against current rates (scheduler use)
 *     tags: [Rate & Pricing]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Rate alerts checked successfully
 */
router.post(
  '/alerts/check',
  authenticate,
  authorize(roles.ADMIN, roles.LO_RETAIL, roles.LO_TPO),
  rateController.checkRateAlerts
);

/**
 * @swagger
 * /api/v1/rates/locks:
 *   post:
 *     summary: Submit rate lock request
 *     tags: [Rate & Pricing]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - loanId
 *               - rateSnapshotId
 *               - lockPeriod
 *             properties:
 *               loanId:
 *                 type: string
 *               rateSnapshotId:
 *                 type: string
 *               lockPeriod:
 *                 type: integer
 *                 enum: [30, 45, 60]
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Rate lock submitted successfully
 *       404:
 *         description: Loan or rate snapshot not found
 */
router.post(
  '/locks',
  authenticate,
  [
    body('loanId').isMongoId(),
    body('rateSnapshotId').isMongoId(),
    body('lockPeriod').isIn([30, 45, 60]),
    body('notes').optional().isString()
  ],
  rateController.submitRateLock
);

/**
 * @swagger
 * /api/v1/rates/locks/loan/{loanId}:
 *   get:
 *     summary: Get rate locks for a loan
 *     tags: [Rate & Pricing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: loanId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Rate locks retrieved successfully
 */
router.get('/locks/loan/:loanId', authenticate, rateController.getLoanRateLocks);

/**
 * @swagger
 * /api/v1/rates/locks/{lockId}/extend:
 *   post:
 *     summary: Extend rate lock period
 *     tags: [Rate & Pricing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: lockId
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
 *               - extensionDays
 *               - reason
 *             properties:
 *               extensionDays:
 *                 type: integer
 *                 example: 15
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Rate lock extended successfully
 */
router.post(
  '/locks/:lockId/extend',
  authenticate,
  authorize(roles.LO_RETAIL, roles.LO_TPO, roles.BRANCH_MANAGER, roles.ADMIN),
  [
    body('extensionDays').isInt({ min: 1, max: 90 }),
    body('reason').notEmpty()
  ],
  rateController.extendRateLock
);

module.exports = router;
