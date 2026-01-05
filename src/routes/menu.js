const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');
const { authenticate, authorize } = require('../middleware/auth');

// GET /menus - any authenticated user
router.get('/', authenticate, menuController.getMenus);

// PUT /menus - admin only
router.put(
  '/',
  authenticate,
  authorize({ roles: ['admin'] }),
  menuController.validateMenus,
  menuController.putMenus
);

module.exports = router;
