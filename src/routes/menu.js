const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');
const { authenticate, authorize } = require('../middleware/auth');

// POST /menus/reset - admin only
router.post('/reset', authenticate, authorize({ roles: ['admin'] }), menuController.resetMenus);
// GET /menus/roles - admin only
router.get('/roles', authenticate, authorize({ roles: ['admin'] }), menuController.getMenuRoles);
// GET /menus - any authenticated user
router.get('/', authenticate, menuController.getMenus);

// GET /menus/grouped - any authenticated user
router.get('/grouped', authenticate, menuController.getGroupedMenus);

// GET /menus/versions - admin only
router.get('/versions', authenticate, authorize({ roles: ['admin'] }), menuController.getMenuVersions);

// POST /menus/restore/:version - admin only
router.post('/restore/:version', authenticate, authorize({ roles: ['admin'] }), menuController.restoreMenuVersion);

// PUT /menus - admin only
router.put(
  '/',
  authenticate,
  authorize({ roles: ['admin'] }),
  menuController.validateMenus,
  menuController.putMenus
);

module.exports = router;
