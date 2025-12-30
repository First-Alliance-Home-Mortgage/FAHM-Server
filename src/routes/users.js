
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { upload, handleMulterError } = require('../middleware/uploadMiddleware');
const userController = require('../controllers/userController');

const profilePictureController = require('../controllers/profilePictureController');
const pushTokenController = require('../controllers/pushTokenController');


const router = express.Router();
/**
 * @swagger
 * /users/push-token:
 *   post:
 *     summary: Register or update Expo push token
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *               expoPushToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Push token registered
 *       400:
 *         description: Bad request
 *       404:
 *         description: User not found
 */
router.post(
	'/push-token',
	pushTokenController.validatePushToken,
	pushTokenController.registerPushToken
);

/**
 * @swagger
 * /users/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 */
router.get('/me', authenticate, userController.me);

/**
 * @swagger
 * /users/profile-picture:
 *   post:
 *     summary: Upload profile picture
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Profile picture uploaded successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.post(
	'/profile-picture',
	authenticate,
	upload.single('file'),
	handleMulterError,
	profilePictureController.uploadProfilePicture
);

module.exports = router;

