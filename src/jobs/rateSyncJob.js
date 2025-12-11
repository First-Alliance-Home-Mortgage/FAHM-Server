const cron = require('node-cron');
const RateSnapshot = require('../models/RateSnapshot');
const RateAlert = require('../models/RateAlert');
const ProductPricing = require('../models/ProductPricing');
const optimalBlueService = require('../services/optimalBlueService');
const totalExpertService = require('../services/totalExpertService');
const Notification = require('../models/Notification');
const logger = require('../utils/logger');

/**
 * Fetch daily rate sheets from Optimal Blue
 */
async function fetchDailyRates() {
  logger.info('Starting daily rate fetch from Optimal Blue');

  const scenarios = [
    // Conventional rates
    { productType: 'conventional', loanTerm: 30, loanAmount: 300000, creditScore: 740, ltv: 80 },
    { productType: 'conventional', loanTerm: 15, loanAmount: 300000, creditScore: 740, ltv: 80 },
    { productType: 'conventional', loanTerm: 20, loanAmount: 300000, creditScore: 740, ltv: 80 },
    
    // FHA rates
    { productType: 'fha', loanTerm: 30, loanAmount: 300000, creditScore: 680, ltv: 96.5 },
    { productType: 'fha', loanTerm: 15, loanAmount: 300000, creditScore: 680, ltv: 96.5 },
    
    // VA rates
    { productType: 'va', loanTerm: 30, loanAmount: 300000, creditScore: 720, ltv: 100 },
    { productType: 'va', loanTerm: 15, loanAmount: 300000, creditScore: 720, ltv: 100 },
    
    // USDA rates
    { productType: 'usda', loanTerm: 30, loanAmount: 250000, creditScore: 700, ltv: 100 },
    
    // Jumbo rates
    { productType: 'jumbo', loanTerm: 30, loanAmount: 800000, creditScore: 760, ltv: 80 },
    { productType: 'jumbo', loanTerm: 15, loanAmount: 800000, creditScore: 760, ltv: 80 }
  ];

  let totalFetched = 0;
  let totalSaved = 0;

  for (const scenario of scenarios) {
    try {
      const rates = await optimalBlueService.getRateSheet(scenario);
      totalFetched += rates.length;

      for (const rateData of rates) {
        const snapshot = new RateSnapshot(rateData);
        await snapshot.save();
        totalSaved++;
      }

      logger.info(`Fetched and saved rates for ${scenario.productType} ${scenario.loanTerm}yr`, {
        count: rates.length
      });
    } catch (error) {
      logger.error(`Error fetching rates for scenario:`, { scenario, error: error.message });
      // Continue with next scenario even if one fails
    }
  }

  logger.info('Daily rate fetch completed', {
    totalFetched,
    totalSaved
  });

  return { totalFetched, totalSaved };
}

/**
 * Fetch product pricing from Optimal Blue
 */
async function fetchProductPricing() {
  logger.info('Starting product pricing fetch from Optimal Blue');

  try {
    const products = await optimalBlueService.getProductPricing({});

    let savedCount = 0;
    for (const productData of products) {
      await ProductPricing.findOneAndUpdate(
        { optimalBlueProductId: productData.optimalBlueProductId },
        productData,
        { upsert: true, new: true }
      );
      savedCount++;
    }

    logger.info('Product pricing fetch completed', {
      totalProducts: products.length,
      saved: savedCount
    });

    return { total: products.length, saved: savedCount };
  } catch (error) {
    logger.error('Error fetching product pricing:', error);
    throw error;
  }
}

/**
 * Check all active rate alerts
 */
async function checkRateAlerts() {
  logger.info('Starting rate alert check');

  try {
    const activeAlerts = await RateAlert.find({ status: 'active' })
      .populate('user', 'name email phone')
      .populate('loan', 'loanAmount');

    let checkedCount = 0;
    let triggeredCount = 0;

    for (const alert of activeAlerts) {
      try {
        // Get current rate for this product/term combination
        const currentRates = await RateSnapshot.find({
          productType: alert.productType,
          loanTerm: alert.loanTerm,
          isActive: true,
          effectiveDate: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        })
          .sort({ effectiveDate: -1 })
          .limit(1);

        if (currentRates.length === 0) {
          logger.warn('No current rates found for alert', {
            alertId: alert._id,
            productType: alert.productType,
            loanTerm: alert.loanTerm
          });
          continue;
        }

        const currentRate = currentRates[0].rate;
        let shouldTrigger = false;

        switch (alert.triggerType) {
          case 'below':
            shouldTrigger = currentRate <= alert.targetRate;
            break;
          case 'above':
            shouldTrigger = currentRate >= alert.targetRate;
            break;
          case 'drops_by':
            if (alert.baselineRate) {
              const drop = alert.baselineRate - currentRate;
              shouldTrigger = drop >= alert.dropAmount;
            } else {
              // Set initial baseline
              alert.baselineRate = currentRate;
              await alert.save();
            }
            break;
        }

        if (shouldTrigger) {
          alert.status = 'triggered';
          alert.triggeredAt = new Date();
          alert.triggeredRate = currentRate;
          await alert.save();

          // Send notification
          await sendRateAlertNotification(alert, currentRate);

          // Log to CRM
          try {
            await totalExpertService.logActivity(alert.user._id, {
              type: 'rate_alert_triggered',
              subject: `Rate Alert Triggered: ${alert.productType} ${alert.loanTerm}yr`,
              description: `Rate ${alert.triggerType === 'below' ? 'dropped below' : alert.triggerType === 'above' ? 'went above' : 'dropped by'} target (${alert.targetRate}%). Current rate: ${currentRate}%`,
              metadata: {
                alertId: alert._id,
                productType: alert.productType,
                loanTerm: alert.loanTerm,
                targetRate: alert.targetRate,
                currentRate,
                triggerType: alert.triggerType
              }
            });
          } catch (crmError) {
            logger.error('Failed to log rate alert to CRM:', crmError);
            // Don't fail the alert if CRM logging fails
          }

          triggeredCount++;
          logger.info('Rate alert triggered', {
            alertId: alert._id,
            userId: alert.user._id,
            productType: alert.productType,
            loanTerm: alert.loanTerm,
            targetRate: alert.targetRate,
            currentRate
          });
        }

        alert.lastCheckedAt = new Date();
        await alert.save();
        checkedCount++;
      } catch (error) {
        logger.error('Error checking individual alert:', {
          alertId: alert._id,
          error: error.message
        });
        // Continue with next alert
      }
    }

    logger.info('Rate alert check completed', {
      totalAlerts: activeAlerts.length,
      checked: checkedCount,
      triggered: triggeredCount
    });

    return {
      total: activeAlerts.length,
      checked: checkedCount,
      triggered: triggeredCount
    };
  } catch (error) {
    logger.error('Error in rate alert check:', error);
    throw error;
  }
}

/**
 * Send rate alert notification
 */
async function sendRateAlertNotification(alert, currentRate) {
  const user = alert.user;
  const methods = alert.notificationMethod === 'all' 
    ? ['push', 'sms', 'email'] 
    : [alert.notificationMethod];

  const message = `Rate Alert: ${alert.productType.toUpperCase()} ${alert.loanTerm}-year rate is now ${currentRate}% (your target: ${alert.targetRate}%)`;

  for (const method of methods) {
    try {
      if (method === 'push') {
        await Notification.create({
          user: user._id,
          type: 'rate_alert',
          title: 'Rate Alert Triggered',
          message,
          relatedLoan: alert.loan
        });
        logger.info('Push notification sent for rate alert', {
          userId: user._id,
          alertId: alert._id
        });
      }
      
      // SMS and email would integrate with external services (e.g., Twilio, SendGrid)
      // Placeholder for now
      if (method === 'sms' || method === 'email') {
        logger.info(`Rate alert ${method} notification queued`, {
          userId: user._id,
          alertId: alert._id,
          method
        });
      }
    } catch (error) {
      logger.error(`Failed to send ${method} notification for rate alert:`, {
        alertId: alert._id,
        error: error.message
      });
    }
  }
}

/**
 * Deactivate expired rate snapshots
 */
async function deactivateExpiredSnapshots() {
  logger.info('Deactivating expired rate snapshots');

  try {
    const result = await RateSnapshot.updateMany(
      {
        isActive: true,
        expiresAt: { $lt: new Date() }
      },
      {
        $set: { isActive: false }
      }
    );

    logger.info('Expired rate snapshots deactivated', {
      count: result.modifiedCount
    });

    return result.modifiedCount;
  } catch (error) {
    logger.error('Error deactivating expired snapshots:', error);
    throw error;
  }
}

/**
 * Start rate sync scheduler
 * - Daily rate fetch at 7 AM
 * - Product pricing fetch daily at 7:15 AM
 * - Rate alert checks every 30 minutes
 * - Expired snapshot cleanup daily at 8 AM
 */
function startRateSyncScheduler() {
  logger.info('Starting Optimal Blue rate sync scheduler');

  // Daily rate fetch at 7 AM (before market opens)
  cron.schedule('0 7 * * *', async () => {
    logger.info('Running scheduled daily rate fetch');
    try {
      await fetchDailyRates();
    } catch (error) {
      logger.error('Scheduled rate fetch failed:', error);
    }
  });

  // Product pricing fetch at 7:15 AM
  cron.schedule('15 7 * * *', async () => {
    logger.info('Running scheduled product pricing fetch');
    try {
      await fetchProductPricing();
    } catch (error) {
      logger.error('Scheduled product pricing fetch failed:', error);
    }
  });

  // Rate alert checks every 30 minutes during business hours (6 AM - 8 PM)
  cron.schedule('*/30 6-20 * * *', async () => {
    logger.info('Running scheduled rate alert check');
    try {
      await checkRateAlerts();
    } catch (error) {
      logger.error('Scheduled rate alert check failed:', error);
    }
  });

  // Deactivate expired snapshots daily at 8 AM
  cron.schedule('0 8 * * *', async () => {
    logger.info('Running scheduled expired snapshot cleanup');
    try {
      await deactivateExpiredSnapshots();
    } catch (error) {
      logger.error('Scheduled snapshot cleanup failed:', error);
    }
  });

  // Initial run after 3 minutes (startup delay)
  setTimeout(async () => {
    logger.info('Running initial rate sync after startup');
    try {
      await fetchDailyRates();
      await checkRateAlerts();
    } catch (error) {
      logger.error('Initial rate sync failed:', error);
    }
  }, 3 * 60 * 1000);

  logger.info('Optimal Blue rate sync scheduler started successfully');
}

module.exports = {
  startRateSyncScheduler,
  fetchDailyRates,
  fetchProductPricing,
  checkRateAlerts,
  deactivateExpiredSnapshots
};
