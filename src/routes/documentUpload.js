const express = require('express');
const { body } = require('express-validator');
const documentUploadController = require('../controllers/documentUploadController');
const { authenticate, authorize } = require('../middleware/auth');
const { upload, handleMulterError } = require('../middleware/uploadMiddleware');
const roles = require('../config/roles');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Document Upload
 *   description: Secure document upload to POS with Azure Blob storage
 */

/**
 * @swagger
 * /documents/upload:
 *   post:
 *     summary: Upload documents to loan (PDF, PNG, JPG)
 *     tags: [Document Upload]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - loanId
 *               - documentType
 *               - files
 *             properties:
 *               loanId:
 *                 type: string
 *                 description: Loan ID to attach documents to
 *               documentType:
 *                 type: string
 *                 enum: [paystub, w2, tax_return, bank_statement, id, proof_of_employment, appraisal, purchase_agreement, insurance, credit_report, other]
 *                 description: Type of document being uploaded
 *               description:
 *                 type: string
 *                 description: Optional description of the document
 *               posSystem:
 *                 type: string
 *                 enum: [blend, big_pos, encompass]
 *                 description: POS system to sync to
 *                 default: blend
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Files to upload (max 5 files, 10MB each)
 *     responses:
 *       200:
 *         description: Documents uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     uploaded:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           fileName:
 *                             type: string
 *                           documentType:
 *                             type: string
 *                           status:
 *                             type: string
 *                           uploadedAt:
 *                             type: string
 *                             format: date-time
 *                     failed:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           fileName:
 *                             type: string
 *                           error:
 *                             type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid file type or size
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Loan not found
 */
router.post(
  '/presign',
  authenticate,
  authorize({ roles: [roles.ADMIN, roles.LO_RETAIL, roles.LO_TPO, roles.BROKER, roles.BORROWER] }),
  [
    body('loanId').isMongoId().withMessage('Invalid loan ID'),
    body('documentType').isString().notEmpty(),
    body('fileName').optional().isString(),
    body('mimeType').isIn(['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']),
    body('fileSize').optional().isInt({ min: 1 }),
  ],
  documentUploadController.createPresignedUpload
);

router.post(
  '/upload',
  authenticate,
  upload.array('files', 5),
  handleMulterError,
  [
    body('loanId').isMongoId().withMessage('Invalid loan ID'),
    body('documentType').isIn([
      'paystub',
      'w2',
      'tax_return',
      'bank_statement',
      'id',
      'proof_of_employment',
      'appraisal',
      'purchase_agreement',
      'insurance',
      'credit_report',
      'other'
    ]).withMessage('Invalid document type'),
    body('description').optional().isString(),
    body('posSystem').optional().isIn(['blend', 'big_pos', 'encompass'])
  ],
  documentUploadController.uploadDocument
);

/**
 * @swagger
 * /documents/loan/{loanId}:
 *   get:
 *     summary: Get all documents for a loan
 *     tags: [Document Upload]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: loanId
 *         required: true
 *         schema:
 *           type: string
 *         description: Loan ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [uploaded, processing, synced, failed, deleted]
 *         description: Filter by status
 *       - in: query
 *         name: documentType
 *         schema:
 *           type: string
 *         description: Filter by document type
 *     responses:
 *       200:
 *         description: List of documents
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Loan not found
 */
router.get('/loan/:loanId', authenticate, documentUploadController.getDocumentsByLoan);

/**
 * @swagger
 * /documents/{id}:
 *   get:
 *     summary: Get document details
 *     tags: [Document Upload]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Document ID
 *     responses:
 *       200:
 *         description: Document details
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Document not found
 */
router.get('/:id', authenticate, documentUploadController.getDocument);

/**
 * @swagger
 * /documents/{id}/download:
 *   get:
 *     summary: Download document file
 *     tags: [Document Upload]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Document ID
 *     responses:
 *       200:
 *         description: Document file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *           image/png:
 *             schema:
 *               type: string
 *               format: binary
 *           image/jpeg:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Document not found
 */
router.get('/:id/download', authenticate, documentUploadController.downloadDocument);

/**
 * @swagger
 * /documents/{id}:
 *   delete:
 *     summary: Delete document
 *     tags: [Document Upload]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Document ID
 *     responses:
 *       200:
 *         description: Document deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Document not found
 */
router.delete('/:id', authenticate, documentUploadController.deleteDocument);

/**
 * @swagger
 * /documents/{id}/retry-sync:
 *   post:
 *     summary: Retry POS sync for failed document (LO/Admin only)
 *     tags: [Document Upload]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Document ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               posSystem:
 *                 type: string
 *                 enum: [blend, big_pos, encompass]
 *                 default: blend
 *     responses:
 *       200:
 *         description: Sync retried successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Document not found
 */
router.post(
  '/:id/retry-sync',
  authenticate,
  authorize({ roles: [roles.LO_RETAIL, roles.LO_TPO, roles.ADMIN] }),
  [body('posSystem').optional().isIn(['blend', 'big_pos', 'encompass'])],
  documentUploadController.retrySyncToPOS
);

module.exports = router;
