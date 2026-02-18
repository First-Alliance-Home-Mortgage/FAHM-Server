const express = require('express');
const { body, query } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const loanController = require('../controllers/loanController');
const preapprovalController = require('../controllers/preapprovalController');
const roles = require('../config/roles');

const router = express.Router();

router.use(authenticate);

const validateListLoans = [
  query('status').optional().isString().trim(),
  query('source').optional().isIn(['retail', 'tpo']),
  query('assignedOfficer').optional().isMongoId(),
  query('q').optional().isString().trim(),
  query('dateFrom').optional().isISO8601(),
  query('dateTo').optional().isISO8601(),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('sort').optional().isString().trim(),
];

/**
 * @swagger
 * /loans:
 *   get:
 *     summary: List loans with filtering, pagination, and sorting
 *     tags: [Loans]
 *     description: >
 *       Borrowers see only their own loans. Other roles see all loans.
 *       Supports filtering by status, source, assigned officer, date range, and text search.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Comma-separated statuses (e.g. "processing,underwriting")
 *       - in: query
 *         name: source
 *         schema:
 *           type: string
 *           enum: [retail, tpo]
 *       - in: query
 *         name: assignedOfficer
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the assigned loan officer
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search by borrower name, email, or property address
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter loans created on or after this date (ISO 8601)
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter loans created on or before this date (ISO 8601)
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
 *           maximum: 100
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           default: "-createdAt"
 *         description: Sort field with optional "-" prefix for descending (e.g. "-amount", "createdAt")
 *     responses:
 *       200:
 *         description: Paginated list of loans
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/LoanApplication'
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 */
router.get('/', validateListLoans, loanController.list);

/**
 * @swagger
 * /loans:
 *   post:
 *     summary: Create a new loan application
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *                 example: 250000
 *               borrower:
 *                 type: string
 *                 format: objectId
 *                 description: MongoDB ObjectId (defaults to current user)
 *               assignedOfficer:
 *                 type: string
 *                 format: objectId
 *               propertyAddress:
 *                 type: string
 *                 example: 123 Main St, City, ST 12345
 *               status:
 *                 type: string
 *                 enum: [application, processing, underwriting, closing, funded]
 *               source:
 *                 type: string
 *                 enum: [retail, tpo]
 *               milestones:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/Milestone'
 *     responses:
 *       201:
 *         description: Loan created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoanApplication'
 *       400:
 *         description: Validation errors
 *       403:
 *         description: Forbidden - Insufficient permissions
 */
router.post(
  '/',
  [
    body('amount').isNumeric().withMessage('Amount required'),
    body('borrower').optional().isMongoId(),
    body('assignedOfficer').optional().isMongoId(),
    body('status').optional().isString(),
  ],
  authorize({ roles: [roles.ADMIN, roles.LO_TPO, roles.LO_RETAIL, roles.BROKER, roles.BORROWER] }),
  loanController.create
);

/**
 * @swagger
 * /loans/{id}:
 *   get:
 *     summary: Get loan by ID
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 507f191e810c19729de860ea
 *     responses:
 *       200:
 *         description: Loan details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoanApplication'
 *       404:
 *         description: Loan not found
 */
router.get('/:id', loanController.getById);

/**
 * @swagger
 * /loans/{id}/status:
 *   patch:
 *     summary: Update loan status and milestones
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 507f191e810c19729de860ea
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [application, processing, underwriting, closing, funded]
 *               milestones:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/Milestone'
 *     responses:
 *       200:
 *         description: Loan updated successfully
 *       403:
 *         description: Forbidden - Only loan officers and admins
 *       404:
 *         description: Loan not found
 */
router.patch('/:id/status', authorize({ roles: [roles.ADMIN, roles.LO_TPO, roles.LO_RETAIL] }), loanController.updateStatus);

/**
 * @swagger
 * /loans/{id}/preapproval:
 *   post:
 *     summary: Generate pre-approval for loan
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Pre-approval generated
 *       403:
 *         description: Forbidden
 */
router.post(
  '/:id/preapproval',
  authorize({ roles: [roles.ADMIN, roles.LO_TPO, roles.LO_RETAIL, roles.BRANCH_MANAGER] }),
  preapprovalController.generate
);

module.exports = router;

