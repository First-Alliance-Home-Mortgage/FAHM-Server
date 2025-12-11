const express = require('express');
const { authenticate } = require('../middleware/auth');
const posController = require('../controllers/posController');

const router = express.Router();

router.use(authenticate);

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
router.post('/handoff', posController.createHandoff);

module.exports = router;

