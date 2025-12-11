const express = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const personaViewController = require('../controllers/personaViewController');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Persona Views
 *   description: Custom views and dashboards by persona
 */

/**
 * @swagger
 * /api/v1/persona-views/me:
 *   get:
 *     summary: Get user's persona view configuration
 *     tags: [Persona Views]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Persona view configuration
 */
router.get(
  '/me',
  authenticate,
  personaViewController.getMyView
);

/**
 * @swagger
 * /api/v1/persona-views/me:
 *   patch:
 *     summary: Update user's persona view configuration
 *     tags: [Persona Views]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               viewConfiguration:
 *                 type: object
 *                 properties:
 *                   dashboard:
 *                     type: object
 *                   navigation:
 *                     type: object
 *                   notifications:
 *                     type: object
 *                   dataVisibility:
 *                     type: object
 *                   preferences:
 *                     type: object
 *                   branding:
 *                     type: object
 *     responses:
 *       200:
 *         description: View configuration updated
 */
router.patch(
  '/me',
  authenticate,
  [body('viewConfiguration').isObject().withMessage('View configuration must be an object')],
  personaViewController.updateMyView
);

/**
 * @swagger
 * /api/v1/persona-views/me/reset:
 *   post:
 *     summary: Reset persona view to default
 *     tags: [Persona Views]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: View configuration reset to default
 */
router.post(
  '/me/reset',
  authenticate,
  personaViewController.resetToDefault
);

/**
 * @swagger
 * /api/v1/persona-views/dashboard:
 *   get:
 *     summary: Get dashboard data with persona-specific filtering
 *     tags: [Persona Views]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data filtered by persona
 */
router.get(
  '/dashboard',
  authenticate,
  personaViewController.getDashboardData
);

module.exports = router;
