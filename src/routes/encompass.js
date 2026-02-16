const express = require('express');
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const encompassController = require('../controllers/encompassController');

const router = express.Router();

// Webhook endpoint must be before authentication middleware
// as it receives requests from Encompass, not authenticated users
/**
 * @swagger
 * /encompass/webhook:
 *   post:
 *     summary: Encompass webhook endpoint
 *     tags: [Encompass Integration]
 *     description: Receive real-time updates from Encompass. This endpoint should be registered with Encompass webhook configuration.
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
 *                 description: The Encompass loan GUID
 *               data:
 *                 type: object
 *     responses:
 *       200:
 *         description: Webhook processed
 *       401:
 *         description: Invalid webhook signature
 */
router.post('/webhook', encompassController.webhook);

// All routes below require authentication
router.use(authenticate);

router.get('/encompassToken', encompassController.encompassToken);

/**
 * @swagger
 * /encompass/token/introspect:
 *   get:
 *     summary: Introspect current Encompass access token
 *     tags: [Encompass Integration]
 *     description: Check whether the cached Encompass access token is still active and retrieve its metadata (expiry, username, instance).
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token introspection result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 active:
 *                   type: boolean
 *                 exp:
 *                   type: number
 *                 username:
 *                   type: string
 *                 encompass_instance_id:
 *                   type: string
 *       503:
 *         description: Token introspection failed
 */
router.get(
  '/token/introspect',
  authorize({ roles: ['admin'] }),
  encompassController.introspectToken
);

/**
 * @swagger
 * /encompass/token/revoke:
 *   post:
 *     summary: Revoke current Encompass access token
 *     tags: [Encompass Integration]
 *     description: Revoke the cached Encompass access token and clear the local cache. Useful for security rotation.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Revocation result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 revoked:
 *                   type: boolean
 *                 message:
 *                   type: string
 */
router.post(
  '/token/revoke',
  authorize({ roles: ['admin'] }),
  encompassController.revokeToken
);

/**
 * @swagger
 * /encompass/test-connection:
 *   get:
 *     summary: Test Encompass API connection
 *     tags: [Encompass Integration]
 *     description: Verify that the server can connect to Encompass API. Checks configuration, authentication, and API connectivity.
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
 *                   example: Successfully connected to Encompass API
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 duration:
 *                   type: number
 *                   description: Test duration in milliseconds
 *                 checks:
 *                   type: object
 *                   properties:
 *                     configuration:
 *                       type: object
 *                     authentication:
 *                       type: object
 *                     apiConnectivity:
 *                       type: object
 *       503:
 *         description: Connection failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 connected:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                 error:
 *                   type: string
 */
router.get(
  '/test-connection',
  authorize({ roles: ['loan_officer_tpo', 'loan_officer_retail', 'admin'] }),
  encompassController.testConnection
);
/**
 * @swagger
 * /encompass/loans/{id}/sync:
 *   post:
 *     summary: Sync loan data from Encompass
 *     tags: [Encompass Integration]
 *     description: Fetch and sync loan status, milestones, and contacts from Encompass LOS. Auto-syncs every 15 minutes or can be triggered manually.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Loan MongoDB ObjectId
 *         example: 507f191e810c19729de860ea
 *     responses:
 *       200:
 *         description: Loan synced successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Loan synced successfully
 *                 loan:
 *                   $ref: '#/components/schemas/LoanApplication'
 *                 contacts:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       role:
 *                         type: string
 *                         enum: [loan_officer, processor, underwriter, closer, other]
 *                       name:
 *                         type: string
 *                       email:
 *                         type: string
 *                       phone:
 *                         type: string
 *                 syncLog:
 *                   type: object
 *                   properties:
 *                     duration:
 *                       type: number
 *                       description: Sync duration in milliseconds
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Loan not linked to Encompass
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
 *     tags: [Encompass Integration]
 *     description: Retrieve all assigned contacts for a loan (Loan Officer, Processor, Underwriter, Closer)
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
 *         description: List of loan contacts
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   loan:
 *                     type: string
 *                   role:
 *                     type: string
 *                     enum: [loan_officer, processor, underwriter, closer, other]
 *                   name:
 *                     type: string
 *                     example: John Smith
 *                   email:
 *                     type: string
 *                     example: john.smith@fahm.com
 *                   phone:
 *                     type: string
 *                     example: '5551234567'
 *                   isPrimary:
 *                     type: boolean
 *                   user:
 *                     $ref: '#/components/schemas/User'
 *       403:
 *         description: Forbidden - Borrowers can only view their own loan contacts
 *       404:
 *         description: Loan not found
 */
router.get('/loans/:id/contacts', encompassController.getContacts);

/**
 * @swagger
 * /encompass/loans/{id}/messages:
 *   get:
 *     summary: Get loan messages (chat history)
 *     tags: [Encompass Integration]
 *     description: Retrieve secure in-app messages between borrowers and FAHM contacts (auto-logged to Encompass)
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
 *         description: Chat message history
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   loan:
 *                     type: string
 *                   sender:
 *                     $ref: '#/components/schemas/User'
 *                   recipient:
 *                     $ref: '#/components/schemas/User'
 *                   messageType:
 *                     type: string
 *                     enum: [text, system, document, milestone]
 *                   content:
 *                     type: string
 *                     example: Your documents have been received
 *                   read:
 *                     type: boolean
 *                   readAt:
 *                     type: string
 *                     format: date-time
 *                   encompassSynced:
 *                     type: boolean
 *                   createdAt:
 *                     type: string
 *                     format: date-time
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
 *     tags: [Encompass Integration]
 *     description: Send secure message to borrower or loan team. Messages are auto-logged to Encompass for compliance.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Loan MongoDB ObjectId
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
 *                 example: Your pre-approval letter is ready for download
 *               recipientId:
 *                 type: string
 *                 format: objectId
 *                 description: Optional recipient user ID (broadcast if omitted)
 *               messageType:
 *                 type: string
 *                 enum: [text, system, document, milestone]
 *                 default: text
 *               metadata:
 *                 type: object
 *                 description: Additional context data
 *     responses:
 *       201:
 *         description: Message sent successfully
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
 *     tags: [Encompass Integration]
 *     description: Mark a loan message as read by the recipient
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Loan MongoDB ObjectId
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *         description: Message MongoDB ObjectId
 *     responses:
 *       200:
 *         description: Message marked as read
 *       403:
 *         description: Forbidden - Only recipient can mark as read
 *       404:
 *         description: Message not found
 */
router.post('/loans/:id/messages/:messageId/read', encompassController.markMessageRead);

/**
 * @swagger
 * /encompass/loans/{id}/sync-history:
 *   get:
 *     summary: Get Encompass sync history
 *     tags: [Encompass Integration]
 *     description: View sync log history for debugging and auditing (LO/Admin only)
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
 *         description: Sync history retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 lastSync:
 *                   type: string
 *                   format: date-time
 *                 encompassLoanId:
 *                   type: string
 *                 logs:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       syncType:
 *                         type: string
 *                         enum: [status, milestones, contacts, documents, full]
 *                       direction:
 *                         type: string
 *                         enum: [inbound, outbound]
 *                       status:
 *                         type: string
 *                         enum: [pending, success, failed, partial]
 *                       syncDuration:
 *                         type: number
 *                       errorMessage:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *       403:
 *         description: Forbidden - LO/Admin only
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
 *     summary: Link a loan to Encompass
 *     tags: [Encompass Integration]
 *     description: Associate a FAHM loan with an Encompass loan ID. LO/Admin only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Loan MongoDB ObjectId
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
 *                 description: The Encompass loan GUID
 *                 example: "12345678-1234-1234-1234-123456789012"
 *     responses:
 *       200:
 *         description: Loan linked successfully
 *       400:
 *         description: Invalid Encompass loan ID
 *       403:
 *         description: Forbidden - LO/Admin only
 *       404:
 *         description: Loan not found
 *       409:
 *         description: Encompass loan already linked to another application
 */
router.post(
  '/loans/:id/link',
  authorize({ roles: ['loan_officer_tpo', 'loan_officer_retail', 'admin'] }),
  [body('encompassLoanId').notEmpty().withMessage('Encompass loan ID is required')],
  encompassController.linkLoan
);

/**
 * @swagger
 * /encompass/loans/{id}/unlink:
 *   post:
 *     summary: Unlink a loan from Encompass
 *     tags: [Encompass Integration]
 *     description: Remove the Encompass association from a FAHM loan. Admin only.
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
 *         description: Loan unlinked successfully
 *       400:
 *         description: Loan is not linked to Encompass
 *       403:
 *         description: Forbidden - Admin only
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
 *     summary: Update loan status in Encompass
 *     tags: [Encompass Integration]
 *     description: Push loan status and milestone updates to Encompass. LO/Admin only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Loan MongoDB ObjectId
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
 *         description: Status updated successfully
 *       400:
 *         description: Loan not linked to Encompass
 *       403:
 *         description: Forbidden - LO/Admin only
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
 *     summary: Get documents from Encompass
 *     tags: [Encompass Integration]
 *     description: Retrieve list of documents attached to the loan in Encompass
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
 *         description: List of documents
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   title:
 *                     type: string
 *                   documentType:
 *                     type: string
 *                   mimeType:
 *                     type: string
 *                   size:
 *                     type: number
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                   createdBy:
 *                     type: string
 *       400:
 *         description: Loan not linked to Encompass
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
 *     summary: Upload document to Encompass
 *     tags: [Encompass Integration]
 *     description: Upload a document to the loan in Encompass
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Loan MongoDB ObjectId
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
 *               documentType:
 *                 type: string
 *                 example: "Income"
 *               base64Content:
 *                 type: string
 *                 description: Base64 encoded file content
 *               mimeType:
 *                 type: string
 *                 default: application/pdf
 *     responses:
 *       201:
 *         description: Document uploaded successfully
 *       400:
 *         description: Loan not linked to Encompass or invalid request
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
 * /encompass/loans/{id}/documents/{attachmentId}/download:
 *   get:
 *     summary: Download document from Encompass
 *     tags: [Encompass Integration]
 *     description: Download a specific document from Encompass
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Loan MongoDB ObjectId
 *       - in: path
 *         name: attachmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Encompass attachment ID
 *     responses:
 *       200:
 *         description: Document file
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Loan not linked to Encompass
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Loan or document not found
 */
router.get('/loans/:id/documents/:attachmentId/download', encompassController.downloadDocument);

module.exports = router;
