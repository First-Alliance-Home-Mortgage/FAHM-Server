const express = require('express');
const { body } = require('express-validator');
const businessCardController = require('../controllers/businessCardController');
const { authenticate, authorize } = require('../middleware/auth');
const roles = require('../config/roles');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Business Cards
 *   description: Digital business card management with QR codes and co-branding
 */

/**
 * @swagger
 * /business-cards:
 *   post:
 *     summary: Create or update business card for authenticated user
 *     tags: [Business Cards]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nmls:
 *                 type: string
 *                 description: NMLS number (auto-populated from user profile)
 *                 example: "123456"
 *               title:
 *                 type: string
 *                 description: Job title
 *                 example: "Senior Loan Officer"
 *               photo:
 *                 type: string
 *                 description: Photo URL
 *                 example: "https://storage.fahm.com/photos/user123.jpg"
 *               bio:
 *                 type: string
 *                 description: Short biography (max 500 chars)
 *                 example: "Helping families achieve homeownership for over 10 years"
 *               phone:
 *                 type: string
 *                 example: "555-123-4567"
 *               email:
 *                 type: string
 *                 example: "john.doe@fahm.com"
 *               branch:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   address:
 *                     type: string
 *                   city:
 *                     type: string
 *                   state:
 *                     type: string
 *                   zip:
 *                     type: string
 *                   phone:
 *                     type: string
 *               socialLinks:
 *                 type: object
 *                 properties:
 *                   linkedin:
 *                     type: string
 *                   facebook:
 *                     type: string
 *                   twitter:
 *                     type: string
 *                   instagram:
 *                     type: string
 *               branding:
 *                 type: object
 *                 properties:
 *                   primaryColor:
 *                     type: string
 *                     example: "#003B5C"
 *                   secondaryColor:
 *                     type: string
 *                     example: "#FF6B35"
 *                   logo:
 *                     type: string
 *                   partnerLogo:
 *                     type: string
 *                     description: Co-branding partner logo URL
 *                   partnerName:
 *                     type: string
 *                     description: Co-branding partner name
 *               isActive:
 *                 type: boolean
 *                 default: true
 *               isPublic:
 *                 type: boolean
 *                 default: true
 *               customDomain:
 *                 type: string
 *                 description: Custom domain for the card (optional)
 *     responses:
 *       200:
 *         description: Business card created/updated successfully
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
 *                     card:
 *                       type: object
 *                     url:
 *                       type: string
 *                       description: Public URL for the business card
 *                     qrCodeUrl:
 *                       type: string
 *                       description: Data URL of QR code image
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/',
  authenticate,
  [
    body('nmls').optional().isString(),
    body('title').optional().isString(),
    body('phone').optional().isString(),
    body('email').optional().isEmail(),
    body('bio').optional().isString().isLength({ max: 500 }),
    body('isActive').optional().isBoolean(),
    body('isPublic').optional().isBoolean()
  ],
  businessCardController.createOrUpdate
);

/**
 * @swagger
 * /business-cards:
 *   get:
 *     summary: List all business cards (Admin/BM only)
 *     tags: [Business Cards]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name, email, or NMLS
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: List of business cards
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/',
  authenticate,
  authorize(roles.ADMIN, roles.BRANCH_MANAGER),
  businessCardController.list
);

/**
 * @swagger
 * /business-cards/me:
 *   get:
 *     summary: Get current user's business card
 *     tags: [Business Cards]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User's business card
 *       404:
 *         description: Business card not found
 */
router.get('/me', authenticate, businessCardController.getMyCard);

/**
 * @swagger
 * /business-cards/me:
 *   delete:
 *     summary: Delete current user's business card
 *     tags: [Business Cards]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Business card deleted
 *       404:
 *         description: Business card not found
 */
router.delete('/me', authenticate, businessCardController.deleteCard);

/**
 * @swagger
 * /business-cards/me/analytics:
 *   get:
 *     summary: Get analytics for user's business card
 *     tags: [Business Cards]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Analytics data (views, applies, shares, conversion rate)
 *       404:
 *         description: Business card not found
 */
router.get('/me/analytics', authenticate, businessCardController.getAnalytics);

/**
 * @swagger
 * /business-cards/me/regenerate-qr:
 *   post:
 *     summary: Regenerate QR code for user's business card
 *     tags: [Business Cards]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: QR code regenerated
 *       404:
 *         description: Business card not found
 */
router.post('/me/regenerate-qr', authenticate, businessCardController.regenerateQR);

/**
 * @swagger
 * /business-cards/slug/{slug}:
 *   get:
 *     summary: Get business card by slug (public or authenticated)
 *     tags: [Business Cards]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Business card slug
 *     responses:
 *       200:
 *         description: Business card details
 *       404:
 *         description: Business card not found
 *       403:
 *         description: Card is private
 */
router.get('/slug/:slug', businessCardController.getBySlug);

/**
 * @swagger
 * /business-cards/slug/{slug}/apply:
 *   post:
 *     summary: Track Apply Now click and get POS URL
 *     tags: [Business Cards]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Apply URL returned and click tracked
 *       404:
 *         description: Business card not found
 */
router.post('/slug/:slug/apply', businessCardController.trackApply);

/**
 * @swagger
 * /business-cards/slug/{slug}/share:
 *   post:
 *     summary: Track share action
 *     tags: [Business Cards]
 *     parameters:
 *       - in: path
 *         name: slug
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
 *               method:
 *                 type: string
 *                 enum: [email, sms, social, qr]
 *                 description: Share method
 *     responses:
 *       200:
 *         description: Share tracked
 *       404:
 *         description: Business card not found
 */
router.post(
  '/slug/:slug/share',
  [body('method').optional().isIn(['email', 'sms', 'social', 'qr'])],
  businessCardController.trackShare
);

module.exports = router;
