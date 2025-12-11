const cron = require('node-cron');
const totalExpertService = require('../services/totalExpertService');
const CRMContact = require('../models/CRMContact');
const CRMJourney = require('../models/CRMJourney');
const CRMActivityLog = require('../models/CRMActivityLog');
const CRMSyncLog = require('../models/CRMSyncLog');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Sync contacts bidirectionally with Total Expert CRM
 */
async function syncContacts() {
  const startTime = Date.now();
  let recordsProcessed = 0;
  let recordsSucceeded = 0;
  let recordsFailed = 0;

  try {
    logger.info('Starting scheduled CRM contact sync');

    // Get all FAHM users that should be synced to CRM
    const users = await User.find({
      role: { $in: ['borrower', 'broker', 'realtor'] }
    }).limit(100); // Process in batches to avoid overwhelming the system

    for (const user of users) {
      try {
        recordsProcessed++;

        // Check if contact already exists in local DB
        let crmContact = await CRMContact.findOne({ user: user._id });

        const contactData = {
          firstName: user.name.split(' ')[0],
          lastName: user.name.split(' ').slice(1).join(' '),
          email: user.email,
          phone: user.phone,
          contactType: user.role === 'borrower' ? 'borrower' : 
                       user.role === 'realtor' ? 'realtor' : 'partner',
          status: 'active',
          crmContactId: crmContact?.crmContactId
        };

        // Sync to Total Expert
        const syncResult = await totalExpertService.syncContact(contactData);

        // Update or create local record
        if (crmContact) {
          crmContact.crmContactId = syncResult.crmContactId;
          crmContact.firstName = syncResult.firstName;
          crmContact.lastName = syncResult.lastName;
          crmContact.email = syncResult.email;
          crmContact.phone = syncResult.phone;
          crmContact.lastSyncedAt = new Date();
          await crmContact.save();
        } else {
          crmContact = await CRMContact.create({
            user: user._id,
            ...syncResult
          });
        }

        recordsSucceeded++;
      } catch (error) {
        recordsFailed++;
        logger.error(`Failed to sync user ${user._id}`, { error: error.message });
      }
    }

    // Log sync operation
    await CRMSyncLog.create({
      syncType: 'contact',
      direction: 'bidirectional',
      status: recordsFailed === 0 ? 'success' : recordsFailed < recordsProcessed ? 'partial' : 'failed',
      recordsProcessed,
      recordsSucceeded,
      recordsFailed,
      syncDuration: Date.now() - startTime
    });

    logger.info('Scheduled CRM contact sync completed', {
      recordsProcessed,
      recordsSucceeded,
      recordsFailed,
      duration: Date.now() - startTime
    });

    return { recordsProcessed, recordsSucceeded, recordsFailed };
  } catch (error) {
    logger.error('Scheduled CRM contact sync failed', { error: error.message });
    
    await CRMSyncLog.create({
      syncType: 'contact',
      direction: 'bidirectional',
      status: 'failed',
      recordsProcessed,
      recordsSucceeded,
      recordsFailed,
      errorMessage: error.message,
      syncDuration: Date.now() - startTime
    });

    throw error;
  }
}

/**
 * Sync journeys from Total Expert CRM
 */
async function syncJourneys() {
  const startTime = Date.now();
  let recordsSucceeded = 0;
  let recordsFailed = 0;

  try {
    logger.info('Starting scheduled CRM journey sync');

    // Get all active journeys from Total Expert
    const teJourneys = await totalExpertService.getAllJourneys();

    for (const journeyData of teJourneys) {
      try {
        // Update or create local journey record
        await CRMJourney.findOneAndUpdate(
          { crmJourneyId: journeyData.crmJourneyId },
          journeyData,
          { upsert: true, new: true }
        );
        recordsSucceeded++;
      } catch (error) {
        recordsFailed++;
        logger.error(`Failed to sync journey ${journeyData.crmJourneyId}`, { error: error.message });
      }
    }

    // Log sync operation
    await CRMSyncLog.create({
      syncType: 'journey',
      direction: 'inbound',
      status: recordsFailed === 0 ? 'success' : 'partial',
      recordsProcessed: teJourneys.length,
      recordsSucceeded,
      recordsFailed,
      syncDuration: Date.now() - startTime
    });

    logger.info('Scheduled CRM journey sync completed', {
      recordsProcessed: teJourneys.length,
      recordsSucceeded,
      recordsFailed
    });

    return { recordsProcessed: teJourneys.length, recordsSucceeded, recordsFailed };
  } catch (error) {
    logger.error('Scheduled CRM journey sync failed', { error: error.message });
    
    await CRMSyncLog.create({
      syncType: 'journey',
      direction: 'inbound',
      status: 'failed',
      recordsProcessed: 0,
      recordsSucceeded,
      recordsFailed,
      errorMessage: error.message,
      syncDuration: Date.now() - startTime
    });

    throw error;
  }
}

/**
 * Sync unsynced activities to Total Expert CRM
 */
async function syncActivities() {
  const startTime = Date.now();
  let recordsSucceeded = 0;
  let recordsFailed = 0;

  try {
    logger.info('Starting scheduled CRM activity sync');

    // Get all unsynced activities
    const unsyncedActivities = await CRMActivityLog.find({ crmSynced: false })
      .populate('crmContact')
      .limit(100); // Process in batches

    for (const activity of unsyncedActivities) {
      if (!activity.crmContact) {
        recordsFailed++;
        continue;
      }

      try {
        const syncResult = await totalExpertService.logActivity({
          crmContactId: activity.crmContact.crmContactId,
          activityType: activity.activityType,
          direction: activity.direction,
          subject: activity.subject,
          content: activity.content,
          performedBy: activity.performedBy,
          createdAt: activity.createdAt,
          metadata: activity.metadata
        });

        activity.crmSynced = true;
        activity.crmActivityId = syncResult.crmActivityId;
        activity.syncedAt = syncResult.syncedAt;
        await activity.save();

        recordsSucceeded++;
      } catch (error) {
        recordsFailed++;
        logger.error(`Failed to sync activity ${activity._id}`, { error: error.message });
      }
    }

    // Log sync operation
    await CRMSyncLog.create({
      syncType: 'activity',
      direction: 'outbound',
      status: recordsFailed === 0 ? 'success' : recordsFailed < unsyncedActivities.length ? 'partial' : 'failed',
      recordsProcessed: unsyncedActivities.length,
      recordsSucceeded,
      recordsFailed,
      syncDuration: Date.now() - startTime
    });

    logger.info('Scheduled CRM activity sync completed', {
      recordsProcessed: unsyncedActivities.length,
      recordsSucceeded,
      recordsFailed
    });

    return { recordsProcessed: unsyncedActivities.length, recordsSucceeded, recordsFailed };
  } catch (error) {
    logger.error('Scheduled CRM activity sync failed', { error: error.message });
    
    await CRMSyncLog.create({
      syncType: 'activity',
      direction: 'outbound',
      status: 'failed',
      recordsProcessed: 0,
      recordsSucceeded,
      recordsFailed,
      errorMessage: error.message,
      syncDuration: Date.now() - startTime
    });

    throw error;
  }
}

/**
 * Run full bidirectional sync
 */
async function runFullSync() {
  const startTime = Date.now();
  logger.info('Starting full CRM sync');

  try {
    // Run all sync operations
    const results = await Promise.allSettled([
      syncContacts(),
      syncJourneys(),
      syncActivities()
    ]);

    const totalProcessed = results.reduce((sum, r) => sum + (r.value?.recordsProcessed || 0), 0);
    const totalSucceeded = results.reduce((sum, r) => sum + (r.value?.recordsSucceeded || 0), 0);
    const totalFailed = results.reduce((sum, r) => sum + (r.value?.recordsFailed || 0), 0);

    // Log overall sync
    await CRMSyncLog.create({
      syncType: 'full',
      direction: 'bidirectional',
      status: totalFailed === 0 ? 'success' : totalFailed < totalProcessed ? 'partial' : 'failed',
      recordsProcessed: totalProcessed,
      recordsSucceeded: totalSucceeded,
      recordsFailed: totalFailed,
      syncDuration: Date.now() - startTime,
      dataSnapshot: {
        contacts: results[0].status === 'fulfilled' ? results[0].value : { error: results[0].reason?.message },
        journeys: results[1].status === 'fulfilled' ? results[1].value : { error: results[1].reason?.message },
        activities: results[2].status === 'fulfilled' ? results[2].value : { error: results[2].reason?.message }
      }
    });

    logger.info('Full CRM sync completed', {
      totalProcessed,
      totalSucceeded,
      totalFailed,
      duration: Date.now() - startTime
    });
  } catch (error) {
    logger.error('Full CRM sync failed', { error: error.message });
    throw error;
  }
}

/**
 * Start CRM sync scheduler
 * Runs every 15 minutes
 */
function startCRMSyncScheduler() {
  // Run every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    try {
      await runFullSync();
    } catch (error) {
      logger.error('CRM sync scheduler error', { error: error.message });
    }
  });

  logger.info('CRM sync scheduler started (runs every 15 minutes)');

  // Run initial sync after 1 minute to avoid startup overload
  setTimeout(async () => {
    try {
      await runFullSync();
    } catch (error) {
      logger.error('Initial CRM sync error', { error: error.message });
    }
  }, 60000);
}

module.exports = {
  startCRMSyncScheduler,
  syncContacts,
  syncJourneys,
  syncActivities,
  runFullSync
};
