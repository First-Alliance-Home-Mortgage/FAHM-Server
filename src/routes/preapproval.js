const express = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/auth');
const roles = require('../config/roles');
const preapprovalController = require('../controllers/preapprovalController');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Preapproval Letters
 *   description: Preapproval letter generation and management
 */

/**
 * @swagger
 * /api/v1/preapproval/generate:
 *   post:
 *     summary: Generate preapproval letter
 *     tags: [Preapproval Letters]
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
 *             properties:
 *               loanId:
 *                 type: string
 *                 description: Loan application ID
 *               validityDays:
 *                 type: number
 *                 default: 90
 *                 description: Number of days letter is valid
 *               conditions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     description:
 *                       type: string
 *                     required:
 *                       type: boolean
 *               branding:
 *                 type: object
 *                 properties:
 *                   logo:
 *                     type: string
 *                   partnerLogo:
 *                     type: string
 *                   partnerName:
 *                     type: string
 *                   primaryColor:
 *                     type: string
 *                   secondaryColor:
 *                     type: string
 *     responses:
 *       201:
 *         description: Preapproval letter generated successfully
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Loan not found
 */
router.post(
  '/generate',
  authenticate,
  authorize({ roles: [roles.LO_RETAIL, roles.LO_TPO, roles.BRANCH_MANAGER, roles.ADMIN] }),
  [
    body('loanId').notEmpty().withMessage('Loan ID is required'),
    body('validityDays').optional().isInt({ min: 1, max: 180 }).withMessage('Validity days must be between 1 and 180'),
    body('conditions').optional().isArray().withMessage('Conditions must be an array'),
    body('branding').optional().isObject().withMessage('Branding must be an object')
  ],
  preapprovalController.generate
);

/**
 * @swagger
 * /api/v1/preapproval/loan/{loanId}:
 *   get:
 *     summary: Get all preapproval letters for a loan
 *     tags: [Preapproval Letters]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: loanId
 *         required: true
 *         schema:
 *           type: string
 *         description: Loan application ID
 *     responses:
 *       200:
 *         description: List of preapproval letters
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Loan not found
 */
router.get(
  '/loan/:loanId',
  authenticate,
  preapprovalController.getByLoan
);

/**
 * @swagger
 * /api/v1/preapproval/{id}:
 *   get:
 *     summary: Get single preapproval letter
 *     tags: [Preapproval Letters]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Preapproval letter ID
 *     responses:
 *       200:
 *         description: Preapproval letter details
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Letter not found
 */
router.get(
  '/:id',
  authenticate,
  preapprovalController.get
);

/**
 * @swagger
 * /api/v1/preapproval/{id}/download:
 *   get:
 *     summary: Download preapproval letter PDF
 *     tags: [Preapproval Letters]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Preapproval letter ID
 *     responses:
 *       200:
 *         description: PDF file download
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Letter not found
 *       410:
 *         description: Letter expired
 */
router.get(
  '/:id/download',
  authenticate,
  preapprovalController.download
);

/**
 * @swagger
 * /api/v1/preapproval/{id}/share:
 *   post:
 *     summary: Share preapproval letter via email, SMS, or link
 *     tags: [Preapproval Letters]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Preapproval letter ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - method
 *             properties:
 *               method:
 *                 type: string
 *                 enum: [email, sms, link]
 *                 description: Sharing method
 *               recipient:
 *                 type: string
 *                 description: Email address or phone number (required for email/sms)
 *     responses:
 *       200:
 *         description: Letter shared successfully
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Letter not found
 *       410:
 *         description: Letter expired
 */
router.post(
  '/:id/share',
  authenticate,
  [
    body('method').isIn(['email', 'sms', 'link']).withMessage('Method must be email, sms, or link'),
    body('recipient').if(body('method').isIn(['email', 'sms'])).notEmpty().withMessage('Recipient is required for email/sms'),
    body('recipient').if(body('method').equals('email')).isEmail().withMessage('Invalid email address'),
    body('recipient').if(body('method').equals('sms')).isMobilePhone().withMessage('Invalid phone number')
  ],
  preapprovalController.share
);

/**
 * @swagger
 * /api/v1/preapproval/{id}/regenerate:
 *   post:
 *     summary: Regenerate preapproval letter PDF
 *     tags: [Preapproval Letters]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Preapproval letter ID
 *     responses:
 *       200:
 *         description: Letter regenerated successfully
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Letter not found
 */
router.post(
  '/:id/regenerate',
  authenticate,
  authorize({ roles: [roles.LO_RETAIL, roles.LO_TPO, roles.BRANCH_MANAGER, roles.ADMIN] }),
  preapprovalController.regenerate
);

/**
 * @swagger
 * /api/v1/preapproval/{id}:
 *   delete:
 *     summary: Delete preapproval letter
 *     tags: [Preapproval Letters]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Preapproval letter ID
 *     responses:
 *       200:
 *         description: Letter deleted successfully
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Letter not found
 */
router.delete(
  '/:id',
  authenticate,
  authorize({ roles: [roles.LO_RETAIL, roles.LO_TPO, roles.BRANCH_MANAGER, roles.ADMIN] }),
  preapprovalController.deletePreapproval
);

module.exports = router;
