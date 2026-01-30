const express = require('express');
const { body, query } = require('express-validator');
const router = express.Router();
const referralSourceController = require('../controllers/referralSourceController');
const { authenticate, authorize } = require('../middleware/auth');
const roles = require('../config/roles');

/**
 * @swagger
 * components:
 *   schemas:
 *     ReferralSource:
 *       type: object
 *       required:
 *         - name
 *         - type
 *       properties:
 *         name:
 *           type: string
 *           maxLength: 100
 *           example: "John Smith"
 *         type:
 *           type: string
 *           enum: [realtor, builder, financial_planner, attorney, cpa, other]
 *           example: "realtor"
 *         companyName:
 *           type: string
 *           maxLength: 100
 *           example: "Smith Realty Group"
 *         email:
 *           type: string
 *           format: email
 *           example: "john@smithrealty.com"
 *         phone:
 *           type: string
 *           example: "+15555551234"
 *         website:
 *           type: string
 *           example: "https://www.smithrealty.com"
 *         branding:
 *           type: object
 *           properties:
 *             logo:
 *               type: string
 *               example: "https://storage.azure.com/logos/smith-realty.png"
 *             primaryColor:
 *               type: string
 *               pattern: "^#[0-9A-Fa-f]{6}$"
 *               example: "#003B5C"
 *             secondaryColor:
 *               type: string
 *               pattern: "^#[0-9A-Fa-f]{6}$"
 *               example: "#FF6B35"
 *             tagline:
 *               type: string
 *               maxLength: 150
 *               example: "Your Trusted Real Estate Partner"
 *         assignedLoanOfficer:
 *           type: string
 *           format: objectId
 *           example: "507f1f77bcf86cd799439011"
 *         partnershipTier:
 *           type: string
 *           enum: [bronze, silver, gold, platinum]
 *           example: "gold"
 *         status:
 *           type: string
 *           enum: [active, inactive, suspended]
 *           example: "active"
 */

/**
 * @swagger
 * /api/v1/referral-sources:
 *   post:
 *     summary: Create a new referral source
 *     tags: [Referral Sources]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReferralSource'
 *     responses:
 *       201:
 *         description: Referral source created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post(
  '/',
  authenticate,
  authorize({ roles: [roles.LO_RETAIL, roles.LO_TPO, roles.BRANCH_MANAGER, roles.ADMIN] }),
  [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
    body('type').isIn(['realtor', 'builder', 'financial_planner', 'attorney', 'cpa', 'other']),
    body('companyName').optional().trim().isLength({ max: 100 }),
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().trim(),
    body('website').optional().trim().isURL(),
    body('branding.logo').optional().trim().isLength({ max: 500 }),
    body('branding.primaryColor').optional().matches(/^#[0-9A-Fa-f]{6}$/),
    body('branding.secondaryColor').optional().matches(/^#[0-9A-Fa-f]{6}$/),
    body('branding.tagline').optional().trim().isLength({ max: 150 }),
    body('branding.customMessage').optional().trim().isLength({ max: 500 }),
    body('assignedLoanOfficer').optional().isMongoId(),
    body('partnershipTier').optional().isIn(['bronze', 'silver', 'gold', 'platinum']),
    body('status').optional().isIn(['active', 'inactive', 'suspended'])
  ],
  referralSourceController.create
);

/**
 * @swagger
 * /api/v1/referral-sources:
 *   get:
 *     summary: Get all referral sources with filtering and pagination
 *     tags: [Referral Sources]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, suspended]
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [realtor, builder, financial_planner, attorney, cpa, other]
 *       - in: query
 *         name: assignedLoanOfficer
 *         schema:
 *           type: string
 *       - in: query
 *         name: partnershipTier
 *         schema:
 *           type: string
 *           enum: [bronze, silver, gold, platinum]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name or company name
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: "-analytics.totalLeads"
 *     responses:
 *       200:
 *         description: List of referral sources
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/',
  authenticate,
  [
    query('status').optional().isIn(['active', 'inactive', 'suspended']),
    query('type').optional().isIn(['realtor', 'builder', 'financial_planner', 'attorney', 'cpa', 'other']),
    query('assignedLoanOfficer').optional().isMongoId(),
    query('partnershipTier').optional().isIn(['bronze', 'silver', 'gold', 'platinum']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  referralSourceController.list
);

/**
 * @swagger
 * /api/v1/referral-sources/top-performers:
 *   get:
 *     summary: Get top performing referral sources
 *     tags: [Referral Sources]
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
 *       - in: query
 *         name: metric
 *         schema:
 *           type: string
 *           default: "revenue.totalLoanVolume"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Top performing referral sources
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Branch Manager or Admin only)
 */
router.get(
  '/top-performers',
  authenticate,
  authorize({ roles: [roles.BRANCH_MANAGER, roles.ADMIN] }),
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('limit').optional().isInt({ min: 1, max: 50 })
  ],
  referralSourceController.getTopPerformers
);

/**
 * @swagger
 * /api/v1/referral-sources/{id}:
 *   get:
 *     summary: Get a single referral source by ID
 *     tags: [Referral Sources]
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
 *         description: Referral source details
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Referral source not found
 */
router.get(
  '/:id',
  authenticate,
  referralSourceController.get
);

/**
 * @swagger
 * /api/v1/referral-sources/{id}:
 *   patch:
 *     summary: Update a referral source
 *     tags: [Referral Sources]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReferralSource'
 *     responses:
 *       200:
 *         description: Referral source updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Referral source not found
 */
router.patch(
  '/:id',
  authenticate,
  authorize({ roles: [roles.LO_RETAIL, roles.LO_TPO, roles.BRANCH_MANAGER, roles.ADMIN] }),
  [
    body('name').optional().trim().notEmpty().isLength({ max: 100 }),
    body('type').optional().isIn(['realtor', 'builder', 'financial_planner', 'attorney', 'cpa', 'other']),
    body('companyName').optional().trim().isLength({ max: 100 }),
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().trim(),
    body('website').optional().trim().isURL(),
    body('assignedLoanOfficer').optional().isMongoId(),
    body('partnershipTier').optional().isIn(['bronze', 'silver', 'gold', 'platinum']),
    body('status').optional().isIn(['active', 'inactive', 'suspended'])
  ],
  referralSourceController.update
);

/**
 * @swagger
 * /api/v1/referral-sources/{id}:
 *   delete:
 *     summary: Delete a referral source
 *     tags: [Referral Sources]
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
 *         description: Referral source deleted successfully
 *       400:
 *         description: Cannot delete (has associated loans)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Admin only)
 *       404:
 *         description: Referral source not found
 */
router.delete(
  '/:id',
  authenticate,
  authorize({ roles: [roles.ADMIN] }),
  referralSourceController.deleteReferralSource
);

/**
 * @swagger
 * /api/v1/referral-sources/{id}/analytics:
 *   get:
 *     summary: Get analytics for a referral source
 *     tags: [Referral Sources]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
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
 *         name: periodType
 *         schema:
 *           type: string
 *           enum: [daily, monthly, yearly]
 *           default: "daily"
 *     responses:
 *       200:
 *         description: Referral source analytics
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Referral source not found
 */
router.get(
  '/:id/analytics',
  authenticate,
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('periodType').optional().isIn(['daily', 'monthly', 'yearly'])
  ],
  referralSourceController.getAnalytics
);

/**
 * @swagger
 * /api/v1/referral-sources/{id}/branding:
 *   get:
 *     summary: Get referral source branding configuration (public)
 *     tags: [Referral Sources]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Branding configuration
 *       400:
 *         description: Referral source is not active
 *       404:
 *         description: Referral source not found
 */
router.get(
  '/:id/branding',
  referralSourceController.getBranding
);

/**
 * @swagger
 * /api/v1/referral-sources/{id}/branding:
 *   patch:
 *     summary: Update referral source branding
 *     tags: [Referral Sources]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *               branding:
 *                 type: object
 *                 properties:
 *                   logo:
 *                     type: string
 *                   primaryColor:
 *                     type: string
 *                     pattern: "^#[0-9A-Fa-f]{6}$"
 *                   secondaryColor:
 *                     type: string
 *                     pattern: "^#[0-9A-Fa-f]{6}$"
 *                   tagline:
 *                     type: string
 *                   customMessage:
 *                     type: string
 *               coBrandingSettings:
 *                 type: object
 *                 properties:
 *                   enablePreapprovalLetters:
 *                     type: boolean
 *                   enableBusinessCards:
 *                     type: boolean
 *                   enableEmailCommunications:
 *                     type: boolean
 *                   enableBorrowerView:
 *                     type: boolean
 *                   customDisclaimer:
 *                     type: string
 *     responses:
 *       200:
 *         description: Branding updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Referral source not found
 */
router.patch(
  '/:id/branding',
  authenticate,
  authorize({ roles: [roles.LO_RETAIL, roles.LO_TPO, roles.BRANCH_MANAGER, roles.ADMIN] }),
  [
    body('branding.logo').optional().trim().isLength({ max: 500 }),
    body('branding.primaryColor').optional().matches(/^#[0-9A-Fa-f]{6}$/),
    body('branding.secondaryColor').optional().matches(/^#[0-9A-Fa-f]{6}$/),
    body('branding.tagline').optional().trim().isLength({ max: 150 }),
    body('branding.customMessage').optional().trim().isLength({ max: 500 }),
    body('coBrandingSettings.enablePreapprovalLetters').optional().isBoolean(),
    body('coBrandingSettings.enableBusinessCards').optional().isBoolean(),
    body('coBrandingSettings.enableEmailCommunications').optional().isBoolean(),
    body('coBrandingSettings.enableBorrowerView').optional().isBoolean(),
    body('coBrandingSettings.customDisclaimer').optional().trim().isLength({ max: 500 })
  ],
  referralSourceController.updateBranding
);

/**
 * @swagger
 * /api/v1/referral-sources/{id}/track:
 *   post:
 *     summary: Track referral source activity (internal use)
 *     tags: [Referral Sources]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *               - activityType
 *             properties:
 *               activityType:
 *                 type: string
 *                 enum: [lead, application, preapproval, funded]
 *               loanAmount:
 *                 type: number
 *               productType:
 *                 type: string
 *     responses:
 *       200:
 *         description: Activity tracked successfully
 *       400:
 *         description: Invalid activity type
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Referral source not found
 */
router.post(
  '/:id/track',
  authenticate,
  [
    body('activityType').isIn(['lead', 'application', 'preapproval', 'funded']),
    body('loanAmount').optional().isNumeric(),
    body('productType').optional().trim()
  ],
  referralSourceController.trackActivity
);

module.exports = router;
