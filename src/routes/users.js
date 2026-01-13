
const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
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
 * /users/me:
 *   patch:
 *     summary: Update current user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               phone: { type: string }
 *               title: { type: string }
 *               photo: { type: string }
 *               branch: { type: object }
 *     responses:
 *       200:
 *         description: Profile updated
 */
router.patch('/me', authenticate, userController.validateUpdateProfile, userController.updateProfile);

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

/**
 * @swagger
 * /users:
 *   get:
 *     summary: List users (admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users
 */
/**
 * @swagger
 * /users:
 *   get:
 *     summary: List users (admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *         description: Filter by role
 *       - in: query
 *         name: active
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search by name or email
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number (default 1)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Page size (default 20, max 100)
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *         description: Sort field (prefix with - for desc)
 *     responses:
 *       200:
 *         description: List of users
 */
router.get('/', authenticate, authorize({ roles: ['admin'] }), userController.validateListUsers, userController.listUsers);

/**
 * @swagger
 * /users:
 *   post:
 *     summary: Create user (admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Created
 */
router.post('/', authenticate, authorize({ roles: ['admin'] }), userController.validateCreateUser, userController.createUser);

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get user by id (admin only)
 *     tags: [Users]
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
 *         description: User
 */
router.get('/:id', authenticate, authorize({ roles: ['admin'] }), userController.validateUserId, userController.getUserById);

/**
 * @swagger
 * /users/{id}:
 *   patch:
 *     summary: Update user (admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Updated
 */
router.patch('/:id', authenticate, authorize({ roles: ['admin'] }), userController.validateUpdateUser, userController.updateUser);

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Delete user (admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Deleted
 */
router.delete('/:id', authenticate, authorize({ roles: ['admin'] }), userController.validateUserId, userController.deleteUser);

module.exports = router;

