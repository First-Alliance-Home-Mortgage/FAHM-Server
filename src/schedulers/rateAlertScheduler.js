const cron = require('node-cron');
const rateAlertService = require('../services/rateAlertService');
const logger = require('../utils/logger');

/**
 * Rate Alert Scheduler
 * Checks alerts every 30 minutes during business hours (6 AM - 8 PM)
 */
class RateAlertScheduler {
  constructor() {
    this.checkAlertsJob = null;
    this.expireAlertsJob = null;
  }

  /**
   * Start scheduler
   */
  start() {
    // Check alerts every 30 minutes during business hours (6 AM - 8 PM)
    // Cron: */30 6-20 * * * = Every 30 minutes between 6:00 and 20:59
    this.checkAlertsJob = cron.schedule('*/30 6-20 * * *', async () => {
      try {
        logger.info('Running scheduled rate alert check');
        const result = await rateAlertService.checkAllAlerts();
        logger.info('Scheduled rate alert check completed', result);
      } catch (error) {
        logger.error(`Error in scheduled rate alert check: ${error.message}`);
      }
    }, {
      scheduled: true,
      timezone: 'America/New_York'
    });

    // Expire old alerts daily at 2 AM
    this.expireAlertsJob = cron.schedule('0 2 * * *', async () => {
      try {
        logger.info('Running scheduled rate alert expiration');
        const result = await rateAlertService.expireOldAlerts();
        logger.info('Scheduled rate alert expiration completed', result);
      } catch (error) {
        logger.error(`Error in scheduled rate alert expiration: ${error.message}`);
      }
    }, {
      scheduled: true,
      timezone: 'America/New_York'
    });

    logger.info('Rate alert scheduler started');
    logger.info('Alert checks: Every 30 minutes (6 AM - 8 PM ET)');
    logger.info('Alert expiration: Daily at 2 AM ET');
  }

  /**
   * Stop scheduler
   */
  stop() {
    if (this.checkAlertsJob) {
      this.checkAlertsJob.stop();
      logger.info('Rate alert check job stopped');
    }
    if (this.expireAlertsJob) {
      this.expireAlertsJob.stop();
      logger.info('Rate alert expiration job stopped');
    }
  }

  /**
   * Check if scheduler is running
   */
  isRunning() {
    return this.checkAlertsJob && this.expireAlertsJob;
  }
}

module.exports = new RateAlertScheduler();
