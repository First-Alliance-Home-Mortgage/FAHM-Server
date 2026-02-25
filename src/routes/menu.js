
const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');
const { broadcastOnMenuSave } = require('../middleware/broadcastOnSave');

const { authenticate, authorize } = require('../middleware/auth');

// GET /menus/roles - admin only
router.get('/roles', authenticate, authorize({ roles: ['admin'] }), menuController.getMenuRoles);
// GET /menus/grouped - any authenticated user
router.get('/grouped', authenticate, menuController.getGroupedMenus);
// GET /menus/versions - admin only
router.get('/versions', authenticate, authorize({ roles: ['admin'] }), menuController.getMenuVersions);
// GET /menus - any authenticated user
router.get('/', authenticate, menuController.getMenus);
// GET /menus/alias/:alias - any authenticated user
router.get('/alias/:alias', authenticate, menuController.getMenuByAlias);
// GET /menus/:id - any authenticated user
router.get('/:id', authenticate, menuController.getMenuById);

// POST /menus/restore/:version - admin only
router.post('/restore/:version', authenticate, authorize({ roles: ['admin'] }), broadcastOnMenuSave, menuController.restoreMenuVersion);
// POST /menus/reset - admin only
router.post('/reset', authenticate, authorize({ roles: ['admin'] }), broadcastOnMenuSave, menuController.resetMenus);
// POST /menus - admin only
router.post('/', authenticate, authorize({ roles: ['admin'] }), menuController.validateMenu, broadcastOnMenuSave, menuController.createMenu);
// PUT /menus/:id - admin only
router.put('/:id', authenticate, authorize({ roles: ['admin'] }), menuController.validateMenu, broadcastOnMenuSave, menuController.updateMenu);
// PATCH /menus/:id/visibility - admin only
router.patch('/:id/visibility', authenticate, authorize({ roles: ['admin'] }), broadcastOnMenuSave, menuController.updateMenuVisibility);
// DELETE /menus/:id - admin only
router.delete('/:id', authenticate, authorize({ roles: ['admin'] }), broadcastOnMenuSave, menuController.deleteMenu);

module.exports = router;
