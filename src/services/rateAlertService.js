const RateAlert = require('../models/RateAlert');
const optimalBlueService = require('./optimalBlueService');
const totalExpertService = require('./totalExpertService');
const smsNotificationService = require('./smsNotificationService');
const logger = require('../utils/logger');

/**
 * Rate Alert Service
 * Monitors rate changes and triggers notifications
 */
class RateAlertService {
  constructor() {
    this.checking = false;
  }

  /**
   * Check all active alerts
   * Called by scheduler every 30 minutes
   */
  async checkAllAlerts() {
    if (this.checking) {
      logger.warn('Alert check already in progress, skipping');
      return { skipped: true };
    }

    this.checking = true;
    const startTime = Date.now();

    try {
      logger.info('Starting rate alert check');

      // Find alerts that need checking (last checked > 30 minutes ago)
      const alerts = await RateAlert.findAlertsToCheck(30);

      logger.info(`Found ${alerts.length} alerts to check`);

      const results = {
        total: alerts.length,
        checked: 0,
        triggered: 0,
        failed: 0,
        errors: []
      };

      // Check each alert
      for (const alert of alerts) {
        try {
          const result = await this.checkSingleAlert(alert);
          results.checked++;
          if (result.triggered) {
            results.triggered++;
          }
        } catch (error) {
          results.failed++;
          results.errors.push({
            alertId: alert._id,
            error: error.message
          });
          logger.error(`Failed to check alert ${alert._id}: ${error.message}`);
        }
      }

      const duration = Date.now() - startTime;
      logger.info(`Rate alert check completed in ${duration}ms`, results);

      return results;
    } catch (error) {
      logger.error(`Error in rate alert check: ${error.message}`);
      throw error;
    } finally {
      this.checking = false;
    }
  }

  /**
  async checkSingleAlert(alert) {
    // ...existing code...
  }
        triggered: false,
        currentRate
      };
    } catch (error) {
      logger.error(`Error checking alert ${alert._id}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send notifications based on alert preferences
   */
  async sendNotifications(alert, currentRate, rateData) {
    try {
      const user = alert.user;
      const method = alert.notificationMethod;

      const notificationData = {
        userName: user.name,
        productType: alert.productType,
        loanTerm: alert.loanTerm,
        currentRate: currentRate.toFixed(3),
        targetRate: (alert.targetRate || alert.baselineRate).toFixed(3),
        triggerType: alert.triggerType
      };

      // Send based on preference
      if (method === 'sms' || method === 'all') {
        if (user.phone) {
          await smsNotificationService.sendRateAlert(user._id, notificationData);
          logger.info(`SMS rate alert sent to ${user.phone}`);
        }
      }

      if (method === 'push' || method === 'all') {
        // TODO: Implement push notification via Firebase/APNS
        logger.info(`Push notification would be sent to user ${user._id}`);
      }

      if (method === 'email' || method === 'all') {
        // TODO: Implement email notification
        logger.info(`Email notification would be sent to ${user.email}`);
      }

      await alert.markNotificationSent();

      return { success: true };
    } catch (error) {
      logger.error(`Error sending notifications for alert ${alert._id}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Log alert trigger to Total Expert CRM
   */
  async logToCRM(alert, currentRate) {
    try {
      const user = alert.user;

      // Create CRM activity
      const activityData = {
        contactId: user.totalExpertContactId || user._id.toString(),
        activityType: 'rate_alert',
        subject: `Rate Alert Triggered - ${alert.productType} ${alert.loanTerm}yr`,
        description: `Rate alert triggered for ${user.name}. Current rate: ${currentRate.toFixed(3)}%, Target: ${(alert.targetRate || alert.baselineRate).toFixed(3)}%. Trigger type: ${alert.triggerType}.`,
        activityDate: new Date(),
        metadata: {
          alertId: alert._id.toString(),
          productType: alert.productType,
          loanTerm: alert.loanTerm,
          currentRate,
          targetRate: alert.targetRate || alert.baselineRate,
          triggerType: alert.triggerType
        }
      };

      const crmActivity = await totalExpertService.logActivity(
        user.totalExpertContactId || user._id.toString(),
        activityData
      );

      await alert.markCRMLogged(crmActivity.id || crmActivity.activityId);

      logger.info(`Rate alert logged to CRM for user ${user._id}`);

      return { success: true, crmActivityId: crmActivity.id };
    } catch (error) {
      logger.error(`Error logging to CRM for alert ${alert._id}: ${error.message}`);
      // Don't throw - CRM logging failure shouldn't block notification
      return { success: false, error: error.message };
    }
  }

  /**
   * Expire old alerts
   * Called by scheduler daily
   */
  async expireOldAlerts() {
    try {
      const expiredCount = await RateAlert.expireOldAlerts();
      logger.info(`Expired ${expiredCount} old rate alerts`);
      return { expiredCount };
    } catch (error) {
      logger.error(`Error expiring old alerts: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get alert statistics
   */
  async getGlobalStats() {
    try {
      const stats = await RateAlert.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const recentTriggers = await RateAlert.find({
        status: 'triggered',
        triggeredAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }).countDocuments();

      return {
        byStatus: stats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {}),
        triggersLast24Hours: recentTriggers
      };
    } catch (error) {
      logger.error(`Error fetching global alert stats: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new RateAlertService();
