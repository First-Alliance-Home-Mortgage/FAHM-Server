const express = require('express');
const { body, query } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const encompassController = require('../controllers/encompassController');

const router = express.Router();

// Webhook endpoint must be before authentication middleware
/**
 * @swagger
 * /encompass/webhook:
 *   post:
 *     summary: Webhook endpoint for external events
 *     tags: [Loan Management]
 *     description: Receive real-time updates from external systems.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               eventType:
 *                 type: string
 *                 enum: [loan.milestone.updated, loan.status.changed, loan.contacts.updated]
 *               resourceType:
 *                 type: string
 *               resourceId:
 *                 type: string
 *                 description: The external loan reference ID
 *               data:
 *                 type: object
 *     responses:
 *       200:
 *         description: Webhook processed
 */
router.post('/webhook', encompassController.webhook);

// All routes below require authentication
router.use(authenticate);

const { VALID_STATUSES } = encompassController;

/**
 * @swagger
 * /encompass/test-connection:
 *   get:
 *     summary: Test database connection
 *     tags: [Loan Management]
 *     description: Verify that the server can connect to the local database.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Connection successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 connected:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Local database connection healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 duration:
 *                   type: number
 *                   description: Test duration in milliseconds
 *                 checks:
 *                   type: object
 *       503:
 *         description: Connection failed
 */
router.get(
  '/test-connection',
  authorize({ roles: ['loan_officer_tpo', 'loan_officer_retail', 'admin'] }),
  encompassController.testConnection
);

const validatePipelineQuery = [
  query('status')
    .optional()
    .isString()
    .trim()
    .custom((value) => {
      const statuses = value.split(',').map(s => s.trim()).filter(Boolean);
      const invalid = statuses.filter(s => !VALID_STATUSES.includes(s));
      if (invalid.length > 0) {
        throw new Error(
          `Invalid status(es): ${invalid.join(', ')}. Valid values: ${VALID_STATUSES.join(', ')}`
        );
      }
      return true;
    }),
  query('loanOfficer').optional().isString().trim(),
  query('borrowerName').optional().isString().trim(),
  query('source').optional().isIn(['retail', 'tpo']),
  query('dateFrom').optional().isISO8601(),
  query('dateTo').optional().isISO8601(),
  query('start').optional().isInt({ min: 0 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('sortField').optional().isString().trim(),
  query('sortOrder').optional().isIn(['asc', 'desc']),
];

/**
 * @swagger
 * /encompass/pipeline:
 *   get:
 *     summary: Query the loan pipeline
 *     tags: [Loan Management]
 *     description: >
 *       Query the local loan pipeline with filters, sorting, and pagination.
 *       Returns loan data from the local database.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: >
 *           Comma-separated loan statuses.
 *           Valid values: application, processing, underwriting, closing, funded
 *       - in: query
 *         name: loanOfficer
 *         schema:
 *           type: string
 *         description: Filter by loan officer name or ObjectId
 *       - in: query
 *         name: borrowerName
 *         schema:
 *           type: string
 *         description: Filter by borrower name (contains match)
 *       - in: query
 *         name: source
 *         schema:
 *           type: string
 *           enum: [retail, tpo]
 *         description: Filter by loan source
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *         description: Application date on or after (ISO 8601)
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *         description: Application date on or before (ISO 8601)
 *       - in: query
 *         name: start
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Pagination offset
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 25
 *           maximum: 100
 *         description: Page size
 *       - in: query
 *         name: sortField
 *         schema:
 *           type: string
 *           enum: [status, amount, createdAt, updatedAt]
 *           default: updatedAt
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Pipeline results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       loanNumber:
 *                         type: string
 *                       borrowerName:
 *                         type: string
 *                       loanAmount:
 *                         type: number
 *                       status:
 *                         type: string
 *                       loanOfficerName:
 *                         type: string
 *                       propertyAddress:
 *                         type: string
 *                       source:
 *                         type: string
 *                       applicationDate:
 *                         type: string
 *                       lastModified:
 *                         type: string
 *                 total:
 *                   type: integer
 *                 start:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires LO, Branch Manager, or Admin role
 */
router.get(
  '/pipeline',
  validatePipelineQuery,
  authorize({ roles: ['loan_officer_tpo', 'loan_officer_retail', 'branch_manager', 'admin'] }),
  encompassController.queryPipeline
);

/**
 * @swagger
 * /encompass/pipeline/fields:
 *   get:
 *     summary: Get field definitions for pipeline queries
 *     tags: [Loan Management]
 *     description: >
 *       Returns the list of fields available for filtering, sorting,
 *       and field selection in pipeline queries.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Field definitions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 total:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires LO, Branch Manager, or Admin role
 */
router.get(
  '/pipeline/fields',
  authorize({ roles: ['loan_officer_tpo', 'loan_officer_retail', 'branch_manager', 'admin'] }),
  encompassController.getPipelineFields
);

/**
 * @swagger
 * /encompass/loans/{id}/sync:
 *   post:
 *     summary: Get loan data with contacts
 *     tags: [Loan Management]
 *     description: Retrieve loan details along with contacts from local database.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Loan MongoDB ObjectId
 *     responses:
 *       200:
 *         description: Loan data retrieved
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Loan not found
 */
router.post('/loans/:id/sync', encompassController.syncLoan);

/**
 * @swagger
 * /encompass/loans/{id}/contacts:
 *   get:
 *     summary: Get loan contacts
 *     tags: [Loan Management]
 *     description: Retrieve all assigned contacts for a loan
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
 *         description: List of loan contacts
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Loan not found
 */
router.get('/loans/:id/contacts', encompassController.getContacts);

/**
 * @swagger
 * /encompass/loans/{id}/messages:
 *   get:
 *     summary: Get loan messages
 *     tags: [Loan Management]
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
 *         description: Chat message history
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Loan not found
 */
router.get('/loans/:id/messages', encompassController.getMessages);

/**
 * @swagger
 * /encompass/loans/{id}/messages:
 *   post:
 *     summary: Send message for a loan
 *     tags: [Loan Management]
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
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *               recipientId:
 *                 type: string
 *                 format: objectId
 *               messageType:
 *                 type: string
 *                 enum: [text, system, document, milestone]
 *                 default: text
 *               metadata:
 *                 type: object
 *     responses:
 *       201:
 *         description: Message sent
 *       400:
 *         description: Validation errors
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Loan not found
 */
router.post(
  '/loans/:id/messages',
  [body('content').notEmpty().withMessage('Message content required')],
  encompassController.sendMessage
);

/**
 * @swagger
 * /encompass/loans/{id}/messages/{messageId}/read:
 *   post:
 *     summary: Mark message as read
 *     tags: [Loan Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Message marked as read
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Message not found
 */
router.post('/loans/:id/messages/:messageId/read', encompassController.markMessageRead);

/**
 * @swagger
 * /encompass/loans/{id}/sync-history:
 *   get:
 *     summary: Get sync history
 *     tags: [Loan Management]
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
 *         description: Sync history retrieved
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Loan not found
 */
router.get(
  '/loans/:id/sync-history',
  authorize({ roles: ['loan_officer_tpo', 'loan_officer_retail', 'admin', 'branch_manager'] }),
  encompassController.getSyncHistory
);

/**
 * @swagger
 * /encompass/loans/{id}/link:
 *   post:
 *     summary: Link loan to external reference
 *     tags: [Loan Management]
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
 *               - encompassLoanId
 *             properties:
 *               encompassLoanId:
 *                 type: string
 *                 description: External loan reference ID
 *     responses:
 *       200:
 *         description: Loan linked
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Loan not found
 *       409:
 *         description: Already linked to another application
 */
router.post(
  '/loans/:id/link',
  authorize({ roles: ['loan_officer_tpo', 'loan_officer_retail', 'admin'] }),
  [body('encompassLoanId').notEmpty().withMessage('External loan ID is required')],
  encompassController.linkLoan
);

/**
 * @swagger
 * /encompass/loans/{id}/unlink:
 *   post:
 *     summary: Unlink loan from external reference
 *     tags: [Loan Management]
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
 *         description: Loan unlinked
 *       400:
 *         description: Loan not linked
 *       403:
 *         description: Admin only
 *       404:
 *         description: Loan not found
 */
router.post(
  '/loans/:id/unlink',
  authorize({ roles: ['admin'] }),
  encompassController.unlinkLoan
);

/**
 * @swagger
 * /encompass/loans/{id}/status:
 *   patch:
 *     summary: Update loan status
 *     tags: [Loan Management]
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
 *               status:
 *                 type: string
 *                 enum: [application, processing, underwriting, closing, funded]
 *               milestones:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [pending, in_progress, completed]
 *     responses:
 *       200:
 *         description: Status updated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Loan not found
 */
router.patch(
  '/loans/:id/status',
  authorize({ roles: ['loan_officer_tpo', 'loan_officer_retail', 'admin'] }),
  encompassController.updateStatus
);

/**
 * @swagger
 * /encompass/loans/{id}/documents:
 *   get:
 *     summary: Get loan documents
 *     tags: [Loan Management]
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
 *         description: List of documents
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Loan not found
 */
router.get('/loans/:id/documents', encompassController.getDocuments);

/**
 * @swagger
 * /encompass/loans/{id}/documents:
 *   post:
 *     summary: Upload document for a loan
 *     tags: [Loan Management]
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
 *               - base64Content
 *             properties:
 *               title:
 *                 type: string
 *                 example: "W2 Form 2024"
 *               base64Content:
 *                 type: string
 *                 description: Base64 encoded file content
 *               mimeType:
 *                 type: string
 *                 default: application/pdf
 *     responses:
 *       201:
 *         description: Document uploaded
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Loan not found
 */
router.post(
  '/loans/:id/documents',
  [body('base64Content').notEmpty().withMessage('Document content is required')],
  encompassController.uploadDocument
);

/**
 * @swagger
 * /encompass/loans/{id}/documents/{documentId}/download:
 *   get:
 *     summary: Download a document
 *     tags: [Loan Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Document MongoDB ObjectId
 *     responses:
 *       200:
 *         description: Document file
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Loan or document not found
 */
router.get('/loans/:id/documents/:documentId/download', encompassController.downloadDocument);

module.exports = router;
