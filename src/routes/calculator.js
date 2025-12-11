const express = require('express');
const { body } = require('express-validator');
const calculatorController = require('../controllers/calculatorController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.post(
  '/',
  [
    body('amount').isNumeric(),
    body('rate').isNumeric(),
    body('termYears').isNumeric(),
    body('taxesAnnual').optional().isNumeric(),
    body('insuranceAnnual').optional().isNumeric(),
    body('hoaMonthly').optional().isNumeric(),
  ],
  calculatorController.calculate
);

module.exports = router;

