const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const personaViewController = require('../controllers/personaViewController');

const cmsScreens = require('../controllers/cmsScreensController');
const cmsNav = require('../controllers/cmsNavigationController');
const cmsFlags = require('../controllers/cmsFeatureFlagController');
const cmsRegistry = require('../controllers/cmsComponentRegistryController');

const router = express.Router();

// Alias CMS screens to existing persona view/dashboard endpoints
/**
 * @swagger
 * /cms/screens/dashboard:
 *   get:
 *     tags: [CMS Screens]
 *     security:
 *       - bearerAuth: []
 *     summary: Get dashboard screen data
 *     responses:
 *       200:
 *         description: Dashboard data
 */
router.get('/screens/dashboard', authenticate, personaViewController.getDashboardData);

// Screens
/**
 * @swagger
 * /cms/screens:
 *   get:
 *     tags: [CMS Screens]
 *     security:
 *       - bearerAuth: []
 *     summary: List all screens
 *     responses:
 *       200:
 *         description: List of screens
 */
router.get('/screens', authenticate, cmsScreens.list);
/**
 * @swagger
 * /cms/screens/{slug}:
 *   get:
 *     tags: [CMS Screens]
 *     security:
 *       - bearerAuth: []
 *     summary: Get a screen by slug
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Screen object
 *       404:
 *         description: Not found
 */
router.get('/screens/:slug', authenticate, cmsScreens.getOne);
router.post(
	'/screens',
	authenticate,
	authorize({ roles: ['admin'] }),
	cmsScreens.validateCreate,
	cmsScreens.create
);
router.patch(
	'/screens/:slug',
	authenticate,
	authorize({ roles: ['admin'] }),
	cmsScreens.validatePatch,
	cmsScreens.patch
);
router.post(
	'/screens/:slug/publish',
	authenticate,
	authorize({ roles: ['admin'] }),
	cmsScreens.publish
);

// Navigation Configs
/**
 * @swagger
 * /cms/navigation-configs:
 *   get:
 *     tags: [CMS Navigation]
 *     security:
 *       - bearerAuth: []
 *     summary: List all navigation configs
 *     responses:
 *       200:
 *         description: List of navigation configs
 */
router.get('/navigation-configs', authenticate, cmsNav.list);
router.put(
	'/navigation-configs',
	authenticate,
	authorize({ roles: ['admin'] }),
	cmsNav.validateUpsert,
	cmsNav.upsert
);

// Feature Flags
/**
 * @swagger
 * /cms/feature-flags:
 *   get:
 *     tags: [CMS Feature Flags]
 *     security:
 *       - bearerAuth: []
 *     summary: List all feature flags
 *     responses:
 *       200:
 *         description: List of feature flags
 */
router.get('/feature-flags', authenticate, cmsFlags.list);
router.put(
	'/feature-flags',
	authenticate,
	authorize({ roles: ['admin'] }),
	cmsFlags.validateUpsert,
	cmsFlags.upsert
);
router.patch(
	'/feature-flags/:key',
	authenticate,
	authorize({ roles: ['admin'] }),
	cmsFlags.validateToggle,
	cmsFlags.toggle
);

// Component Registry
/**
 * @swagger
 * /cms/component-registry:
 *   get:
 *     tags: [CMS Components]
 *     security:
 *       - bearerAuth: []
 *     summary: List registered components
 *     responses:
 *       200:
 *         description: List of components
 */
router.get('/component-registry', authenticate, cmsRegistry.list);

module.exports = router;
