const express = require('express');
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const encompassController = require('../controllers/encompassController');
const roles = require('../config/roles');

const router = express.Router();

router.use(authenticate);

router.get('/encompassToken', encompassController.encompassToken);
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
  authorize(roles.LO_TPO, roles.LO_RETAIL, roles.ADMIN, roles.BRANCH_MANAGER),
  encompassController.getSyncHistory
);

module.exports = router;
