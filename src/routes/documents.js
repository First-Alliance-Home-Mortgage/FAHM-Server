const express = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const documentController = require('../controllers/documentController');

const router = express.Router({ mergeParams: true });

router.use(authenticate);

/**
 * @swagger
 * /documents/{loanId}:
 *   get:
 *     summary: List all documents for a loan
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: loanId
 *         required: true
 *         schema:
 *           type: string
 *         description: Loan MongoDB ObjectId
 *         example: 507f191e810c19729de860ea
 *     responses:
 *       200:
 *         description: List of documents
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Document'
 *       401:
 *         description: Unauthorized
 */
router.get('/:loanId', documentController.listForLoan);

/**
 * @swagger
 * /documents:
 *   post:
 *     summary: Upload document metadata
 *     tags: [Documents]
 *     description: Upload document metadata. Actual file storage is external. Duplicate files (same hash) return existing document.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - loan
 *               - name
 *               - hash
 *               - url
 *             properties:
 *               loan:
 *                 type: string
 *                 format: objectId
 *                 description: Loan MongoDB ObjectId
 *                 example: 507f191e810c19729de860ea
 *               name:
 *                 type: string
 *                 example: W2_2024.pdf
 *               type:
 *                 type: string
 *                 enum: [pdf, png, jpg, jpeg]
 *                 default: pdf
 *               size:
 *                 type: integer
 *                 minimum: 1
 *                 description: File size in bytes (max 20MB)
 *                 example: 245760
 *               hash:
 *                 type: string
 *                 description: File hash for duplicate detection
 *                 example: sha256:abc123def456
 *               url:
 *                 type: string
 *                 description: Document storage URL
 *                 example: https://storage.example.com/docs/w2.pdf
 *     responses:
 *       201:
 *         description: Document uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Document'
 *       200:
 *         description: Duplicate document (idempotent) - returns existing document
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Document'
 *       400:
 *         description: Validation errors or unsupported file type
 *       413:
 *         description: File too large (max 20MB)
 */
router.post(
  '/',
  [
    body('loan').isMongoId(),
    body('name').notEmpty(),
    body('type').optional().isIn(['pdf', 'png', 'jpg', 'jpeg']),
    body('size').optional().isInt({ min: 1 }),
    body('hash').notEmpty(),
    body('url').notEmpty(),
  ],
  documentController.upload
);

/**
 * @swagger
 * /documents/{id}/synced:
 *   post:
 *     summary: Mark document as synced to external system
 *     tags: [Documents]
 *     description: Update document status to 'synced' after successful sync to LOS/POS
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Document MongoDB ObjectId
 *         example: 507f191e810c19729de860eb
 *     responses:
 *       200:
 *         description: Document marked as synced
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Document'
 *       404:
 *         description: Document not found
 */
router.post('/:id/synced', documentController.markSynced);

module.exports = router;

