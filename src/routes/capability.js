const express = require('express');
const router = express.Router();
const capabilityController = require('../controllers/capabilityController');
const { authenticate, authorize } = require('../middleware/auth');
const { body, param } = require('express-validator');

// Validation middleware
const validateCapability = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Name must be between 3 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  body('category')
    .optional()
    .isIn(['loan', 'document', 'rates', 'alerts', 'messages', 'dashboard', 'webhooks', 'users', 'audit', 'other'])
    .withMessage('Invalid category')
];

const validateId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid capability ID')
];

// GET /capabilities - list all capabilities (admin only)
router.get(
  '/',
  authenticate,
  authorize({ roles: ['admin'] }),
  capabilityController.getCapabilities
);

// GET /capabilities/:id - get a single capability (admin only)
router.get(
  '/:id',
  authenticate,
  authorize({ roles: ['admin'] }),
  validateId,
  capabilityController.getCapability
);

// POST /capabilities - create a new capability (admin only)
router.post(
  '/',
  authenticate,
  authorize({ roles: ['admin'] }),
  validateCapability,
  capabilityController.createCapability
);

// PUT /capabilities/:id - update a capability (admin only)
router.put(
  '/:id',
  authenticate,
  authorize({ roles: ['admin'] }),
  validateId,
  validateCapability,
  capabilityController.updateCapability
);

// DELETE /capabilities/:id - delete a capability (admin only)
router.delete(
  '/:id',
  authenticate,
  authorize({ roles: ['admin'] }),
  validateId,
  capabilityController.deleteCapability
);

module.exports = router;
