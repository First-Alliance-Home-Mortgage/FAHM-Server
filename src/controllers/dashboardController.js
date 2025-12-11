const createError = require('http-errors');
const { validationResult } = require('express-validator');
const DashboardReport = require('../models/DashboardReport');
const DashboardMetric = require('../models/DashboardMetric');
const BranchPerformance = require('../models/BranchPerformance');
const LoanApplication = require('../models/LoanApplication');
const User = require('../models/User');
const powerBIService = require('../services/powerBIService');
const logger = require('../utils/logger');
const roles = require('../config/roles');

/**
 * Get available dashboard reports for user
 * GET /api/v1/dashboard/reports
 */
exports.getAvailableReports = async (req, res, next) => {
  try {
    const userRole = req.user.role;

    const reports = await DashboardReport.find({
      isActive: true,
      allowedRoles: userRole
    }).sort({ reportType: 1 });

    logger.info('Retrieved available dashboard reports', {
      userId: req.user._id,
      count: reports.length
    });

    res.json({
      success: true,
      data: reports
    });
  } catch (error) {
    logger.error('Error retrieving available reports:', error);
    next(error);
  }
};

/**
 * Get Power BI embed configuration for report
 * GET /api/v1/dashboard/reports/:reportId/embed
 */
exports.getReportEmbedConfig = async (req, res, next) => {
  try {
    const { reportId } = req.params;

    const report = await DashboardReport.findById(reportId);
    if (!report) {
      return next(createError(404, 'Dashboard report not found'));
    }

    // Check if user has access to this report
    if (!report.allowedRoles.includes(req.user.role)) {
      return next(createError(403, 'Access denied to this report'));
    }

    // Get embed config from Power BI
    const embedConfig = await powerBIService.getEmbedConfig(
      report.powerBIReportId,
      'view'
    );

    // Apply user-specific filters
    const filters = [];

    // Filter by user for personal reports
    if (report.accessLevel === 'personal') {
      filters.push(powerBIService.createReportFilter(
        'LoanApplications',
        'AssignedOfficerId',
        [req.user._id.toString()]
      ));
    }

    // Filter by branch for branch-level reports
    if (report.accessLevel === 'branch' && req.user.branch) {
      filters.push(powerBIService.createReportFilter(
        'LoanApplications',
        'Branch',
        [req.user.branch]
      ));
    }

    // Filter by region for regional reports
    if (report.accessLevel === 'regional' && req.user.region) {
      filters.push(powerBIService.createReportFilter(
        'LoanApplications',
        'Region',
        [req.user.region]
      ));
    }

    embedConfig.filters = filters;

    logger.info('Generated Power BI embed config', {
      userId: req.user._id,
      reportId: report._id,
      powerBIReportId: report.powerBIReportId
    });

    res.json({
      success: true,
      data: embedConfig
    });
  } catch (error) {
    logger.error('Error generating embed config:', error);
    next(error);
  }
};

/**
 * Get dashboard metrics/KPIs for user
 * GET /api/v1/dashboard/metrics
 */
exports.getMetrics = async (req, res, next) => {
  try {
    const {
      metricType,
      periodType = 'monthly',
      startDate,
      endDate,
      aggregationLevel
    } = req.query;

    const query = {};

    if (metricType) {
      query.metricType = metricType;
    }

    if (periodType) {
      query.periodType = periodType;
    }

    // Date range filter
    if (startDate || endDate) {
      query.periodStart = {};
      if (startDate) {
        query.periodStart.$gte = new Date(startDate);
      }
      if (endDate) {
        query.periodStart.$lte = new Date(endDate);
      }
    }

    // User-specific or branch/regional based on role
    if (req.user.role === roles.LO_RETAIL || req.user.role === roles.LO_TPO) {
      query.user = req.user._id;
      query.aggregationLevel = 'user';
    } else if (req.user.role === roles.BRANCH_MANAGER) {
      if (aggregationLevel === 'user') {
        // BM can see individual LO metrics in their branch
        query.branch = req.user.branch;
        query.aggregationLevel = 'user';
      } else {
        query.branch = req.user.branch;
        query.aggregationLevel = 'branch';
      }
    } else if (req.user.role === roles.ADMIN) {
      // Admin can see any aggregation level
      if (aggregationLevel) {
        query.aggregationLevel = aggregationLevel;
      }
    }

    const metrics = await DashboardMetric.find(query)
      .populate('user', 'name email role branch')
      .sort({ periodStart: -1 })
      .limit(100);

    logger.info('Retrieved dashboard metrics', {
      userId: req.user._id,
      count: metrics.length
    });

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error('Error retrieving metrics:', error);
    next(error);
  }
};

/**
 * Get branch performance summary
 * GET /api/v1/dashboard/branch-performance
 */
exports.getBranchPerformance = async (req, res, next) => {
  try {
    const {
      branchCode,
      region,
      periodType = 'monthly',
      startDate,
      endDate
    } = req.query;

    const query = {};

    // Access control: BM sees their branch, Admin sees all
    if (req.user.role === roles.BRANCH_MANAGER) {
      query.branchCode = req.user.branch;
    } else if (req.user.role !== roles.ADMIN) {
      return next(createError(403, 'Access denied to branch performance data'));
    }

    if (branchCode) {
      query.branchCode = branchCode;
    }

    if (region) {
      query.region = region;
    }

    if (periodType) {
      query.periodType = periodType;
    }

    // Date range
    if (startDate || endDate) {
      query.periodStart = {};
      if (startDate) {
        query.periodStart.$gte = new Date(startDate);
      }
      if (endDate) {
        query.periodStart.$lte = new Date(endDate);
      }
    }

    const performance = await BranchPerformance.find(query)
      .populate('branchManager', 'name email')
      .sort({ periodStart: -1 })
      .limit(50);

    logger.info('Retrieved branch performance data', {
      userId: req.user._id,
      count: performance.length
    });

    res.json({
      success: true,
      data: performance
    });
  } catch (error) {
    logger.error('Error retrieving branch performance:', error);
    next(error);
  }
};

/**
 * Get user's personal KPI summary
 * GET /api/v1/dashboard/my-kpis
 */
exports.getMyKPIs = async (req, res, next) => {
  try {
    const { periodType = 'monthly' } = req.query;

    // Calculate current period dates
    const now = new Date();
    let periodStart, periodEnd;

    if (periodType === 'daily') {
      periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    } else if (periodType === 'weekly') {
      const day = now.getDay();
      periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
      periodEnd = new Date(periodStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    } else {
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }

    // Fetch metrics for current period
    const metrics = await DashboardMetric.find({
      user: req.user._id,
      aggregationLevel: 'user',
      periodType,
      periodStart: { $gte: periodStart, $lt: periodEnd }
    });

    // Calculate real-time pipeline stats
    const pipelineStats = await LoanApplication.aggregate([
      {
        $match: {
          assignedOfficer: req.user._id,
          status: { $ne: 'funded' }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalVolume: { $sum: '$loanAmount' }
        }
      }
    ]);

    // Build KPI summary
    const kpis = {
      applications: metrics.find(m => m.metricType === 'applications')?.value || 0,
      preapprovals: metrics.find(m => m.metricType === 'preapprovals')?.value || 0,
      fundingRate: metrics.find(m => m.metricType === 'funding_rate')?.value || 0,
      avgCycleTime: metrics.find(m => m.metricType === 'cycle_time')?.value || 0,
      activePipeline: {
        total: pipelineStats.reduce((sum, s) => sum + s.count, 0),
        volume: pipelineStats.reduce((sum, s) => sum + s.totalVolume, 0),
        byStage: pipelineStats.reduce((acc, s) => {
          acc[s._id] = { count: s.count, volume: s.totalVolume };
          return acc;
        }, {})
      },
      periodType,
      periodStart,
      periodEnd
    };

    logger.info('Retrieved user KPIs', {
      userId: req.user._id,
      periodType
    });

    res.json({
      success: true,
      data: kpis
    });
  } catch (error) {
    logger.error('Error retrieving user KPIs:', error);
    next(error);
  }
};

/**
 * Refresh Power BI dataset
 * POST /api/v1/dashboard/reports/:reportId/refresh
 */
exports.refreshReport = async (req, res, next) => {
  try {
    const { reportId } = req.params;

    // Only admins and BMs can trigger refreshes
    if (req.user.role !== roles.ADMIN && req.user.role !== roles.BRANCH_MANAGER) {
      return next(createError(403, 'Access denied to refresh reports'));
    }

    const report = await DashboardReport.findById(reportId);
    if (!report) {
      return next(createError(404, 'Dashboard report not found'));
    }

    // Trigger refresh in Power BI
    await powerBIService.refreshDataset(report.powerBIDatasetId);

    // Update last refreshed timestamp
    report.lastRefreshed = new Date();
    await report.save();

    logger.info('Power BI dataset refresh triggered', {
      userId: req.user._id,
      reportId: report._id,
      datasetId: report.powerBIDatasetId
    });

    res.json({
      success: true,
      message: 'Dataset refresh triggered',
      lastRefreshed: report.lastRefreshed
    });
  } catch (error) {
    logger.error('Error refreshing dataset:', error);
    next(error);
  }
};

/**
 * Get regional performance summary (Admin/Executive only)
 * GET /api/v1/dashboard/regional-performance
 */
exports.getRegionalPerformance = async (req, res, next) => {
  try {
    if (req.user.role !== roles.ADMIN) {
      return next(createError(403, 'Access denied to regional performance data'));
    }

    const { periodType = 'monthly', startDate, endDate } = req.query;

    const query = {
      aggregationLevel: 'region',
      periodType
    };

    if (startDate || endDate) {
      query.periodStart = {};
      if (startDate) {
        query.periodStart.$gte = new Date(startDate);
      }
      if (endDate) {
        query.periodStart.$lte = new Date(endDate);
      }
    }

    const regionalData = await DashboardMetric.find(query)
      .sort({ region: 1, periodStart: -1 });

    // Group by region
    const byRegion = regionalData.reduce((acc, metric) => {
      if (!acc[metric.region]) {
        acc[metric.region] = [];
      }
      acc[metric.region].push(metric);
      return acc;
    }, {});

    logger.info('Retrieved regional performance data', {
      userId: req.user._id,
      regionCount: Object.keys(byRegion).length
    });

    res.json({
      success: true,
      data: byRegion
    });
  } catch (error) {
    logger.error('Error retrieving regional performance:', error);
    next(error);
  }
};

/**
 * Get leaderboard (top performing LOs)
 * GET /api/v1/dashboard/leaderboard
 */
exports.getLeaderboard = async (req, res, next) => {
  try {
    const { metricType = 'applications', periodType = 'monthly', limit = 10 } = req.query;

    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const leaderboard = await DashboardMetric.find({
      metricType,
      periodType,
      aggregationLevel: 'user',
      periodStart: { $gte: periodStart }
    })
      .populate('user', 'name email branch region')
      .sort({ value: -1 })
      .limit(parseInt(limit));

    logger.info('Retrieved leaderboard', {
      userId: req.user._id,
      metricType,
      count: leaderboard.length
    });

    res.json({
      success: true,
      data: leaderboard
    });
  } catch (error) {
    logger.error('Error retrieving leaderboard:', error);
    next(error);
  }
};

module.exports = exports;
