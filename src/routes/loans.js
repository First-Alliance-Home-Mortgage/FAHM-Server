const express = require('express');
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const loanController = require('../controllers/loanController');
const preapprovalController = require('../controllers/preapprovalController');
const roles = require('../config/roles');

const router = express.Router();

router.use(authenticate);

/**
 * @swagger
 * /loans:
 *   get:
 *     summary: List all loans
 *     tags: [Loans]
 *     description: Borrowers see only their own loans. Other roles see all loans.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of loans
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/LoanApplication'
 *       401:
 *         description: Unauthorized
 */
router.get('/', loanController.list);

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
  authorize(roles.ADMIN, roles.LO_TPO, roles.LO_RETAIL, roles.BROKER, roles.BORROWER),
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
router.patch('/:id/status', authorize(roles.ADMIN, roles.LO_TPO, roles.LO_RETAIL), loanController.updateStatus);

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
  authorize(roles.ADMIN, roles.LO_TPO, roles.LO_RETAIL, roles.BRANCH_MANAGER),
  preapprovalController.generate
);

module.exports = router;

