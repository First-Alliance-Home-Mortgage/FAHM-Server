const express = require('express');
const { body } = require('express-validator');
const roles = require('../config/roles');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { rateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Rate limiters for auth endpoints
const authLimiter = rateLimiter({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many authentication attempts, please try again later' });
const refreshLimiter = rateLimiter({ windowMs: 15 * 60 * 1000, max: 30, message: 'Too many refresh attempts, please try again later' });

const passwordValidator = body('password')
  .isLength({ min: 12 }).withMessage('Password must be at least 12 characters')
  .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
  .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
  .matches(/\d/).withMessage('Password must contain at least one number')
  .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Password must contain at least one special character');

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *                 example: Jane Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: jane@example.com
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: secret123
 *               role:
 *                 type: string
 *                 enum: [borrower, loan_officer_tpo, loan_officer_retail, broker, branch_manager, realtor, admin]
 *                 default: borrower
 *               phone:
 *                 type: string
 *                 example: '5551234567'
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 refreshToken:
 *                   type: string
 *                   example: 6c2d2f26e6e84c1bb0fdfee0e3f4d9b3f1d5c8fa2d1b242e30
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: 507f1f77bcf86cd799439011
 *                     name:
 *                       type: string
 *                       example: Jane Doe
 *                     email:
 *                       type: string
 *                       example: jane@example.com
 *                     role:
 *                       type: string
 *                       example: borrower
 *                     phone:
 *                       type: string
 *                       example: '5551234567'
 *       400:
 *         description: Validation errors
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Email already registered
 */
router.post(
  '/register',
  authLimiter,
  [
    body('name').notEmpty().withMessage('Name required'),
    body('email').isEmail().withMessage('Valid email required'),
    passwordValidator,
    // Self-registration is restricted to borrower role only.
    // Admin-created users can have any role via the /users endpoint.
    body('role')
      .optional()
      .toLowerCase()
      .custom((value) => {
        if (value && value !== 'borrower') {
          throw new Error('Self-registration is restricted to the borrower role');
        }
        return true;
      }),
  ],
  authController.register
);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Authenticate user and receive JWT token
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: jane@example.com
 *               password:
 *                 type: string
 *                 example: secret123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 refreshToken:
 *                   type: string
 *                   example: 6c2d2f26e6e84c1bb0fdfee0e3f4d9b3f1d5c8fa2d1b242e30
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: 507f1f77bcf86cd799439011
 *                     name:
 *                       type: string
 *                       example: Jane Doe
 *                     email:
 *                       type: string
 *                       example: jane@example.com
 *                     role:
 *                       type: string
 *                       example: borrower
 *       401:
 *         description: Invalid credentials
 */
router.post(
  '/login',
  authLimiter,
  [body('email').isEmail(), passwordValidator],
  authController.login
);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Exchange refresh token for a new access token
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: New access token issued
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *       401:
 *         description: Invalid refresh token
 */
router.post(
  '/refresh',
  refreshLimiter,
  [body('refreshToken').isString().withMessage('Refresh token required')],
  authController.refresh
);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout current user session
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Specific refresh token to revoke
 *     responses:
 *       204:
 *         description: Logged out successfully
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/logout',
  authenticate,
  [body('refreshToken').optional().isString()],
  authController.logout
);

module.exports = router;

