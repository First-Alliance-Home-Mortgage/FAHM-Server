const cron = require('node-cron');
const CreditReport = require('../models/CreditReport');
const logger = require('../utils/logger');

/**
 * Delete expired credit reports per FCRA retention policy
 * Runs daily at 2 AM
 */
async function purgeExpiredReports() {
  const startTime = Date.now();
  
  try {
    logger.info('Starting FCRA retention policy cleanup');

    const now = new Date();
    
    // Find all expired reports that haven't been purged yet
    const expiredReports = await CreditReport.find({
      expiresAt: { $lt: now },
      status: { $ne: 'expired' }
    });

    let purgedCount = 0;
    let errorCount = 0;

    for (const report of expiredReports) {
      try {
        // Mark as expired and remove sensitive data
        report.status = 'expired';
        report.encryptedData = undefined;
        report.encryptionIV = undefined;
        report.tradelines = [];
        report.publicRecords = [];
        report.inquiries = [];
        report.summary = {
          totalAccounts: 0,
          openAccounts: 0,
          closedAccounts: 0,
          totalDebt: 0,
          availableCredit: 0,
          creditUtilization: 0,
          oldestAccount: null,
          recentInquiries: 0
        };
        
        await report.save();
        purgedCount++;

        logger.debug('Credit report purged per FCRA', {
          reportId: report._id,
          borrower: report.borrower,
          expiresAt: report.expiresAt
        });
      } catch (error) {
        errorCount++;
        logger.error(`Failed to purge credit report ${report._id}`, { 
          error: error.message 
        });
      }
    }

    const duration = Date.now() - startTime;

    logger.info('FCRA retention policy cleanup completed', {
      purgedCount,
      errorCount,
      duration
    });

    return { purgedCount, errorCount, duration };
  } catch (error) {
    logger.error('FCRA retention policy cleanup failed', { 
      error: error.message 
    });
    throw error;
  }
}

/**
 * Warn about reports expiring soon (30 days before expiration)
 */
async function warnExpiringReports() {
  try {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const now = new Date();

    const expiringReports = await CreditReport.find({
      expiresAt: { 
        $gte: now,
        $lte: thirtyDaysFromNow 
      },
      status: 'completed'
    }).populate('loan borrower requestedBy');

    logger.info('Credit reports expiring within 30 days', {
      count: expiringReports.length
    });

    // In production, you would send notifications to loan officers here
    for (const report of expiringReports) {
      logger.info('Credit report expiring soon', {
        reportId: report._id,
        borrower: report.borrower?.name,
        expiresAt: report.expiresAt,
        daysRemaining: Math.ceil((report.expiresAt - now) / (1000 * 60 * 60 * 24))
      });
    }

    return expiringReports.length;
  } catch (error) {
    logger.error('Failed to check expiring reports', { error: error.message });
    throw error;
  }
}

/**
 * Start FCRA retention policy scheduler
 * Runs daily at 2 AM for purging expired reports
 * Runs daily at 9 AM for warning about expiring reports
 */
function startFCRARetentionScheduler() {
  // Purge expired reports daily at 2 AM
  cron.schedule('0 2 * * *', async () => {
    try {
      await purgeExpiredReports();
    } catch (error) {
      logger.error('FCRA purge scheduler error', { error: error.message });
    }
  });

  // Warn about expiring reports daily at 9 AM
  cron.schedule('0 9 * * *', async () => {
    try {
      await warnExpiringReports();
    } catch (error) {
      logger.error('FCRA warning scheduler error', { error: error.message });
    }
  });

  logger.info('FCRA retention policy scheduler started (purge: daily 2AM, warnings: daily 9AM)');

  // Run initial check 2 minutes after startup
  setTimeout(async () => {
    try {
      const expiring = await warnExpiringReports();
      logger.info('Initial FCRA expiration check completed', { expiringCount: expiring });
    } catch (error) {
      logger.error('Initial FCRA check error', { error: error.message });
    }
  }, 120000);
}

module.exports = {
  startFCRARetentionScheduler,
  purgeExpiredReports,
  warnExpiringReports
};
