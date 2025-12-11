const cron = require('node-cron');
const DashboardMetric = require('../models/DashboardMetric');
const BranchPerformance = require('../models/BranchPerformance');
const LoanApplication = require('../models/LoanApplication');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Calculate user-level metrics for a given period
 */
async function calculateUserMetrics(userId, periodType, periodStart, periodEnd) {
  try {
    const user = await User.findById(userId);
    if (!user) return null;

    // Get all loans for this user in the period
    const loans = await LoanApplication.find({
      assignedOfficer: userId,
      createdAt: { $gte: periodStart, $lt: periodEnd }
    });

    const fundedLoans = loans.filter(l => l.status === 'funded');
    const preapprovals = loans.filter(l => l.milestones?.some(m => m.name === 'Preapproval Issued'));

    // Calculate metrics
    const metrics = {
      applications: {
        metricType: 'applications',
        value: loans.length,
        byProductType: calculateByProductType(loans),
        byLoanSource: calculateByLoanSource(loans)
      },
      preapprovals: {
        metricType: 'preapprovals',
        value: preapprovals.length
      },
      funding_rate: {
        metricType: 'funding_rate',
        value: loans.length > 0 ? (fundedLoans.length / loans.length) * 100 : 0
      },
      cycle_time: {
        metricType: 'cycle_time',
        value: calculateAvgCycleTime(fundedLoans)
      },
      avg_loan_amount: {
        metricType: 'avg_loan_amount',
        value: loans.length > 0 ? loans.reduce((sum, l) => sum + (l.loanAmount || 0), 0) / loans.length : 0
      },
      active_pipeline: {
        metricType: 'active_pipeline',
        value: await LoanApplication.countDocuments({
          assignedOfficer: userId,
          status: { $ne: 'funded' }
        })
      }
    };

    // Save each metric
    for (const [_key, metricData] of Object.entries(metrics)) {
      await DashboardMetric.findOneAndUpdate(
        {
          metricType: metricData.metricType,
          periodType,
          periodStart,
          user: userId,
          aggregationLevel: 'user'
        },
        {
          ...metricData,
          periodEnd,
          user: userId,
          branch: user.branch,
          region: user.region,
          aggregationLevel: 'user',
          totalCount: loans.length,
          totalVolume: loans.reduce((sum, l) => sum + (l.loanAmount || 0), 0),
          calculatedAt: new Date()
        },
        { upsert: true, new: true }
      );
    }

    logger.info('Calculated user metrics', {
      userId,
      periodType,
      applicationCount: loans.length
    });

    return metrics;
  } catch (error) {
    logger.error('Error calculating user metrics:', { userId, error: error.message });
    throw error;
  }
}

/**
 * Calculate branch-level performance
 */
async function calculateBranchPerformance(branchCode, periodType, periodStart, periodEnd) {
  try {
    // Get all users in this branch
    const branchUsers = await User.find({ branch: branchCode, isActive: true });
    const branchManager = branchUsers.find(u => u.role === 'branch_manager');

    const loanOfficers = branchUsers.filter(u => 
      u.role === 'loan_officer_retail' || u.role === 'loan_officer_tpo'
    );

    // Get all loans for this branch in the period
    const loans = await LoanApplication.find({
      assignedOfficer: { $in: loanOfficers.map(u => u._id) },
      createdAt: { $gte: periodStart, $lt: periodEnd }
    });

    const fundedLoans = loans.filter(l => l.status === 'funded');
    const preapprovals = loans.filter(l => l.milestones?.some(m => m.name === 'Preapproval Issued'));
    const activePipeline = await LoanApplication.find({
      assignedOfficer: { $in: loanOfficers.map(u => u._id) },
      status: { $ne: 'funded' }
    });

    // Build performance record
    const performance = {
      branchCode,
      branchName: branchCode, // Should pull from branch master data
      region: branchUsers[0]?.region,
      branchManager: branchManager?._id,
      periodType,
      periodStart,
      periodEnd,
      teamSize: {
        loanOfficers: loanOfficers.length,
        processors: branchUsers.filter(u => u.role === 'processor').length,
        total: branchUsers.length
      },
      applications: {
        total: loans.length,
        retail: loans.filter(l => l.source === 'retail').length,
        tpo: loans.filter(l => l.source === 'tpo').length,
        avgPerLO: loanOfficers.length > 0 ? loans.length / loanOfficers.length : 0
      },
      preapprovals: {
        total: preapprovals.length,
        issued: preapprovals.length,
        converted: fundedLoans.filter(l => l.milestones?.some(m => m.name === 'Preapproval Issued')).length,
        conversionRate: preapprovals.length > 0 ? (fundedLoans.length / preapprovals.length) * 100 : 0
      },
      pipeline: {
        activeLoans: activePipeline.length,
        totalVolume: activePipeline.reduce((sum, l) => sum + (l.loanAmount || 0), 0),
        avgLoanAmount: activePipeline.length > 0 ? 
          activePipeline.reduce((sum, l) => sum + (l.loanAmount || 0), 0) / activePipeline.length : 0,
        byStage: {
          application: activePipeline.filter(l => l.status === 'application').length,
          processing: activePipeline.filter(l => l.status === 'processing').length,
          underwriting: activePipeline.filter(l => l.status === 'underwriting').length,
          closing: activePipeline.filter(l => l.status === 'closing').length
        }
      },
      funded: {
        total: fundedLoans.length,
        totalVolume: fundedLoans.reduce((sum, l) => sum + (l.loanAmount || 0), 0),
        avgLoanAmount: fundedLoans.length > 0 ? 
          fundedLoans.reduce((sum, l) => sum + (l.loanAmount || 0), 0) / fundedLoans.length : 0,
        byProductType: calculateByProductType(fundedLoans)
      },
      fundingRate: loans.length > 0 ? (fundedLoans.length / loans.length) * 100 : 0,
      avgCycleTime: calculateAvgCycleTime(fundedLoans),
      pullThroughRate: activePipeline.length > 0 ? 
        (fundedLoans.length / (fundedLoans.length + activePipeline.length)) * 100 : 0,
      calculatedAt: new Date()
    };

    // Save to database
    await BranchPerformance.findOneAndUpdate(
      {
        branchCode,
        periodType,
        periodStart
      },
      performance,
      { upsert: true, new: true }
    );

    logger.info('Calculated branch performance', {
      branchCode,
      periodType,
      applications: loans.length,
      funded: fundedLoans.length
    });

    return performance;
  } catch (error) {
    logger.error('Error calculating branch performance:', { branchCode, error: error.message });
    throw error;
  }
}

/**
 * Calculate regional-level metrics
 */
async function calculateRegionalMetrics(region, periodType, periodStart, periodEnd) {
  try {
    // Get all branches in this region
    const branches = await BranchPerformance.find({
      region,
      periodType,
      periodStart
    });

    // Aggregate branch data to regional level
    const regionalMetrics = {
      applications: {
        metricType: 'applications',
        value: branches.reduce((sum, b) => sum + b.applications.total, 0)
      },
      funding_rate: {
        metricType: 'funding_rate',
        value: branches.length > 0 ? 
          branches.reduce((sum, b) => sum + b.fundingRate, 0) / branches.length : 0
      },
      avg_loan_amount: {
        metricType: 'avg_loan_amount',
        value: branches.length > 0 ?
          branches.reduce((sum, b) => sum + b.funded.avgLoanAmount, 0) / branches.length : 0
      }
    };

    // Save regional metrics
    for (const [_key, metricData] of Object.entries(regionalMetrics)) {
      await DashboardMetric.findOneAndUpdate(
        {
          metricType: metricData.metricType,
          periodType,
          periodStart,
          region,
          aggregationLevel: 'region'
        },
        {
          ...metricData,
          periodEnd,
          region,
          aggregationLevel: 'region',
          totalCount: branches.length,
          calculatedAt: new Date()
        },
        { upsert: true, new: true }
      );
    }

    logger.info('Calculated regional metrics', {
      region,
      periodType,
      branchCount: branches.length
    });

    return regionalMetrics;
  } catch (error) {
    logger.error('Error calculating regional metrics:', { region, error: error.message });
    throw error;
  }
}

/**
 * Run daily metrics aggregation
 */
async function runDailyAggregation() {
  logger.info('Starting daily metrics aggregation');

  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    // Get all active loan officers
    const loanOfficers = await User.find({
      role: { $in: ['loan_officer_retail', 'loan_officer_tpo'] },
      isActive: true
    });

    // Calculate metrics for each LO
    for (const lo of loanOfficers) {
      try {
        await calculateUserMetrics(lo._id, 'daily', today, tomorrow);
      } catch (error) {
        logger.error('Failed to calculate metrics for user:', { userId: lo._id, error: error.message });
      }
    }

    // Get all unique branches
    const branches = [...new Set(loanOfficers.map(u => u.branch).filter(Boolean))];

    // Calculate branch performance
    for (const branch of branches) {
      try {
        await calculateBranchPerformance(branch, 'daily', today, tomorrow);
      } catch (error) {
        logger.error('Failed to calculate branch performance:', { branch, error: error.message });
      }
    }

    // Get all unique regions
    const regions = [...new Set(loanOfficers.map(u => u.region).filter(Boolean))];

    // Calculate regional metrics
    for (const region of regions) {
      try {
        await calculateRegionalMetrics(region, 'daily', today, tomorrow);
      } catch (error) {
        logger.error('Failed to calculate regional metrics:', { region, error: error.message });
      }
    }

    logger.info('Daily metrics aggregation completed', {
      userCount: loanOfficers.length,
      branchCount: branches.length,
      regionCount: regions.length
    });
  } catch (error) {
    logger.error('Error in daily aggregation:', error);
    throw error;
  }
}

/**
 * Run monthly metrics aggregation
 */
async function runMonthlyAggregation() {
  logger.info('Starting monthly metrics aggregation');

  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Get all active loan officers
    const loanOfficers = await User.find({
      role: { $in: ['loan_officer_retail', 'loan_officer_tpo'] },
      isActive: true
    });

    // Calculate monthly metrics for each LO
    for (const lo of loanOfficers) {
      try {
        await calculateUserMetrics(lo._id, 'monthly', monthStart, monthEnd);
      } catch (error) {
        logger.error('Failed to calculate monthly metrics for user:', { userId: lo._id, error: error.message });
      }
    }

    // Calculate monthly branch performance
    const branches = [...new Set(loanOfficers.map(u => u.branch).filter(Boolean))];
    for (const branch of branches) {
      try {
        await calculateBranchPerformance(branch, 'monthly', monthStart, monthEnd);
      } catch (error) {
        logger.error('Failed to calculate monthly branch performance:', { branch, error: error.message });
      }
    }

    logger.info('Monthly metrics aggregation completed');
  } catch (error) {
    logger.error('Error in monthly aggregation:', error);
    throw error;
  }
}

/**
 * Helper: Calculate product type breakdown
 */
function calculateByProductType(loans) {
  return {
    conventional: loans.filter(l => l.productType === 'conventional').length,
    fha: loans.filter(l => l.productType === 'fha').length,
    va: loans.filter(l => l.productType === 'va').length,
    usda: loans.filter(l => l.productType === 'usda').length,
    jumbo: loans.filter(l => l.productType === 'jumbo').length
  };
}

/**
 * Helper: Calculate loan source breakdown
 */
function calculateByLoanSource(loans) {
  return {
    retail: loans.filter(l => l.source === 'retail').length,
    tpo: loans.filter(l => l.source === 'tpo').length,
    referral: loans.filter(l => l.referralSource).length
  };
}

/**
 * Helper: Calculate average cycle time (app to close)
 */
function calculateAvgCycleTime(fundedLoans) {
  if (fundedLoans.length === 0) return 0;

  const cycleTimes = fundedLoans.map(loan => {
    const closeDate = loan.updatedAt; // Should use actual close date
    const appDate = loan.createdAt;
    return (closeDate - appDate) / (1000 * 60 * 60 * 24); // Days
  });

  return cycleTimes.reduce((sum, t) => sum + t, 0) / cycleTimes.length;
}

/**
 * Start metrics aggregation scheduler
 */
function startMetricsAggregationScheduler() {
  logger.info('Starting metrics aggregation scheduler');

  // Daily aggregation at 1 AM
  cron.schedule('0 1 * * *', async () => {
    logger.info('Running scheduled daily metrics aggregation');
    try {
      await runDailyAggregation();
    } catch (error) {
      logger.error('Scheduled daily aggregation failed:', error);
    }
  });

  // Monthly aggregation on 1st of month at 2 AM
  cron.schedule('0 2 1 * *', async () => {
    logger.info('Running scheduled monthly metrics aggregation');
    try {
      await runMonthlyAggregation();
    } catch (error) {
      logger.error('Scheduled monthly aggregation failed:', error);
    }
  });

  // Initial run after 2 minutes
  setTimeout(async () => {
    logger.info('Running initial metrics aggregation after startup');
    try {
      await runDailyAggregation();
    } catch (error) {
      logger.error('Initial aggregation failed:', error);
    }
  }, 2 * 60 * 1000);

  logger.info('Metrics aggregation scheduler started successfully');
}

module.exports = {
  startMetricsAggregationScheduler,
  calculateUserMetrics,
  calculateBranchPerformance,
  calculateRegionalMetrics,
  runDailyAggregation,
  runMonthlyAggregation
};
