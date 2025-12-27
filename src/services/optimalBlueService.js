const axios = require('axios');
const logger = require('../utils/logger');

const OPTIMAL_BLUE_API_URL = process.env.OPTIMAL_BLUE_API_URL || 'https://api.optimalblue.com';
const OPTIMAL_BLUE_CLIENT_ID = process.env.OPTIMAL_BLUE_CLIENT_ID;
const OPTIMAL_BLUE_CLIENT_SECRET = process.env.OPTIMAL_BLUE_CLIENT_SECRET;

let cachedToken = null;
let tokenExpiresAt = null;
const rateSheetCache = new Map();
const defaultRateTtlMs = 5 * 60 * 1000; // 5 minutes

/**
 * Get OAuth 2.0 access token with caching
 */
async function getAccessToken() {
  // Return cached token if valid for at least 5 more minutes
  if (cachedToken && tokenExpiresAt && Date.now() < tokenExpiresAt - 5 * 60 * 1000) {
    return cachedToken;
  }

  try {
    const response = await axios.post(`${OPTIMAL_BLUE_API_URL}/oauth/token`, {
      grant_type: 'client_credentials',
      client_id: OPTIMAL_BLUE_CLIENT_ID,
      client_secret: OPTIMAL_BLUE_CLIENT_SECRET
    });

    cachedToken = response.data.access_token;
    const expiresIn = response.data.expires_in || 3600;
    tokenExpiresAt = Date.now() + expiresIn * 1000;

    logger.info('Optimal Blue access token obtained');
    return cachedToken;
  } catch (error) {
    logger.error('Failed to obtain Optimal Blue access token:', error.response?.data || error.message);
    throw new Error('Optimal Blue authentication failed');
  }
}

/**
 * Make authenticated API request to Optimal Blue
 */
async function makeRequest(method, endpoint, data = null) {
  const token = await getAccessToken();
  const config = {
    method,
    url: `${OPTIMAL_BLUE_API_URL}${endpoint}`,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };

  if (data) {
    config.data = data;
  }

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    logger.error(`Optimal Blue API error (${method} ${endpoint}):`, error.response?.data || error.message);
    throw error;
  }
}

/**
 * Get daily rate sheet from Optimal Blue
 */
async function getRateSheet(loanScenario = {}) {
  const {
    loanAmount = 300000,
    productType = 'conventional',
    loanTerm = 30,
    loanPurpose = 'purchase',
    propertyType = 'single_family',
    occupancy = 'primary',
    ltv = 80,
    creditScore = 740
  } = loanScenario;

  logger.info('Fetching Optimal Blue rate sheet', { loanScenario });

  const data = await makeRequest('POST', '/v1/rates/search', {
    loanAmount,
    productType,
    loanTerm,
    loanPurpose,
    property: {
      type: propertyType,
      occupancy
    },
    borrower: {
      creditScore
    },
    ltv
  });

  return transformRateSheet(data);
}

function scenarioCacheKey(loanScenario = {}) {
  // Keep key deterministic to maximize cache hits
  const ordered = {
    loanAmount: loanScenario.loanAmount,
    productType: loanScenario.productType,
    loanTerm: loanScenario.loanTerm,
    loanPurpose: loanScenario.loanPurpose,
    propertyType: loanScenario.propertyType,
    occupancy: loanScenario.occupancy,
    ltv: loanScenario.ltv,
    creditScore: loanScenario.creditScore,
  };
  return JSON.stringify(ordered);
}

async function getRateSheetCached(loanScenario = {}, ttlMs = defaultRateTtlMs) {
  const key = scenarioCacheKey(loanScenario);
  const now = Date.now();
  const cached = rateSheetCache.get(key);

  if (cached && cached.expiresAt > now) {
    logger.debug('Returning cached Optimal Blue rate sheet', { loanScenario });
    return cached.data;
  }

  const data = await getRateSheet(loanScenario);
  rateSheetCache.set(key, { data, expiresAt: now + ttlMs });
  return data;
}

/**
 * Transform Optimal Blue rate sheet to FAHM RateSnapshot format
 */
function transformRateSheet(obData) {
  if (!obData || !obData.rates) {
    return [];
  }

  return obData.rates.map(rate => ({
    optimalBlueRateId: rate.rateId,
    productType: mapProductType(rate.productType),
    loanTerm: rate.term,
    loanPurpose: mapLoanPurpose(rate.loanPurpose),
    rate: rate.interestRate,
    apr: rate.apr,
    points: rate.points || 0,
    lockPeriod: rate.lockDays || 30,
    adjustments: {
      ltv: rate.adjustments?.ltv || 0,
      creditScore: rate.adjustments?.creditScore || 0,
      propertyType: rate.adjustments?.propertyType || 0,
      occupancy: rate.adjustments?.occupancy || 0,
      total: rate.adjustments?.total || 0
    },
    isActive: true,
    effectiveDate: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  }));
}

/**
 * Get product pricing details from Optimal Blue
 */
async function getProductPricing(filters = {}) {
  logger.info('Fetching Optimal Blue product pricing', { filters });

  const data = await makeRequest('POST', '/v1/products/search', {
    productType: filters.productType,
    term: filters.loanTerm,
    investorName: filters.investorName,
    includeInactive: false
  });

  return transformProductPricing(data);
}

/**
 * Transform Optimal Blue products to FAHM ProductPricing format
 */
function transformProductPricing(obData) {
  if (!obData || !obData.products) {
    return [];
  }

  return obData.products.map(product => ({
    optimalBlueProductId: product.productId,
    productName: product.name,
    productType: mapProductType(product.productType),
    loanTerm: product.term,
    investorName: product.investor?.name || 'Unknown',
    baseRate: product.baseRate,
    basePrice: product.basePrice,
    minLoanAmount: product.limits?.minLoanAmount || 0,
    maxLoanAmount: product.limits?.maxLoanAmount,
    minLTV: product.limits?.minLTV || 0,
    maxLTV: product.limits?.maxLTV,
    minCreditScore: product.limits?.minCreditScore || 580,
    allowedPropertyTypes: product.allowedPropertyTypes?.map(mapPropertyType) || [],
    allowedOccupancy: product.allowedOccupancy?.map(mapOccupancy) || [],
    features: {
      armType: product.armType,
      buydown: product.features?.buydown || false,
      interestOnly: product.features?.interestOnly || false,
      balloonPayment: product.features?.balloonPayment || false,
      prepaymentPenalty: product.features?.prepaymentPenalty || false
    },
    adjustments: product.adjustments,
    isActive: product.isActive !== false,
    effectiveDate: new Date(product.effectiveDate || Date.now()),
    lastSyncedAt: new Date()
  }));
}

/**
 * Submit rate lock request to Optimal Blue
 */
async function submitRateLock(lockRequest) {
  const {
    loanId,
    rate,
    lockPeriod,
    loanAmount,
    productType,
    loanTerm,
    borrower,
    property
  } = lockRequest;

  logger.info('Submitting rate lock to Optimal Blue', { loanId, rate, lockPeriod });

  const data = await makeRequest('POST', '/v1/locks/create', {
    loanId,
    rate,
    lockDays: lockPeriod,
    loanAmount,
    productType,
    term: loanTerm,
    borrower: {
      name: borrower.name,
      creditScore: borrower.creditScore
    },
    property: {
      address: property.address,
      type: property.type,
      occupancy: property.occupancy,
      value: property.value
    }
  });

  return {
    optimalBlueLockId: data.lockId,
    status: data.status === 'confirmed' ? 'confirmed' : 'pending',
    confirmedAt: data.confirmedAt ? new Date(data.confirmedAt) : null,
    lockExpiresAt: new Date(data.expiresAt),
    investorName: data.investor?.name,
    investorLockConfirmation: data.confirmationNumber
  };
}

/**
 * Extend an existing rate lock
 */
async function extendRateLock(lockId, extensionDays, reason) {
  logger.info('Extending rate lock in Optimal Blue', { lockId, extensionDays });

  const data = await makeRequest('POST', `/v1/locks/${lockId}/extend`, {
    extensionDays,
    reason
  });

  return {
    newExpiration: new Date(data.newExpiresAt),
    extensionFee: data.extensionFee || 0,
    status: data.status
  };
}

/**
 * Get rate lock details from Optimal Blue
 */
async function getRateLockDetails(lockId) {
  logger.info('Fetching rate lock details from Optimal Blue', { lockId });

  const data = await makeRequest('GET', `/v1/locks/${lockId}`);

  return {
    status: data.status,
    rate: data.rate,
    lockExpiresAt: new Date(data.expiresAt),
    confirmedAt: data.confirmedAt ? new Date(data.confirmedAt) : null,
    investorName: data.investor?.name,
    investorLockConfirmation: data.confirmationNumber
  };
}

/**
 * Release/cancel a rate lock
 */
async function releaseRateLock(lockId, reason) {
  logger.info('Releasing rate lock in Optimal Blue', { lockId, reason });

  await makeRequest('POST', `/v1/locks/${lockId}/release`, { reason });

  return { status: 'released' };
}

// Helper mapping functions
function mapProductType(obType) {
  const mapping = {
    CONV: 'conventional',
    FHA: 'fha',
    VA: 'va',
    USDA: 'usda',
    JUMBO: 'jumbo'
  };
  return mapping[obType?.toUpperCase()] || 'conventional';
}

function mapLoanPurpose(obPurpose) {
  const mapping = {
    PURCHASE: 'purchase',
    REFINANCE: 'refinance',
    CASHOUT: 'cashout_refinance'
  };
  return mapping[obPurpose?.toUpperCase()] || 'purchase';
}

function mapPropertyType(obType) {
  const mapping = {
    SFR: 'single_family',
    CONDO: 'condo',
    TOWNHOUSE: 'townhouse',
    MULTI: 'multi_family',
    MANUFACTURED: 'manufactured'
  };
  return mapping[obType?.toUpperCase()] || 'single_family';
}

function mapOccupancy(obOccupancy) {
  const mapping = {
    PRIMARY: 'primary',
    SECOND: 'second_home',
    INVESTMENT: 'investment'
  };
  return mapping[obOccupancy?.toUpperCase()] || 'primary';
}

module.exports = {
  getRateSheet,
  getRateSheetCached,
  getProductPricing,
  submitRateLock,
  extendRateLock,
  getRateLockDetails,
  releaseRateLock,
  transformRateSheet,
  transformProductPricing
};
