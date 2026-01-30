const createError = require('http-errors');
const { validationResult } = require('express-validator');
const totalExpertService = require('../services/totalExpertService');
const CRMContact = require('../models/CRMContact');
const CRMJourney = require('../models/CRMJourney');
const CRMActivityLog = require('../models/CRMActivityLog');
const CRMSyncLog = require('../models/CRMSyncLog');
const User = require('../models/User');
const LoanApplication = require('../models/LoanApplication');
const logger = require('../utils/logger');

/**
 * Sync all contacts bidirectionally
 */
exports.syncContacts = async (req, res, next) => {
  const startTime = Date.now();
  let recordsProcessed = 0;
  let recordsSucceeded = 0;
  let recordsFailed = 0;

  try {
    logger.info('Starting CRM contact sync');

    // Get all FAHM users that should be synced to CRM
    const users = await User.find({
      role: { $in: ['borrower', 'broker', 'realtor'] }
    });

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
      direction: 'outbound',
      status: recordsFailed === 0 ? 'success' : recordsFailed < recordsProcessed ? 'partial' : 'failed',
      recordsProcessed,
      recordsSucceeded,
      recordsFailed,
      syncDuration: Date.now() - startTime
    });

    logger.info('CRM contact sync completed', {
      recordsProcessed,
      recordsSucceeded,
      recordsFailed,
      duration: Date.now() - startTime
    });

    res.json({
      message: 'Contact sync completed',
      recordsProcessed,
      recordsSucceeded,
      recordsFailed,
      duration: Date.now() - startTime
    });
  } catch (error) {
    logger.error('CRM contact sync failed', { error: error.message });
    next(createError(500, 'Contact sync failed'));
  }
};

/**
 * Get CRM contacts for current user or assigned LO
 */
exports.getContacts = async (req, res, next) => {
  try {
    const userId = req.user.role?.slug === 'borrower' ? req.user.id : null;
    const assignedTo = req.user.role?.slug !== 'borrower' ? req.user.id : null;

    const query = {};
    if (userId) {
      const user = await User.findById(userId);
      const crmContact = await CRMContact.findOne({ email: user.email });
      if (!crmContact) {
        return res.json({ contacts: [] });
      }
      query._id = crmContact._id;
    } else if (assignedTo) {
      query.assignedTo = assignedTo;
    }

    const contacts = await CRMContact.find(query)
      .populate('user', 'name email phone')
      .populate('assignedTo', 'name email')
      .sort('-lastEngagementDate');

    res.json({ contacts });
  } catch (error) {
    logger.error('Failed to get CRM contacts', { error: error.message });
    next(createError(500, 'Failed to retrieve contacts'));
  }
};

/**
 * Get contact engagement status
 */
exports.getContactEngagement = async (req, res, next) => {
  try {
    const { contactId } = req.params;

    const crmContact = await CRMContact.findById(contactId);
    if (!crmContact) {
      return next(createError(404, 'Contact not found'));
    }

    // Get fresh engagement data from Total Expert
    const engagement = await totalExpertService.getContactEngagement(crmContact.crmContactId);

    // Update local record
    crmContact.engagementScore = engagement.engagementScore;
    crmContact.lastEngagementDate = engagement.lastEngagementDate;
    await crmContact.save();

    res.json({
      contactId: crmContact._id,
      crmContactId: crmContact.crmContactId,
      engagementScore: engagement.engagementScore,
      lastEngagementDate: engagement.lastEngagementDate,
      emailOpens: engagement.emailOpens,
      emailClicks: engagement.emailClicks,
      smsReplies: engagement.smsReplies,
      journeys: crmContact.journeys
    });
  } catch (error) {
    logger.error('Failed to get contact engagement', { error: error.message });
    next(createError(500, 'Failed to retrieve engagement status'));
  }
};

/**
 * Sync all journeys from Total Expert
 */
exports.syncJourneys = async (req, res, next) => {
  const startTime = Date.now();

  try {
    logger.info('Starting CRM journey sync');

    // Get all active journeys from Total Expert
    const teJourneys = await totalExpertService.getAllJourneys();

    let recordsSucceeded = 0;
    let recordsFailed = 0;

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

    logger.info('CRM journey sync completed', {
      recordsProcessed: teJourneys.length,
      recordsSucceeded,
      recordsFailed
    });

    res.json({
      message: 'Journey sync completed',
      recordsProcessed: teJourneys.length,
      recordsSucceeded,
      recordsFailed,
      duration: Date.now() - startTime
    });
  } catch (error) {
    logger.error('CRM journey sync failed', { error: error.message });
    next(createError(500, 'Journey sync failed'));
  }
};

/**
 * Get all available journeys
 */
exports.getJourneys = async (req, res, next) => {
  try {
    const journeys = await CRMJourney.find({ status: 'active' })
      .sort('name');

    res.json({ journeys });
  } catch (error) {
    logger.error('Failed to get journeys', { error: error.message });
    next(createError(500, 'Failed to retrieve journeys'));
  }
};

/**
 * Enroll contact in a journey
 */
exports.enrollInJourney = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, { errors: errors.array() }));
    }

    const { contactId, journeyId } = req.params;
    const { metadata } = req.body;

    const crmContact = await CRMContact.findById(contactId);
    if (!crmContact) {
      return next(createError(404, 'Contact not found'));
    }

    const journey = await CRMJourney.findById(journeyId);
    if (!journey) {
      return next(createError(404, 'Journey not found'));
    }

    // Enroll in Total Expert
    const enrollment = await totalExpertService.enrollInJourney(
      crmContact.crmContactId,
      journey.crmJourneyId,
      metadata
    );

    // Update local contact record
    crmContact.journeys.push({
      journeyId: journey.crmJourneyId,
      journeyName: journey.name,
      status: enrollment.status,
      startedAt: enrollment.startedAt
    });
    await crmContact.save();

    // Log activity
    await CRMActivityLog.create({
      crmContact: crmContact._id,
      activityType: 'journey_step',
      direction: 'outbound',
      subject: `Enrolled in journey: ${journey.name}`,
      content: JSON.stringify(metadata),
      performedBy: req.user.id,
      crmSynced: true,
      syncedAt: new Date()
    });

    logger.info(`Contact ${contactId} enrolled in journey ${journeyId}`);

    res.json({
      message: 'Successfully enrolled in journey',
      enrollment: {
        contactId: crmContact._id,
        journeyId: journey._id,
        journeyName: journey.name,
        status: enrollment.status,
        startedAt: enrollment.startedAt
      }
    });
  } catch (error) {
    logger.error('Failed to enroll in journey', { error: error.message });
    next(createError(500, 'Failed to enroll in journey'));
  }
};

/**
 * Trigger journey based on milestone update
 */
exports.triggerMilestoneJourney = async (req, res, next) => {
  try {
    const { loanId } = req.params;
    const { milestone } = req.body;

    const loan = await LoanApplication.findById(loanId).populate('borrower');
    if (!loan) {
      return next(createError(404, 'Loan not found'));
    }

    // Find borrower's CRM contact
    const crmContact = await CRMContact.findOne({ user: loan.borrower._id });
    if (!crmContact) {
      return next(createError(404, 'Borrower not found in CRM'));
    }

    // Trigger milestone journey
    const result = await totalExpertService.triggerMilestoneJourney(
      crmContact.crmContactId,
      milestone,
      {
        loanId: loan._id,
        status: loan.status
      }
    );

    if (!result) {
      return res.json({
        message: 'No journey configured for this milestone',
        milestone
      });
    }

    // Update local contact record
    const journey = await CRMJourney.findOne({ crmJourneyId: result.journeyId });
    if (journey) {
      crmContact.journeys.push({
        journeyId: journey.crmJourneyId,
        journeyName: journey.name,
        status: result.status,
        startedAt: result.startedAt
      });
      await crmContact.save();
    }

    logger.info(`Milestone journey triggered for loan ${loanId}`, { milestone });

    res.json({
      message: 'Milestone journey triggered successfully',
      milestone,
      enrollment: result
    });
  } catch (error) {
    logger.error('Failed to trigger milestone journey', { error: error.message });
    next(createError(500, 'Failed to trigger milestone journey'));
  }
};

/**
 * Log activity to CRM
 */
exports.logActivity = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, { errors: errors.array() }));
    }

    const { contactId } = req.params;
    const { activityType, direction, subject, content, metadata } = req.body;

    const crmContact = await CRMContact.findById(contactId);
    if (!crmContact) {
      return next(createError(404, 'Contact not found'));
    }

    // Create local activity log
    const activityLog = await CRMActivityLog.create({
      crmContact: crmContact._id,
      activityType,
      direction,
      subject,
      content,
      metadata,
      performedBy: req.user.id
    });

    // Sync to Total Expert
    try {
      const syncResult = await totalExpertService.logActivity({
        crmContactId: crmContact.crmContactId,
        activityType,
        direction,
        subject,
        content,
        performedBy: req.user.id,
        createdAt: activityLog.createdAt,
        metadata
      });

      activityLog.crmSynced = true;
      activityLog.crmActivityId = syncResult.crmActivityId;
      activityLog.syncedAt = syncResult.syncedAt;
      await activityLog.save();

      logger.info('Activity logged to CRM', { activityId: activityLog._id });
    } catch (error) {
      logger.error('Failed to sync activity to Total Expert', { error: error.message });
      // Activity is logged locally even if CRM sync fails
    }

    res.json({
      message: 'Activity logged successfully',
      activity: activityLog
    });
  } catch (error) {
    logger.error('Failed to log activity', { error: error.message });
    next(createError(500, 'Failed to log activity'));
  }
};

/**
 * Get activity history for a contact
 */
exports.getActivityHistory = async (req, res, next) => {
  try {
    const { contactId } = req.params;
    const { limit = 50, skip = 0 } = req.query;

    const crmContact = await CRMContact.findById(contactId);
    if (!crmContact) {
      return next(createError(404, 'Contact not found'));
    }

    const activities = await CRMActivityLog.find({ crmContact: crmContact._id })
      .populate('performedBy', 'name email')
      .sort('-createdAt')
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const total = await CRMActivityLog.countDocuments({ crmContact: crmContact._id });

    res.json({
      activities,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
        hasMore: skip + activities.length < total
      }
    });
  } catch (error) {
    logger.error('Failed to get activity history', { error: error.message });
    next(createError(500, 'Failed to retrieve activity history'));
  }
};

/**
 * Get sync logs
 */
exports.getSyncLogs = async (req, res, next) => {
  try {
    const { syncType, status, limit = 50 } = req.query;

    const query = {};
    if (syncType) query.syncType = syncType;
    if (status) query.status = status;

    const logs = await CRMSyncLog.find(query)
      .sort('-createdAt')
      .limit(parseInt(limit));

    res.json({ logs });
  } catch (error) {
    logger.error('Failed to get sync logs', { error: error.message });
    next(createError(500, 'Failed to retrieve sync logs'));
  }
};
