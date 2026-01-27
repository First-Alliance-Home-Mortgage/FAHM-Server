const express = require('express');
const router = express.Router();
const menuConfigController = require('../controllers/menuConfigController');
const menuController = require('../controllers/menuController');
const { authenticate, authorize } = require('../middleware/auth');

// Get /menu configuration
router.get('/', authenticate, menuConfigController.getMenuConfig);
// PUT /menus - admin only
router.put(
  '/',
  authenticate,
  authorize({ roles: ['admin'] }),
  menuController.validateMenus,
  menuConfigController.putMenus
);

module.exports = router;