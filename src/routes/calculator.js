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
 *     summary: Calculate monthly mortgage payment with APR and optional amortization
 *     tags: [Calculator]
 *     description: Calculate principal & interest, taxes, insurance, HOA, and total monthly payment with true APR including closing costs. Optionally include first 12 months amortization schedule.
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
 *                 description: Total purchase price or loan amount
 *                 example: 400000
 *                 minimum: 0
 *               downPayment:
 *                 type: number
 *                 description: Down payment amount
 *                 example: 80000
 *                 default: 0
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
 *                 example: 4800
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
 *               closingCosts:
 *                 type: number
 *                 description: Total closing costs for APR calculation
 *                 example: 8000
 *                 default: 0
 *               includeAmortization:
 *                 type: boolean
 *                 description: Include first 12 months amortization schedule
 *                 example: false
 *                 default: false
 *     responses:
 *       200:
 *         description: Payment calculation successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     loanAmount:
 *                       type: number
 *                       description: Net loan amount after down payment
 *                       example: 320000
 *                     downPayment:
 *                       type: number
 *                       example: 80000
 *                     monthlyPrincipalAndInterest:
 *                       type: number
 *                       description: Monthly P&I payment
 *                       example: 2024.89
 *                     monthlyTaxes:
 *                       type: number
 *                       description: Monthly property tax portion
 *                       example: 400
 *                     monthlyInsurance:
 *                       type: number
 *                       description: Monthly insurance portion
 *                       example: 100
 *                     monthlyHoa:
 *                       type: number
 *                       description: Monthly HOA fees
 *                       example: 150
 *                     totalMonthly:
 *                       type: number
 *                       description: Total monthly payment (PITI + HOA)
 *                       example: 2674.89
 *                     rate:
 *                       type: number
 *                       description: Nominal interest rate
 *                       example: 6.5
 *                     apr:
 *                       type: number
 *                       description: True APR including closing costs
 *                       example: 6.734
 *                     termYears:
 *                       type: number
 *                       example: 30
 *                     totalInterest:
 *                       type: number
 *                       description: Total interest paid over life of loan
 *                       example: 408960.40
 *                     totalPayments:
 *                       type: number
 *                       description: Total of all payments over life of loan
 *                       example: 962960.40
 *                     amortizationSchedule:
 *                       type: array
 *                       description: First 12 months schedule (if includeAmortization=true)
 *                       items:
 *                         type: object
 *                         properties:
 *                           month:
 *                             type: number
 *                           payment:
 *                             type: number
 *                           principal:
 *                             type: number
 *                           interest:
 *                             type: number
 *                           balance:
 *                             type: number
 *                     totalMonths:
 *                       type: number
 *                       example: 360
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
    body('downPayment').optional().isNumeric(),
    body('taxesAnnual').optional().isNumeric(),
    body('insuranceAnnual').optional().isNumeric(),
    body('hoaMonthly').optional().isNumeric(),
    body('closingCosts').optional().isNumeric(),
    body('includeAmortization').optional().isBoolean(),
  ],
  calculatorController.calculate
);

/**
 * @swagger
 * /calculator/rates:
 *   get:
 *     summary: Get current mortgage rates from Optimal Blue
 *     tags: [Calculator]
 *     description: Fetch real-time mortgage rates from Optimal Blue for calculator pre-fill. Falls back to database snapshots if external service unavailable.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: loanAmount
 *         schema:
 *           type: number
 *         description: Loan amount for pricing
 *         example: 300000
 *       - in: query
 *         name: productType
 *         schema:
 *           type: string
 *           enum: [conventional, fha, va, usda, jumbo]
 *         description: Loan product type
 *         example: conventional
 *       - in: query
 *         name: loanTerm
 *         schema:
 *           type: number
 *         description: Loan term in years
 *         example: 30
 *       - in: query
 *         name: creditScore
 *         schema:
 *           type: number
 *         description: Borrower credit score
 *         example: 740
 *       - in: query
 *         name: ltv
 *         schema:
 *           type: number
 *         description: Loan-to-value ratio (percent)
 *         example: 80
 *     responses:
 *       200:
 *         description: Current rates retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       rate:
 *                         type: number
 *                         example: 6.5
 *                       apr:
 *                         type: number
 *                         example: 6.65
 *                       points:
 *                         type: number
 *                         example: 0
 *                       lockPeriod:
 *                         type: number
 *                         description: Lock period in days
 *                         example: 30
 *                       productType:
 *                         type: string
 *                         example: conventional
 *                       loanTerm:
 *                         type: number
 *                         example: 30
 *                       effectiveDate:
 *                         type: string
 *                         format: date-time
 *                 message:
 *                   type: string
 *                   description: Optional message if using fallback rates
 *       401:
 *         description: Unauthorized
 */
router.get('/rates', calculatorController.getCurrentRates);

/**
 * @swagger
 * /calculator/amortization:
 *   post:
 *     summary: Generate detailed amortization schedule for any month range
 *     tags: [Calculator]
 *     description: Generate month-by-month breakdown of principal, interest, and remaining balance for specified loan parameters. Supports generating any range of months.
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
 *                 description: Loan amount (net after down payment)
 *                 example: 320000
 *               rate:
 *                 type: number
 *                 description: Annual interest rate (percentage)
 *                 example: 6.5
 *               termYears:
 *                 type: number
 *                 description: Loan term in years
 *                 example: 30
 *               startMonth:
 *                 type: number
 *                 description: Starting month number (1-360)
 *                 example: 1
 *                 default: 1
 *               monthsToGenerate:
 *                 type: number
 *                 description: Number of months to include in schedule
 *                 example: 12
 *                 default: 12
 *     responses:
 *       200:
 *         description: Amortization schedule generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     schedule:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           month:
 *                             type: number
 *                             description: Payment number
 *                             example: 1
 *                           payment:
 *                             type: number
 *                             description: Total payment amount
 *                             example: 2024.89
 *                           principal:
 *                             type: number
 *                             description: Principal portion
 *                             example: 291.56
 *                           interest:
 *                             type: number
 *                             description: Interest portion
 *                             example: 1733.33
 *                           balance:
 *                             type: number
 *                             description: Remaining loan balance
 *                             example: 319708.44
 *                     totalMonths:
 *                       type: number
 *                       description: Total number of payments
 *                       example: 360
 *                     monthlyPayment:
 *                       type: number
 *                       example: 2024.89
 *                     loanAmount:
 *                       type: number
 *                       example: 320000
 *                     rate:
 *                       type: number
 *                       example: 6.5
 *                     termYears:
 *                       type: number
 *                       example: 30
 *       400:
 *         description: Validation errors or invalid parameters
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/amortization',
  [
    body('amount').isNumeric(),
    body('rate').isNumeric(),
    body('termYears').isNumeric(),
    body('startMonth').optional().isNumeric(),
    body('monthsToGenerate').optional().isNumeric(),
  ],
  calculatorController.getAmortization
);

/**
 * @swagger
 * /calculator/apply:
 *   post:
 *     summary: Generate "Apply Now" link with pre-filled calculator data for POS handoff
 *     tags: [Calculator]
 *     description: Create secure URL to start loan application with pre-populated data from calculator. Link expires in 1 hour for security.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - loanAmount
 *             properties:
 *               loanAmount:
 *                 type: number
 *                 description: Loan amount to pre-fill
 *                 example: 320000
 *               propertyValue:
 *                 type: number
 *                 description: Property value/purchase price
 *                 example: 400000
 *               productType:
 *                 type: string
 *                 enum: [conventional, fha, va, usda, jumbo]
 *                 description: Loan product type
 *                 example: conventional
 *                 default: conventional
 *               loanTerm:
 *                 type: number
 *                 description: Loan term in years
 *                 example: 30
 *                 default: 30
 *               estimatedRate:
 *                 type: number
 *                 description: Estimated interest rate from calculator
 *                 example: 6.5
 *     responses:
 *       200:
 *         description: Apply link generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     applyUrl:
 *                       type: string
 *                       description: URL to start loan application with pre-filled data
 *                       example: https://apply.fahm.com/application/start?loan_amount=320000&product_type=conventional&loan_term=30&user_id=507f1f77bcf86cd799439011&source=calculator
 *                     expiresIn:
 *                       type: number
 *                       description: Link validity in seconds
 *                       example: 3600
 *                     message:
 *                       type: string
 *                       example: Click to start your loan application with pre-filled details
 *       400:
 *         description: Validation errors or invalid parameters
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/apply',
  [
    body('loanAmount').isNumeric(),
    body('propertyValue').optional().isNumeric(),
    body('estimatedRate').optional().isNumeric(),
  ],
  calculatorController.generateApplyLink
);

module.exports = router;

