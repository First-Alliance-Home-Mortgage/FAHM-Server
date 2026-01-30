const express = require('express');
const { body, query } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const roles = require('../config/roles');
const consentController = require('../controllers/consentController');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Consent Management
 *   description: Secure consent-based data sharing for referral partners
 */

/**
 * @swagger
 * /api/v1/consent/request:
 *   post:
 *     summary: Request consent from borrower
 *     tags: [Consent Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - borrowerId
 *               - dataScope
 *               - purpose
 *             properties:
 *               borrowerId:
 *                 type: string
 *               loanId:
 *                 type: string
 *               dataScope:
 *                 type: object
 *                 properties:
 *                   personalInfo:
 *                     type: boolean
 *                   financialInfo:
 *                     type: boolean
 *                   loanDetails:
 *                     type: boolean
 *                   documents:
 *                     type: boolean
 *                   milestones:
 *                     type: boolean
 *                   communications:
 *                     type: boolean
 *               purpose:
 *                 type: string
 *                 enum: [referral_partnership, co_branding, transaction_coordination, market_analysis, compliance_review, other]
 *               purposeDescription:
 *                 type: string
 *               expirationDays:
 *                 type: number
 *     responses:
 *       201:
 *         description: Consent request created
 *       403:
 *         description: Not authorized
 */
router.post(
  '/request',
  authenticate,
  authorize({ roles: [roles.REALTOR, roles.BROKER, roles.LO_RETAIL, roles.LO_TPO] }),
  [
    body('borrowerId').notEmpty().withMessage('Borrower ID is required'),
    body('dataScope').isObject().withMessage('Data scope must be an object'),
    body('purpose').isIn(['referral_partnership', 'co_branding', 'transaction_coordination', 'market_analysis', 'compliance_review', 'other']).withMessage('Invalid purpose'),
    body('expirationDays').optional().isInt({ min: 1, max: 730 }).withMessage('Expiration days must be between 1 and 730')
  ],
  consentController.requestConsent
);

/**
 * @swagger
 * /api/v1/consent/{id}/grant:
 *   post:
 *     summary: Grant consent (borrower approves)
 *     tags: [Consent Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Consent granted
 *       403:
 *         description: Not authorized
 */
router.post(
  '/:id/grant',
  authenticate,
  authorize({ roles: [roles.BORROWER] }),
  consentController.grantConsent
);

/**
 * @swagger
 * /api/v1/consent/{id}/revoke:
 *   post:
 *     summary: Revoke consent
 *     tags: [Consent Management]
 *     security:
 *       - bearerAuth: []
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
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Consent revoked
 *       403:
 *         description: Not authorized
 */
router.post(
  '/:id/revoke',
  authenticate,
  [body('reason').optional().isString()],
  consentController.revokeConsent
);

/**
 * @swagger
 * /api/v1/consent:
 *   get:
 *     summary: Get user's consents
 *     tags: [Consent Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, active, revoked, expired]
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *       - in: query
 *         name: includeExpired
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: List of consents
 */
router.get(
  '/',
  authenticate,
  [
    query('status').optional().isIn(['pending', 'active', 'revoked', 'expired']),
    query('role').optional().isString(),
    query('includeExpired').optional().isBoolean()
  ],
  consentController.getConsents
);

/**
 * @swagger
 * /api/v1/consent/{id}:
 *   get:
 *     summary: Get single consent details
 *     tags: [Consent Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Consent details
 *       403:
 *         description: Not authorized
 */
router.get(
  '/:id',
  authenticate,
  consentController.getConsent
);

/**
 * @swagger
 * /api/v1/consent/check-access:
 *   get:
 *     summary: Check if user has access to borrower data
 *     tags: [Consent Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: borrowerId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: dataScope
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Access check result
 */
router.get(
  '/check-access',
  authenticate,
  [query('borrowerId').notEmpty().withMessage('Borrower ID is required')],
  consentController.checkAccess
);

/**
 * @swagger
 * /api/v1/consent/{id}/log-access:
 *   post:
 *     summary: Log consent access for audit trail
 *     tags: [Consent Management]
 *     security:
 *       - bearerAuth: []
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
 *               details:
 *                 type: string
 *     responses:
 *       200:
 *         description: Access logged
 */
router.post(
  '/:id/log-access',
  authenticate,
  [body('details').optional().isString()],
  consentController.logAccess
);

module.exports = router;
