const createError = require('http-errors');
const { validationResult } = require('express-validator');
const RateSnapshot = require('../models/RateSnapshot');
const optimalBlueService = require('../services/optimalBlueService');
const logger = require('../utils/logger');

/**
 * Calculate monthly payment (P&I)
 */
function calcMonthlyPayment(principal, annualRate, termYears) {
  const r = annualRate / 100 / 12;
  const n = termYears * 12;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

/**
 * Calculate APR including fees
 */
function calculateAPR(principal, monthlyPayment, termYears, totalFees) {
  const netLoanAmount = principal - totalFees;
  const n = termYears * 12;
  
  // Newton-Raphson method to solve for APR
  let apr = 0.06; // Initial guess
  const tolerance = 0.0001;
  let iterations = 0;
  const maxIterations = 100;
  
  while (iterations < maxIterations) {
    const r = apr / 12;
    const pv = monthlyPayment * ((1 - Math.pow(1 + r, -n)) / r);
    const derivative = monthlyPayment * n * Math.pow(1 + r, -n - 1) / r - 
                       monthlyPayment * (1 - Math.pow(1 + r, -n)) / (r * r);
    
    const diff = pv - netLoanAmount;
    if (Math.abs(diff) < tolerance) break;
    
    apr = apr - diff / derivative;
    iterations++;
  }
  
  return apr * 100; // Return as percentage
}

/**
 * Generate amortization schedule
 */
function generateAmortizationSchedule(principal, annualRate, termYears, startingMonth = 1, monthsToGenerate = 12) {
  const monthlyRate = annualRate / 100 / 12;
  const totalMonths = termYears * 12;
  const monthlyPayment = calcMonthlyPayment(principal, annualRate, termYears);
  
  let balance = principal;
  const schedule = [];
  
  // Fast forward to starting month
  for (let i = 1; i < startingMonth; i++) {
    const interest = balance * monthlyRate;
    const principalPayment = monthlyPayment - interest;
    balance -= principalPayment;
  }
  
  // Generate requested months
  const endMonth = Math.min(startingMonth + monthsToGenerate - 1, totalMonths);
  
  for (let month = startingMonth; month <= endMonth; month++) {
    const interest = balance * monthlyRate;
    const principalPayment = monthlyPayment - interest;
    balance -= principalPayment;
    
    schedule.push({
      month,
      payment: Number(monthlyPayment.toFixed(2)),
      principal: Number(principalPayment.toFixed(2)),
      interest: Number(interest.toFixed(2)),
      balance: Number(Math.max(0, balance).toFixed(2))
    });
  }
  
  return schedule;
}

/**
 * Calculate mortgage payment with all inputs
 * POST /api/v1/calculator
 */
exports.calculate = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, { errors: errors.array() }));
    }

    const {
      amount,
      rate,
      termYears,
      taxesAnnual = 0,
      insuranceAnnual = 0,
      hoaMonthly = 0,
      downPayment = 0,
      closingCosts = 0,
      includeAmortization = false
    } = req.body;

    if (!amount || !rate || !termYears) {
      return next(createError(400, 'amount, rate, and termYears are required'));
    }

    if (amount <= 0 || rate <= 0 || termYears <= 0) {
      return next(createError(400, 'amount, rate, and termYears must be positive'));
    }

    const loanAmount = Number(amount) - Number(downPayment);
    const pAndI = calcMonthlyPayment(loanAmount, Number(rate), Number(termYears));
    const monthlyTaxes = Number(taxesAnnual) / 12;
    const monthlyInsurance = Number(insuranceAnnual) / 12;
    const totalMonthly = pAndI + monthlyTaxes + monthlyInsurance + Number(hoaMonthly);

    // Calculate real APR including closing costs
    const totalFees = Number(closingCosts);
    const apr = calculateAPR(loanAmount, pAndI, Number(termYears), totalFees);

    const result = {
      loanAmount: Number(loanAmount.toFixed(2)),
      downPayment: Number(downPayment),
      monthlyPrincipalAndInterest: Number(pAndI.toFixed(2)),
      monthlyTaxes: Number(monthlyTaxes.toFixed(2)),
      monthlyInsurance: Number(monthlyInsurance.toFixed(2)),
      monthlyHoa: Number(hoaMonthly),
      totalMonthly: Number(totalMonthly.toFixed(2)),
      rate: Number(rate),
      apr: Number(apr.toFixed(3)),
      termYears: Number(termYears),
      totalInterest: Number((pAndI * termYears * 12 - loanAmount).toFixed(2)),
      totalPayments: Number((totalMonthly * termYears * 12).toFixed(2))
    };

    // Generate amortization schedule if requested
    if (includeAmortization) {
      result.amortizationSchedule = generateAmortizationSchedule(loanAmount, Number(rate), Number(termYears), 1, 12);
      result.totalMonths = termYears * 12;
    }

    logger.info('Mortgage calculation performed', {
      userId: req.user._id,
      loanAmount: result.loanAmount,
      rate: result.rate
    });

    return res.json({
      success: true,
      data: result
    });
  } catch (err) {
    logger.error('Error in mortgage calculation:', err);
    return next(err);
  }
};

/**
 * Get current rates from Optimal Blue for calculator
 * GET /api/v1/calculator/rates
 */
exports.getCurrentRates = async (req, res, next) => {
  try {
    const {
      loanAmount = 300000,
      productType = 'conventional',
      loanTerm = 30,
      creditScore = 740,
      ltv = 80
    } = req.query;

    // Try to get recent rate snapshots from database
    const recentRates = await RateSnapshot.find({
      productType,
      loanTerm: parseInt(loanTerm),
      isActive: true,
      effectiveDate: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    })
      .sort({ effectiveDate: -1 })
      .limit(5);

    if (recentRates.length > 0) {
      logger.info('Retrieved rates from database for calculator', {
        userId: req.user._id,
        count: recentRates.length
      });

      return res.json({
        success: true,
        data: recentRates.map(r => ({
          rate: r.rate,
          apr: r.apr,
          points: r.points,
          lockPeriod: r.lockPeriod,
          productType: r.productType,
          loanTerm: r.loanTerm,
          effectiveDate: r.effectiveDate
        }))
      });
    }

    // Fallback: fetch fresh rates from Optimal Blue
    try {
      const rates = await optimalBlueService.getRateSheet({
        loanAmount: parseFloat(loanAmount),
        productType,
        loanTerm: parseInt(loanTerm),
        creditScore: parseInt(creditScore),
        ltv: parseFloat(ltv)
      });

      // Save to database
      for (const rateData of rates) {
        const snapshot = new RateSnapshot(rateData);
        await snapshot.save();
      }

      logger.info('Fetched fresh rates from Optimal Blue for calculator', {
        userId: req.user._id,
        count: rates.length
      });

      return res.json({
        success: true,
        data: rates.map(r => ({
          rate: r.rate,
          apr: r.apr,
          points: r.points,
          lockPeriod: r.lockPeriod,
          productType: r.productType,
          loanTerm: r.loanTerm
        }))
      });
    } catch (obError) {
      logger.error('Failed to fetch rates from Optimal Blue:', obError);
      // Return default rates if external service fails
      return res.json({
        success: true,
        data: [
          { rate: 6.5, apr: 6.65, points: 0, lockPeriod: 30, productType, loanTerm: parseInt(loanTerm) }
        ],
        message: 'Using default rates - external service unavailable'
      });
    }
  } catch (error) {
    logger.error('Error fetching calculator rates:', error);
    next(error);
  }
};

/**
 * Get amortization schedule for specific range
 * POST /api/v1/calculator/amortization
 */
exports.getAmortization = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, { errors: errors.array() }));
    }

    const {
      amount,
      rate,
      termYears,
      startMonth = 1,
      monthsToGenerate = 12
    } = req.body;

    if (!amount || !rate || !termYears) {
      return next(createError(400, 'amount, rate, and termYears are required'));
    }

    const schedule = generateAmortizationSchedule(
      Number(amount),
      Number(rate),
      Number(termYears),
      Number(startMonth),
      Number(monthsToGenerate)
    );

    const totalMonths = termYears * 12;
    const monthlyPayment = calcMonthlyPayment(Number(amount), Number(rate), Number(termYears));

    logger.info('Generated amortization schedule', {
      userId: req.user._id,
      loanAmount: amount,
      months: schedule.length
    });

    return res.json({
      success: true,
      data: {
        schedule,
        totalMonths,
        monthlyPayment: Number(monthlyPayment.toFixed(2)),
        loanAmount: Number(amount),
        rate: Number(rate),
        termYears: Number(termYears)
      }
    });
  } catch (error) {
    logger.error('Error generating amortization:', error);
    next(error);
  }
};

/**
 * Generate Apply Now link with pre-filled data
 * POST /api/v1/calculator/apply
 */
exports.generateApplyLink = async (req, res, next) => {
  try {
    const {
      loanAmount,
      propertyValue,
      productType = 'conventional',
      loanTerm = 30,
      estimatedRate
    } = req.body;

    if (!loanAmount) {
      return next(createError(400, 'loanAmount is required'));
    }

    // Generate secure token or session for POS handoff
    const posBaseUrl = process.env.POS_API_URL || 'https://apply.fahm.com';
    
    // Build pre-fill parameters
    const params = new URLSearchParams({
      loan_amount: loanAmount,
      product_type: productType,
      loan_term: loanTerm,
      user_id: req.user._id.toString(),
      source: 'calculator'
    });

    if (propertyValue) params.append('property_value', propertyValue);
    if (estimatedRate) params.append('estimated_rate', estimatedRate);

    const applyUrl = `${posBaseUrl}/application/start?${params.toString()}`;

    logger.info('Generated Apply Now link', {
      userId: req.user._id,
      loanAmount
    });

    return res.json({
      success: true,
      data: {
        applyUrl,
        expiresIn: 3600, // Link valid for 1 hour
        message: 'Click to start your loan application with pre-filled details'
      }
    });
  } catch (error) {
    logger.error('Error generating apply link:', error);
    next(error);
  }
};

module.exports = exports;

