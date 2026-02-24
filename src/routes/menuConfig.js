const express = require('express');
const router = express.Router();
const menuConfigController = require('../controllers/menuConfigController');
const { broadcastOnMenuSave } = require('../middleware/broadcastOnSave');
const { authenticate, authorize } = require('../middleware/auth');

// Get /menu configuration
router.get('/', authenticate, menuConfigController.getMenuConfig);
// PUT /menu-config - admin only
router.put(
  '/',
  authenticate,
  authorize({ roles: ['admin'] }),
  menuConfigController.validateMenuConfigObject,
  broadcastOnMenuSave,
  menuConfigController.putMenus
);

module.exports = router;
