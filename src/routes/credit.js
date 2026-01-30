const express = require('express');

const { body } = require('express-validator');
const creditController = require('../controllers/creditController');
const { authenticate, authorize } = require('../middleware/auth');
const roles = require('../config/roles');

const router = express.Router(); // Removed unused 'query' import

/**
 * @swagger
 * tags:
 *   name: Credit Reporting
 *   description: Xactus credit reporting integration for tri-merge reports and scoring
 */

/**
 * @swagger
 * /api/v1/credit/loans/{loanId}/request:
 *   post:
 *     summary: Request tri-merge credit report for a borrower
 *     tags: [Credit Reporting]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: loanId
 *         required: true
 *         schema:
 *           type: string
 *         description: Loan Application ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - borrowerId
 *               - ssn
 *               - dateOfBirth
 *               - address
 *               - borrowerConsent
 *             properties:
 *               borrowerId:
 *                 type: string
 *                 description: Borrower User ID
 *               ssn:
 *                 type: string
 *                 description: Social Security Number (encrypted in transit)
 *                 example: "123-45-6789"
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *                 example: "1985-06-15"
 *               address:
 *                 type: object
 *                 properties:
 *                   street:
 *                     type: string
 *                   city:
 *                     type: string
 *                   state:
 *                     type: string
 *                   zip:
 *                     type: string
 *               pullType:
 *                 type: string
 *                 enum: [hard, soft]
 *                 default: hard
 *               purpose:
 *                 type: string
 *                 enum: [preapproval, underwriting, reissue, monitoring]
 *                 default: preapproval
 *               borrowerConsent:
 *                 type: object
 *                 required:
 *                   - obtained
 *                 properties:
 *                   obtained:
 *                     type: boolean
 *                     example: true
 *                   consentDate:
 *                     type: string
 *                     format: date-time
 *           example:
 *             borrowerId: "6939c90158393a0d5be59809"
 *             ssn: "123-45-6789"
 *             dateOfBirth: "1985-06-15"
 *             address:
 *               street: "123 Main St"
 *               city: "Portland"
 *               state: "OR"
 *               zip: "97201"
 *             pullType: "hard"
 *             purpose: "preapproval"
 *             borrowerConsent:
 *               obtained: true
 *               consentDate: "2025-12-12T10:00:00Z"
 *     responses:
 *       201:
 *         description: Credit report requested successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 creditReport:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     xactusReportId:
 *                       type: string
 *                     status:
 *                       type: string
 *                     scores:
 *                       type: array
 *                       items:
 *                         type: object
 *                     midScore:
 *                       type: number
 *                     summary:
 *                       type: object
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Validation error or missing consent
 *       404:
 *         description: Loan or borrower not found
 *       403:
 *         description: Access denied
 */
router.post(
  '/loans/:loanId/request',
  authenticate,
  authorize({ roles: [roles.ADMIN, roles.LO_RETAIL, roles.LO_TPO] }),
  body('borrowerId').notEmpty().withMessage('Borrower ID is required'),
  body('ssn').notEmpty().withMessage('SSN is required'),
  body('dateOfBirth').notEmpty().isISO8601().withMessage('Valid date of birth is required'),
  body('address').isObject().withMessage('Address is required'),
  body('borrowerConsent.obtained').equals('true').withMessage('Borrower consent is required'),
  creditController.requestCreditReport
);

/**
 * @swagger
 * /api/v1/credit/reports/{reportId}:
 *   get:
 *     summary: Get credit report by ID
 *     tags: [Credit Reporting]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: string
 *         description: Credit Report ID
 *       - in: query
 *         name: includeRawData
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include encrypted raw data (admin/LO only)
 *     responses:
 *       200:
 *         description: Credit report retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 creditReport:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     xactusReportId:
 *                       type: string
 *                     reportType:
 *                       type: string
 *                       enum: [tri_merge, single_bureau, soft_pull]
 *                     status:
 *                       type: string
 *                       enum: [pending, completed, failed, expired]
 *                     scores:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           bureau:
 *                             type: string
 *                             enum: [equifax, experian, transunion]
 *                           score:
 *                             type: number
 *                           scoreModel:
 *                             type: string
 *                     midScore:
 *                       type: number
 *                       example: 720
 *                     tradelines:
 *                       type: array
 *                       items:
 *                         type: object
 *                     publicRecords:
 *                       type: array
 *                       items:
 *                         type: object
 *                     inquiries:
 *                       type: array
 *                       items:
 *                         type: object
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalAccounts:
 *                           type: number
 *                         openAccounts:
 *                           type: number
 *                         totalDebt:
 *                           type: number
 *                         creditUtilization:
 *                           type: number
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *       404:
 *         description: Credit report not found
 *       403:
 *         description: Access denied
 */
router.get('/reports/:reportId', authenticate, creditController.getCreditReport);

/**
 * @swagger
 * /api/v1/credit/loans/{loanId}/reports:
 *   get:
 *     summary: Get all credit reports for a loan
 *     tags: [Credit Reporting]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: loanId
 *         required: true
 *         schema:
 *           type: string
 *         description: Loan Application ID
 *     responses:
 *       200:
 *         description: Credit reports retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 loan:
 *                   type: string
 *                 creditReports:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       xactusReportId:
 *                         type: string
 *                       reportType:
 *                         type: string
 *                       status:
 *                         type: string
 *                       midScore:
 *                         type: number
 *                       borrower:
 *                         type: object
 *                       requestedBy:
 *                         type: object
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       expiresAt:
 *                         type: string
 *                         format: date-time
 *       404:
 *         description: Loan not found
 *       403:
 *         description: Access denied
 */
router.get('/loans/:loanId/reports', authenticate, creditController.getCreditReportsForLoan);

/**
 * @swagger
 * /api/v1/credit/reports/{reportId}/reissue:
 *   post:
 *     summary: Reissue/refresh an existing credit report
 *     tags: [Credit Reporting]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: string
 *         description: Existing Credit Report ID
 *     responses:
 *       200:
 *         description: Credit report reissued successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 creditReport:
 *                   type: object
 *       404:
 *         description: Credit report not found
 *       403:
 *         description: Access denied
 */
router.post(
  '/reports/:reportId/reissue',
  authenticate,
  authorize({ roles: [roles.ADMIN, roles.LO_RETAIL, roles.LO_TPO] }),
  creditController.reissueCreditReport
);

/**
 * @swagger
 * /api/v1/credit/logs:
 *   get:
 *     summary: Get credit pull logs for audit and compliance
 *     tags: [Credit Reporting]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: loanId
 *         schema:
 *           type: string
 *         description: Filter by loan ID
 *       - in: query
 *         name: borrowerId
 *         schema:
 *           type: string
 *         description: Filter by borrower ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [initiated, completed, failed]
 *         description: Filter by pull status
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 50
 *         description: Number of logs to return
 *     responses:
 *       200:
 *         description: Credit pull logs retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 logs:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       loan:
 *                         type: string
 *                       borrower:
 *                         type: object
 *                       requestedBy:
 *                         type: object
 *                       pullType:
 *                         type: string
 *                       purpose:
 *                         type: string
 *                       status:
 *                         type: string
 *                       borrowerConsent:
 *                         type: object
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *       403:
 *         description: Access denied
 */
router.get(
  '/logs',
  authenticate,
  authorize({ roles: [roles.ADMIN, roles.LO_RETAIL, roles.LO_TPO] }),
  creditController.getCreditPullLogs
);

/**
 * @swagger
 * /api/v1/credit/expired/purge:
 *   post:
 *     summary: Delete expired credit reports per FCRA retention policy
 *     tags: [Credit Reporting]
 *     security:
 *       - bearerAuth: []
 *     description: Purges credit reports that have exceeded the FCRA retention period (2 years). Admin only.
 *     responses:
 *       200:
 *         description: Expired reports purged successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 deletedCount:
 *                   type: number
 *       403:
 *         description: Access denied
 */
router.post(
  '/expired/purge',
  authenticate,
  authorize({ roles: [roles.ADMIN] }),
  creditController.deleteExpiredReports
);

module.exports = router;
