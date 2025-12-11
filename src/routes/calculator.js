const express = require('express');
const { body } = require('express-validator');
const calculatorController = require('../controllers/calculatorController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

/**
 * @swagger
 * /calculator:
 *   post:
 *     summary: Calculate monthly mortgage payment
 *     tags: [Calculator]
 *     description: Calculate principal & interest, taxes, insurance, HOA, and total monthly payment with APR estimation
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - rate
 *               - termYears
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Loan principal amount
 *                 example: 250000
 *                 minimum: 0
 *               rate:
 *                 type: number
 *                 description: Annual interest rate (percentage)
 *                 example: 6.5
 *                 minimum: 0
 *               termYears:
 *                 type: number
 *                 description: Loan term in years
 *                 example: 30
 *                 minimum: 0
 *               taxesAnnual:
 *                 type: number
 *                 description: Annual property taxes
 *                 example: 3600
 *                 default: 0
 *               insuranceAnnual:
 *                 type: number
 *                 description: Annual homeowners insurance
 *                 example: 1200
 *                 default: 0
 *               hoaMonthly:
 *                 type: number
 *                 description: Monthly HOA fees
 *                 example: 150
 *                 default: 0
 *     responses:
 *       200:
 *         description: Payment calculation successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 monthlyPrincipalAndInterest:
 *                   type: number
 *                   description: Monthly P&I payment
 *                   example: 1580.17
 *                 monthlyTaxes:
 *                   type: number
 *                   description: Monthly property tax portion
 *                   example: 300
 *                 monthlyInsurance:
 *                   type: number
 *                   description: Monthly insurance portion
 *                   example: 100
 *                 monthlyHoa:
 *                   type: number
 *                   description: Monthly HOA fees
 *                   example: 150
 *                 totalMonthly:
 *                   type: number
 *                   description: Total monthly payment (PITI + HOA)
 *                   example: 2130.17
 *                 apr:
 *                   type: number
 *                   description: Estimated APR (placeholder - nominal rate)
 *                   example: 6.5
 *       400:
 *         description: Validation errors or invalid parameters
 *       401:
 *         description: Unauthorized
 */
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

