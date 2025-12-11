const express = require('express');
const { body, param, query } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const posController = require('../controllers/posController');

const router = express.Router();

/**
 * @swagger
 * /pos/handoff:
 *   post:
 *     summary: Create POS handoff token and deep link
 *     tags: [POS Integration]
 *     description: Generate a short-lived JWT token for Point of Sale system handoff with rate limiting (max per user per minute)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               loanId:
 *                 type: string
 *                 format: objectId
 *                 description: Loan MongoDB ObjectId to pass to POS system
 *                 example: 507f191e810c19729de860ea
 *     responses:
 *       200:
 *         description: POS handoff token created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: Short-lived JWT token for POS handoff
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 deepLink:
 *                   type: string
 *                   description: Complete deep link URL with embedded token
 *                   example: pos://app/handoff?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 expiresInMinutes:
 *                   type: integer
 *                   description: Token expiration time in minutes
 *                   example: 5
 *       401:
 *         description: Unauthorized
 *       429:
 *         description: Too many POS handoff requests - rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Too many POS handoff requests, try again shortly
 */
router.post('/handoff', authenticate, posController.createHandoff);

/**
 * @swagger
 * /pos/initiate:
 *   post:
 *     summary: Initiate POS application with Blend or Big POS
 *     tags: [POS Integration]
 *     description: Create secure SSO handoff to Blend or Big POS with pre-filled borrower and loan data. Returns SSO URL for mobile app to open.
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
 *               - posSystem
 *             properties:
 *               loanId:
 *                 type: string
 *                 format: objectId
 *                 description: Loan MongoDB ObjectId
 *                 example: 507f191e810c19729de860ea
 *               posSystem:
 *                 type: string
 *                 enum: [blend, big_pos]
 *                 description: POS system to use for application
 *                 example: blend
 *               returnUrl:
 *                 type: string
 *                 format: uri
 *                 description: URL to return after POS completion
 *                 example: https://app.fahm.com/dashboard
 *               logoUrl:
 *                 type: string
 *                 format: uri
 *                 description: Custom logo URL for FAHM branding
 *                 example: https://fahm.com/logo.png
 *               primaryColor:
 *                 type: string
 *                 description: Primary brand color (hex)
 *                 example: '#003B5C'
 *               secondaryColor:
 *                 type: string
 *                 description: Secondary brand color (hex, Big POS only)
 *                 example: '#FF6B35'
 *     responses:
 *       201:
 *         description: POS application initiated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 applicationId:
 *                   type: string
 *                   description: POS application ID
 *                   example: app_blend_12345
 *                 ssoUrl:
 *                   type: string
 *                   format: uri
 *                   description: SSO URL for mobile app to open
 *                   example: https://blend.com/sso?token=...
 *                 sessionToken:
 *                   type: string
 *                   description: Session token for tracking
 *                   example: sess_abc123
 *                 expiresAt:
 *                   type: string
 *                   format: date-time
 *                   description: SSO URL expiration (1 hour)
 *                   example: 2025-01-15T13:00:00Z
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - borrowers can only access their own loans
 *       404:
 *         description: Loan not found
 */
router.post(
  '/initiate',
  authenticate,
  [
    body('loanId').notEmpty().isMongoId(),
    body('posSystem').notEmpty().isIn(['blend', 'big_pos']),
    body('returnUrl').optional().isURL(),
    body('logoUrl').optional().isURL(),
    body('primaryColor').optional().isString(),
    body('secondaryColor').optional().isString()
  ],
  posController.initiateApplication
);

/**
 * @swagger
 * /pos/application/{applicationId}/status:
 *   get:
 *     summary: Get POS application status
 *     tags: [POS Integration]
 *     description: Fetch real-time application status, progress, and details from Blend or Big POS
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: string
 *         description: POS application ID
 *         example: app_blend_12345
 *       - in: query
 *         name: posSystem
 *         required: true
 *         schema:
 *           type: string
 *           enum: [blend, big_pos]
 *         description: POS system to query
 *         example: blend
 *     responses:
 *       200:
 *         description: Application status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   description: Application status (Blend - draft/submitted/processing/approved/declined, Big POS - initiated/in_progress/completed/submitted/under_review/approved/conditional_approval/denied)
 *                   example: submitted
 *                 completionPercentage:
 *                   type: integer
 *                   description: Application completion percentage
 *                   example: 85
 *                 progressPercentage:
 *                   type: integer
 *                   description: Progress percentage (Big POS only)
 *                   example: 85
 *                 currentStep:
 *                   type: string
 *                   description: Current step in application (Big POS only)
 *                   example: Document Upload
 *                 borrower:
 *                   type: object
 *                   description: Borrower information
 *                 loan:
 *                   type: object
 *                   description: Loan information
 *                 documents:
 *                   type: array
 *                   description: Document list
 *                   items:
 *                     type: object
 *                 milestones:
 *                   type: array
 *                   description: Application milestones (Big POS only)
 *                   items:
 *                     type: object
 *       400:
 *         description: Invalid POS system or application ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Application not found
 */
router.get(
  '/application/:applicationId/status',
  authenticate,
  [
    param('applicationId').notEmpty().isString(),
    query('posSystem').notEmpty().isIn(['blend', 'big_pos'])
  ],
  posController.getApplicationStatus
);

/**
 * @swagger
 * /pos/application/{applicationId}/sync-borrower:
 *   post:
 *     summary: Sync borrower data to POS
 *     tags: [POS Integration]
 *     description: Push updated borrower information to Blend or Big POS application
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: string
 *         description: POS application ID
 *         example: app_blend_12345
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - posSystem
 *               - borrowerData
 *             properties:
 *               posSystem:
 *                 type: string
 *                 enum: [blend, big_pos]
 *                 description: POS system to sync with
 *                 example: blend
 *               borrowerData:
 *                 type: object
 *                 description: Borrower information to sync
 *                 properties:
 *                   firstName:
 *                     type: string
 *                     example: Jane
 *                   lastName:
 *                     type: string
 *                     example: Doe
 *                   email:
 *                     type: string
 *                     format: email
 *                     example: jane.doe@example.com
 *                   phone:
 *                     type: string
 *                     example: 555-123-4567
 *                   ssn:
 *                     type: string
 *                     example: 123-45-6789
 *                   dateOfBirth:
 *                     type: string
 *                     format: date
 *                     example: 1985-05-15
 *                   address:
 *                     type: object
 *                     properties:
 *                       street:
 *                         type: string
 *                         example: 123 Main St
 *                       city:
 *                         type: string
 *                         example: Anytown
 *                       state:
 *                         type: string
 *                         example: CA
 *                       zip:
 *                         type: string
 *                         example: '90210'
 *                   employment:
 *                     type: object
 *                     description: Employment information (Big POS only)
 *                     properties:
 *                       employer:
 *                         type: string
 *                         example: Tech Corp
 *                       jobTitle:
 *                         type: string
 *                         example: Software Engineer
 *                       monthlyIncome:
 *                         type: number
 *                         example: 8500
 *                       yearsEmployed:
 *                         type: number
 *                         example: 3
 *     responses:
 *       200:
 *         description: Borrower data synced successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 validationStatus:
 *                   type: object
 *                   description: Validation warnings/errors (Big POS only)
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Application not found
 */
router.post(
  '/application/:applicationId/sync-borrower',
  authenticate,
  [
    param('applicationId').notEmpty().isString(),
    body('posSystem').notEmpty().isIn(['blend', 'big_pos']),
    body('borrowerData').notEmpty().isObject()
  ],
  posController.syncBorrowerData
);

/**
 * @swagger
 * /pos/application/{applicationId}/documents:
 *   get:
 *     summary: Get POS application documents
 *     tags: [POS Integration]
 *     description: Retrieve list of documents uploaded to POS application with download URLs
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: string
 *         description: POS application ID
 *         example: app_blend_12345
 *       - in: query
 *         name: posSystem
 *         required: true
 *         schema:
 *           type: string
 *           enum: [blend, big_pos]
 *         description: POS system to query
 *         example: blend
 *     responses:
 *       200:
 *         description: Documents retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 documents:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       documentId:
 *                         type: string
 *                         example: doc_12345
 *                       type:
 *                         type: string
 *                         example: paystub
 *                       status:
 *                         type: string
 *                         example: uploaded
 *                       uploadedAt:
 *                         type: string
 *                         format: date-time
 *                         example: 2025-01-15T10:30:00Z
 *                       downloadUrl:
 *                         type: string
 *                         format: uri
 *                         example: https://blend.com/documents/doc_12345/download
 *                       thumbnailUrl:
 *                         type: string
 *                         format: uri
 *                         description: Thumbnail URL (Big POS only)
 *                         example: https://bigpos.com/thumbnails/doc_12345.jpg
 *                       verificationStatus:
 *                         type: string
 *                         description: Verification status (Big POS only)
 *                         example: verified
 *       400:
 *         description: Invalid POS system
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Application not found
 */
router.get(
  '/application/:applicationId/documents',
  authenticate,
  [
    param('applicationId').notEmpty().isString(),
    query('posSystem').notEmpty().isIn(['blend', 'big_pos'])
  ],
  posController.getDocuments
);

/**
 * @swagger
 * /pos/application/{applicationId}/submit:
 *   post:
 *     summary: Submit POS application to underwriting
 *     tags: [POS Integration]
 *     description: Submit completed application to underwriting. Triggers CRM and Encompass sync.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: string
 *         description: POS application ID
 *         example: app_blend_12345
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - posSystem
 *             properties:
 *               posSystem:
 *                 type: string
 *                 enum: [blend, big_pos]
 *                 description: POS system to submit with
 *                 example: big_pos
 *               submissionData:
 *                 type: object
 *                 description: Optional submission data (Big POS only)
 *                 properties:
 *                   notes:
 *                     type: string
 *                     description: Submission notes
 *                     example: Requesting priority review for first-time homebuyer
 *                   urgency:
 *                     type: string
 *                     enum: [low, medium, high]
 *                     description: Urgency level
 *                     example: high
 *                   requestedClosingDate:
 *                     type: string
 *                     format: date
 *                     description: Requested closing date
 *                     example: 2025-03-15
 *     responses:
 *       200:
 *         description: Application submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 confirmationNumber:
 *                   type: string
 *                   description: Submission confirmation number
 *                   example: CNF-2025-001
 *                 submittedAt:
 *                   type: string
 *                   format: date-time
 *                   description: Submission timestamp
 *                   example: 2025-01-15T12:00:00Z
 *                 estimatedReviewTime:
 *                   type: string
 *                   description: Estimated review time (Big POS only)
 *                   example: 2-3 business days
 *                 nextSteps:
 *                   type: array
 *                   description: Next steps in process (Big POS only)
 *                   items:
 *                     type: string
 *                   example: ['Underwriting review', 'Conditional approval', 'Final approval']
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Application not found
 */
router.post(
  '/application/:applicationId/submit',
  authenticate,
  [
    param('applicationId').notEmpty().isString(),
    body('posSystem').notEmpty().isIn(['blend', 'big_pos']),
    body('submissionData').optional().isObject()
  ],
  posController.submitApplication
);

/**
 * @swagger
 * /pos/webhooks/blend:
 *   post:
 *     summary: Handle webhook from Blend POS (public endpoint)
 *     tags: [POS Integration]
 *     description: Receive and process webhook events from Blend POS. Triggers CRM and Encompass sync on application.submitted event. No authentication required (uses signature verification).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               eventType:
 *                 type: string
 *                 description: Webhook event type
 *                 enum: [application.created, application.submitted, application.approved, application.declined, document.uploaded, document.reviewed]
 *                 example: application.submitted
 *               applicationId:
 *                 type: string
 *                 description: Blend application ID
 *                 example: app_blend_12345
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *                 description: Event timestamp
 *                 example: 2025-01-15T12:00:00Z
 *               data:
 *                 type: object
 *                 description: Event-specific data
 *     parameters:
 *       - in: header
 *         name: X-Blend-Signature
 *         required: true
 *         schema:
 *           type: string
 *         description: HMAC-SHA256 signature for webhook verification
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Webhook processed
 *       401:
 *         description: Invalid webhook signature
 *       500:
 *         description: Webhook processing error
 */
router.post('/webhooks/blend', posController.handleBlendWebhook);

/**
 * @swagger
 * /pos/webhooks/big-pos:
 *   post:
 *     summary: Handle webhook from Big POS (public endpoint)
 *     tags: [POS Integration]
 *     description: Receive and process webhook events from Big POS. Triggers CRM and Encompass sync on application.submitted event. No authentication required (uses signature verification).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               eventType:
 *                 type: string
 *                 description: Webhook event type
 *                 enum: [application.initiated, application.progress_updated, application.completed, application.submitted, application.approved, application.conditional_approval, application.denied, document.uploaded, document.verified, milestone.completed]
 *                 example: application.submitted
 *               applicationId:
 *                 type: string
 *                 description: Big POS application ID
 *                 example: app_bigpos_12345
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *                 description: Event timestamp
 *                 example: 2025-01-15T12:00:00Z
 *               data:
 *                 type: object
 *                 description: Event-specific data
 *                 properties:
 *                   status:
 *                     type: string
 *                     example: submitted
 *                   confirmationNumber:
 *                     type: string
 *                     example: CNF-2025-001
 *                   progressPercentage:
 *                     type: integer
 *                     example: 100
 *     parameters:
 *       - in: header
 *         name: X-BigPOS-Signature
 *         required: true
 *         schema:
 *           type: string
 *         description: HMAC-SHA256 signature for webhook verification
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Webhook processed
 *       401:
 *         description: Invalid webhook signature
 *       500:
 *         description: Webhook processing error
 */
router.post('/webhooks/big-pos', posController.handleBigPOSWebhook);

module.exports = router;

