const { validationResult } = require('express-validator');
const createError = require('http-errors');
const ReferralSource = require('../models/ReferralSource');
const ReferralSourceAnalytics = require('../models/ReferralSourceAnalytics');
const LoanApplication = require('../models/LoanApplication');
const logger = require('../utils/logger');
const roles = require('../config/roles');

/**
 * Create a new referral source
 * POST /api/v1/referral-sources
 * Access: Loan Officer, Branch Manager, Admin
 */
exports.create = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, { errors: errors.array() }));
    }

    const referralSourceData = {
      ...req.body,
      createdBy: req.user.userId,
      lastModifiedBy: req.user.userId
    };

    // If no assigned LO specified, assign to creator if they're an LO
    if (!referralSourceData.assignedLoanOfficer && 
        (req.user.role === roles.LO_RETAIL || req.user.role === roles.LO_TPO)) {
      referralSourceData.assignedLoanOfficer = req.user.userId;
    }

    const referralSource = new ReferralSource(referralSourceData);
    await referralSource.save();

    await referralSource.populate('assignedLoanOfficer', 'name email phone');

    logger.info(`Referral source created: ${referralSource._id} by user ${req.user.userId}`);

    res.status(201).json({
      success: true,
      data: referralSource
    });
  } catch (err) {
    logger.error(`Error creating referral source: ${err.message}`);
    next(err);
  }
};

/**
 * Get all referral sources (with filtering and pagination)
 * GET /api/v1/referral-sources
 * Access: Authenticated users (filtered by role)
 */
exports.list = async (req, res, next) => {
  try {
    const { 
      status, 
      type, 
      assignedLoanOfficer, 
      partnershipTier,
      search,
      page = 1, 
      limit = 20,
      sortBy = '-analytics.totalLeads'
    } = req.query;

    const query = {};

    // Role-based filtering
    if (req.user.role === roles.LO_RETAIL || req.user.role === roles.LO_TPO) {
      query.assignedLoanOfficer = req.user.userId;
    } else if (req.user.role === roles.BORROWER) {
      return next(createError(403, 'Borrowers cannot access referral sources'));
    }

    // Apply filters
    if (status) query.status = status;
    if (type) query.type = type;
    if (assignedLoanOfficer) query.assignedLoanOfficer = assignedLoanOfficer;
    if (partnershipTier) query.partnershipTier = partnershipTier;

    // Search by name or company
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { companyName: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [referralSources, total] = await Promise.all([
      ReferralSource.find(query)
        .populate('assignedLoanOfficer', 'name email phone')
        .sort(sortBy)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      ReferralSource.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: referralSources,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    logger.error(`Error fetching referral sources: ${err.message}`);
    next(err);
  }
};

/**
 * Get a single referral source by ID
 * GET /api/v1/referral-sources/:id
 * Access: Loan Officer (own), Branch Manager, Admin
 */
exports.get = async (req, res, next) => {
  try {
    const referralSource = await ReferralSource.findById(req.params.id)
      .populate('assignedLoanOfficer', 'name email phone')
      .populate('createdBy', 'name email')
      .populate('lastModifiedBy', 'name email');

    if (!referralSource) {
      return next(createError(404, 'Referral source not found'));
    }

    // Authorization check
    if ((req.user.role === roles.LO_RETAIL || req.user.role === roles.LO_TPO) &&
        referralSource.assignedLoanOfficer?._id.toString() !== req.user.userId) {
      return next(createError(403, 'Not authorized to view this referral source'));
    }

    res.json({
      success: true,
      data: referralSource
    });
  } catch (err) {
    logger.error(`Error fetching referral source: ${err.message}`);
    next(err);
  }
};

/**
 * Update a referral source
 * PATCH /api/v1/referral-sources/:id
 * Access: Assigned LO, Branch Manager, Admin
 */
exports.update = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, { errors: errors.array() }));
    }

    const referralSource = await ReferralSource.findById(req.params.id);

    if (!referralSource) {
      return next(createError(404, 'Referral source not found'));
    }

    // Authorization check
    if ((req.user.role === roles.LO_RETAIL || req.user.role === roles.LO_TPO) &&
        referralSource.assignedLoanOfficer?.toString() !== req.user.userId) {
      return next(createError(403, 'Not authorized to update this referral source'));
    }

    // Prevent direct analytics manipulation
    if (req.body.analytics) {
      delete req.body.analytics;
    }

    Object.assign(referralSource, req.body);
    referralSource.lastModifiedBy = req.user.userId;

    await referralSource.save();
    await referralSource.populate('assignedLoanOfficer', 'name email phone');

    logger.info(`Referral source updated: ${referralSource._id} by user ${req.user.userId}`);

    res.json({
      success: true,
      data: referralSource
    });
  } catch (err) {
    logger.error(`Error updating referral source: ${err.message}`);
    next(err);
  }
};

/**
 * Delete a referral source
 * DELETE /api/v1/referral-sources/:id
 * Access: Admin only
 */
exports.deleteReferralSource = async (req, res, next) => {
  try {
    const referralSource = await ReferralSource.findById(req.params.id);

    if (!referralSource) {
      return next(createError(404, 'Referral source not found'));
    }

    // Check if referral source has any associated loans
    const loanCount = await LoanApplication.countDocuments({ referralSource: req.params.id });

    if (loanCount > 0) {
      return next(createError(400, `Cannot delete referral source with ${loanCount} associated loans. Consider setting status to 'inactive' instead.`));
    }

    await referralSource.deleteOne();

    logger.info(`Referral source deleted: ${req.params.id} by user ${req.user.userId}`);

    res.json({
      success: true,
      message: 'Referral source deleted successfully'
    });
  } catch (err) {
    logger.error(`Error deleting referral source: ${err.message}`);
    next(err);
  }
};

/**
 * Get referral source analytics
 * GET /api/v1/referral-sources/:id/analytics
 * Access: Assigned LO, Branch Manager, Admin
 */
exports.getAnalytics = async (req, res, next) => {
  try {
    const { startDate, endDate, periodType = 'daily' } = req.query;

    const referralSource = await ReferralSource.findById(req.params.id);

    if (!referralSource) {
      return next(createError(404, 'Referral source not found'));
    }

    // Authorization check
    if ((req.user.role === roles.LO_RETAIL || req.user.role === roles.LO_TPO) &&
        referralSource.assignedLoanOfficer?.toString() !== req.user.userId) {
      return next(createError(403, 'Not authorized to view analytics for this referral source'));
    }

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const analyticsData = await ReferralSourceAnalytics.getAnalyticsByDateRange(
      req.params.id,
      start,
      end,
      periodType
    );

    // Calculate summary metrics
    const summary = {
      totalLeads: referralSource.analytics.totalLeads,
      totalApplications: referralSource.analytics.totalApplications,
      totalFundedLoans: referralSource.analytics.totalFundedLoans,
      totalFundedVolume: referralSource.analytics.totalFundedVolume,
      conversionRate: referralSource.analytics.conversionRate,
      averageLoanAmount: referralSource.analytics.totalFundedLoans > 0 
        ? referralSource.analytics.totalFundedVolume / referralSource.analytics.totalFundedLoans 
        : 0
    };

    res.json({
      success: true,
      data: {
        referralSource: {
          id: referralSource._id,
          name: referralSource.name,
          companyName: referralSource.companyName,
          type: referralSource.type,
          partnershipTier: referralSource.partnershipTier
        },
        summary,
        timeSeries: analyticsData
      }
    });
  } catch (err) {
    logger.error(`Error fetching referral source analytics: ${err.message}`);
    next(err);
  }
};

/**
 * Get top performing referral sources
 * GET /api/v1/referral-sources/top-performers
 * Access: Branch Manager, Admin
 */
exports.getTopPerformers = async (req, res, next) => {
  try {
    const { 
      startDate, 
      endDate, 
      metric = 'revenue.totalLoanVolume',
      limit = 10 
    } = req.query;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const topPerformers = await ReferralSourceAnalytics.getTopPerformers(
      start,
      end,
      metric,
      parseInt(limit)
    );

    res.json({
      success: true,
      data: topPerformers
    });
  } catch (err) {
    logger.error(`Error fetching top performers: ${err.message}`);
    next(err);
  }
};

/**
 * Update referral source branding
 * PATCH /api/v1/referral-sources/:id/branding
 * Access: Assigned LO, Branch Manager, Admin
 */
exports.updateBranding = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, { errors: errors.array() }));
    }

    const referralSource = await ReferralSource.findById(req.params.id);

    if (!referralSource) {
      return next(createError(404, 'Referral source not found'));
    }

    // Authorization check
    if ((req.user.role === roles.LO_RETAIL || req.user.role === roles.LO_TPO) &&
        referralSource.assignedLoanOfficer?.toString() !== req.user.userId) {
      return next(createError(403, 'Not authorized to update branding for this referral source'));
    }

    // Update branding fields
    if (req.body.branding) {
      referralSource.branding = { ...referralSource.branding, ...req.body.branding };
    }

    if (req.body.coBrandingSettings) {
      referralSource.coBrandingSettings = { ...referralSource.coBrandingSettings, ...req.body.coBrandingSettings };
    }

    referralSource.lastModifiedBy = req.user.userId;
    await referralSource.save();

    logger.info(`Referral source branding updated: ${referralSource._id} by user ${req.user.userId}`);

    res.json({
      success: true,
      data: {
        branding: referralSource.branding,
        coBrandingSettings: referralSource.coBrandingSettings
      }
    });
  } catch (err) {
    logger.error(`Error updating referral source branding: ${err.message}`);
    next(err);
  }
};

/**
 * Track referral source activity
 * POST /api/v1/referral-sources/:id/track
 * Access: System (internal use by other controllers)
 */
exports.trackActivity = async (req, res, next) => {
  try {
    const { activityType, loanAmount, productType } = req.body;

    const referralSource = await ReferralSource.findById(req.params.id);

    if (!referralSource) {
      return next(createError(404, 'Referral source not found'));
    }

    // Update counters based on activity type
    switch (activityType) {
      case 'lead':
        await referralSource.incrementLead();
        break;
      case 'application':
        await referralSource.incrementApplication();
        break;
      case 'preapproval':
        await referralSource.incrementPreapproval();
        break;
      case 'funded':
        await referralSource.incrementFundedLoan(loanAmount || 0);
        break;
      default:
        return next(createError(400, 'Invalid activity type'));
    }

    // Update time-series analytics
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const updateData = {};
    if (activityType === 'lead') updateData['leads.total'] = 1;
    if (activityType === 'application') updateData['applications.submitted'] = 1;
    if (activityType === 'preapproval') updateData['preapprovals.issued'] = 1;
    if (activityType === 'funded') {
      updateData['loans.funded'] = 1;
      updateData['revenue.totalLoanVolume'] = loanAmount || 0;
    }

    await ReferralSourceAnalytics.createOrUpdatePeriod(
      req.params.id,
      'daily',
      today,
      updateData
    );

    logger.info(`Referral source activity tracked: ${referralSource._id} - ${activityType}`);

    res.json({
      success: true,
      message: 'Activity tracked successfully',
      data: {
        analytics: referralSource.analytics
      }
    });
  } catch (err) {
    logger.error(`Error tracking referral source activity: ${err.message}`);
    next(err);
  }
};

/**
 * Get referral source branding configuration (public)
 * GET /api/v1/referral-sources/:id/branding
 * Access: Public (used for co-branded views)
 */
exports.getBranding = async (req, res, next) => {
  try {
    const referralSource = await ReferralSource.findById(req.params.id);

    if (!referralSource) {
      return next(createError(404, 'Referral source not found'));
    }

    if (referralSource.status !== 'active') {
      return next(createError(400, 'Referral source is not active'));
    }

    const brandingConfig = referralSource.getBrandingConfig();

    res.json({
      success: true,
      data: brandingConfig
    });
  } catch (err) {
    logger.error(`Error fetching referral source branding: ${err.message}`);
    next(err);
  }
};
