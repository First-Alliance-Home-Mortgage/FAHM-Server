const express = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const documentController = require('../controllers/documentController');

const router = express.Router({ mergeParams: true });

router.use(authenticate);

router.get('/:loanId', documentController.listForLoan);

router.post(
  '/',
  [
    body('loan').isMongoId(),
    body('name').notEmpty(),
    body('type').optional().isIn(['pdf', 'png', 'jpg', 'jpeg']),
    body('size').optional().isInt({ min: 1 }),
    body('hash').notEmpty(),
    body('url').notEmpty(),
  ],
  documentController.upload
);

router.post('/:id/synced', documentController.markSynced);

module.exports = router;

