const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');
const { authenticate, authorize } = require('../middleware/auth');

// GET /roles - list all roles (admin only)
router.get('/', authenticate, authorize({ roles: ['admin'] }), roleController.getRoles);

// POST /roles - create a new role (admin only)
router.post('/', authenticate, authorize({ roles: ['admin'] }), roleController.createRole);

// PUT /roles/:id - update a role (admin only)
router.put('/:id', authenticate, authorize({ roles: ['admin'] }), roleController.updateRole);

// DELETE /roles/:id - delete a role (admin only)
router.delete('/:id', authenticate, authorize({ roles: ['admin'] }), roleController.deleteRole);

module.exports = router;
