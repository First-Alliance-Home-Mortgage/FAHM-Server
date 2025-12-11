const express = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const notificationController = require('../controllers/notificationController');

const router = express.Router();

router.use(authenticate);

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: List all notifications for current user
 *     tags: [Notifications]
 *     description: Get all notifications for authenticated user, sorted by most recent first
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of notifications
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Notification'
 *       401:
 *         description: Unauthorized
 */
router.get('/', notificationController.list);

/**
 * @swagger
 * /notifications:
 *   post:
 *     summary: Create a new notification
 *     tags: [Notifications]
 *     description: Create notification with throttling and quiet hours enforcement (10 PM - 7 AM). Use forceSend to bypass restrictions.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 example: New Document Required
 *               body:
 *                 type: string
 *                 example: Please upload your recent pay stubs
 *               user:
 *                 type: string
 *                 format: objectId
 *                 description: Target user ID (defaults to current user)
 *               type:
 *                 type: string
 *                 enum: [info, status, rate_alert, message]
 *                 default: status
 *               forceSend:
 *                 type: boolean
 *                 description: Bypass quiet hours and throttle limits
 *                 default: false
 *               metadata:
 *                 type: object
 *                 description: Additional context data
 *                 example: { loanId: "507f191e810c19729de860ea" }
 *     responses:
 *       201:
 *         description: Notification created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Notification'
 *       400:
 *         description: Validation errors
 *       429:
 *         description: Quiet hours in effect or throttle limit reached
 */
router.post(
  '/',
  [
    body('title').notEmpty(),
    body('user').optional().isMongoId(),
    body('type').optional().isString(),
    body('forceSend').optional().isBoolean(),
  ],
  notificationController.create
);

/**
 * @swagger
 * /notifications/{id}/read:
 *   post:
 *     summary: Mark notification as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Notification MongoDB ObjectId
 *         example: 507f191e810c19729de860ec
 *     responses:
 *       200:
 *         description: Notification marked as read
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Notification'
 *       404:
 *         description: Notification not found or doesn't belong to user
 */
router.post('/:id/read', notificationController.markRead);

module.exports = router;

