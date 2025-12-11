const express = require('express');
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const loanController = require('../controllers/loanController');
const preapprovalController = require('../controllers/preapprovalController');
const roles = require('../config/roles');

const router = express.Router();

router.use(authenticate);

router.get('/', loanController.list);

router.post(
  '/',
  [
    body('amount').isNumeric().withMessage('Amount required'),
    body('borrower').optional().isMongoId(),
    body('assignedOfficer').optional().isMongoId(),
    body('status').optional().isString(),
  ],
  authorize(roles.ADMIN, roles.LO_TPO, roles.LO_RETAIL, roles.BROKER, roles.BORROWER),
  loanController.create
);

router.get('/:id', loanController.getById);

router.patch('/:id/status', authorize(roles.ADMIN, roles.LO_TPO, roles.LO_RETAIL), loanController.updateStatus);

router.post(
  '/:id/preapproval',
  authorize(roles.ADMIN, roles.LO_TPO, roles.LO_RETAIL, roles.BRANCH_MANAGER),
  preapprovalController.generate
);

module.exports = router;

