const PersonaView = require('../models/PersonaView');
const ConsentManagement = require('../models/ConsentManagement');
const createError = require('http-errors');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

/**
 * @desc    Get user's persona view configuration
 * @route   GET /api/v1/persona-views/me
 * @access  Private
 */
exports.getMyView = async (req, res, next) => {
  try {
    let view = await PersonaView.findOne({ user: req.user.userId });

    // Create default view if not exists
    if (!view) {
      const defaultConfig = PersonaView.getDefaultConfig(req.user.role);
      view = await PersonaView.create({
        user: req.user.userId,
        role: req.user.role,
        viewConfiguration: defaultConfig
      });
    }

    res.json({
      success: true,
      data: { view }
    });
  } catch (error) {
    logger.error('Error fetching persona view:', error);
    next(error);
  }
};

/**
 * @desc    Update user's persona view configuration
 * @route   PATCH /api/v1/persona-views/me
 * @access  Private
 */
exports.updateMyView = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, { errors: errors.array() }));
    }

    const { viewConfiguration } = req.body;

    let view = await PersonaView.findOne({ user: req.user.userId });

    if (!view) {
      // Create new view
      view = await PersonaView.create({
        user: req.user.userId,
        role: req.user.role,
        viewConfiguration
      });
    } else {
      // Update existing view
      view.viewConfiguration = {
        ...view.viewConfiguration,
        ...viewConfiguration
      };
      view.lastUpdated = new Date();
      await view.save();
    }

    logger.info('Persona view updated', {
      userId: req.user.userId,
      role: req.user.role
    });

    res.json({
      success: true,
      data: { view },
      message: 'View configuration updated successfully'
    });
  } catch (error) {
    logger.error('Error updating persona view:', error);
    next(error);
  }
};

/**
 * @desc    Reset persona view to default
 * @route   POST /api/v1/persona-views/me/reset
 * @access  Private
 */
exports.resetToDefault = async (req, res, next) => {
  try {
    const defaultConfig = PersonaView.getDefaultConfig(req.user.role);

    let view = await PersonaView.findOne({ user: req.user.userId });

    if (!view) {
      view = await PersonaView.create({
        user: req.user.userId,
        role: req.user.role,
        viewConfiguration: defaultConfig
      });
    } else {
      view.viewConfiguration = defaultConfig;
      view.lastUpdated = new Date();
      await view.save();
    }

    logger.info('Persona view reset to default', {
      userId: req.user.userId,
      role: req.user.role
    });

    res.json({
      success: true,
      data: { view },
      message: 'View configuration reset to default'
    });
  } catch (error) {
    logger.error('Error resetting persona view:', error);
    next(error);
  }
};

/**
 * @desc    Get dashboard data with persona-specific filtering
 * @route   GET /api/v1/persona-views/dashboard
 * @access  Private
 */
exports.getDashboardData = async (req, res, next) => {
  try {
    // Get persona view configuration
    let view = await PersonaView.findOne({ user: req.user.userId });
    if (!view) {
      const defaultConfig = PersonaView.getDefaultConfig(req.user.role);
      view = await PersonaView.create({
        user: req.user.userId,
        role: req.user.role,
        viewConfiguration: defaultConfig
      });
    }

    const dashboardData = {};

    // Apply role-based filtering
    switch (req.user.role) {
      case 'borrower':
        dashboardData.myLoans = await exports.getBorrowerDashboard(req.user.userId, view);
        break;

      case 'loan_officer_retail':
      case 'loan_officer_tpo':
        dashboardData.pipeline = await exports.getLODashboard(req.user.userId, view);
        break;

      case 'realtor':
        dashboardData.referrals = await exports.getRealtorDashboard(req.user.userId, view);
        break;

      case 'broker':
        dashboardData.submissions = await exports.getBrokerDashboard(req.user.userId, view);
        break;

      case 'branch_manager':
        dashboardData.branch = await exports.getBMDashboard(req.user.userId, view);
        break;

      case 'admin':
        dashboardData.overview = await exports.getAdminDashboard(req.user.userId, view);
        break;

      default:
        return next(createError(400, 'Invalid user role'));
    }

    res.json({
      success: true,
      data: {
        dashboardData,
        viewConfiguration: view.viewConfiguration
      }
    });
  } catch (error) {
    logger.error('Error fetching dashboard data:', error);
    next(error);
  }
};

/**
 * Get borrower-specific dashboard data
 */
exports.getBorrowerDashboard = async function(userId, _view) {
  const LoanApplication = require('../models/LoanApplication');
  const Document = require('../models/Document');

  const loans = await LoanApplication.find({ borrower: userId })
    .populate('assignedOfficer', 'name email phone')
    .sort({ createdAt: -1 })
    .limit(10);

  const documents = await Document.find({ loan: { $in: loans.map(l => l._id) } })
    .sort({ uploadedAt: -1 })
    .limit(10);

  return {
    loans,
    documents,
    stats: {
      totalLoans: loans.length,
      activeLoans: loans.filter(l => l.status !== 'funded' && l.status !== 'denied').length,
      documentsUploaded: documents.length
    }
  };
};

/**
 * Get LO-specific dashboard data
 */
exports.getLODashboard = async function(userId, view) {
  const LoanApplication = require('../models/LoanApplication');

  const query = { assignedOfficer: userId };

  // Apply default filters from view configuration
  if (view.viewConfiguration?.dashboard?.defaultFilters) {
    const filters = view.viewConfiguration.dashboard.defaultFilters;
    
    if (filters.status?.length > 0) {
      query.status = { $in: filters.status };
    }
    
    if (filters.loanType?.length > 0) {
      query.loanType = { $in: filters.loanType };
    }
  }

  const loans = await LoanApplication.find(query)
    .populate('borrower', 'name email phone')
    .sort({ createdAt: -1 })
    .limit(50);

  const stats = {
    totalPipeline: loans.length,
    totalVolume: loans.reduce((sum, loan) => sum + (loan.loanAmount || 0), 0),
    byStatus: {},
    byStage: {}
  };

  loans.forEach(loan => {
    stats.byStatus[loan.status] = (stats.byStatus[loan.status] || 0) + 1;
  });

  return { loans, stats };
};

/**
 * Get realtor-specific dashboard data
 */
exports.getRealtorDashboard = async function(userId, _view) {
  const LoanApplication = require('../models/LoanApplication');

  // Find loans where realtor has consent
  const consents = await ConsentManagement.find({
    grantedTo: userId,
    grantedToRole: 'realtor',
    status: 'active',
    expiresAt: { $gt: new Date() }
  }).select('loan');

  const loanIds = consents.map(c => c.loan).filter(Boolean);

  const loans = await LoanApplication.find({ _id: { $in: loanIds } })
    .populate('borrower', 'name email')
    .populate('assignedOfficer', 'name email phone')
    .sort({ createdAt: -1 });

  const stats = {
    activeReferrals: loans.filter(l => l.status !== 'funded' && l.status !== 'denied').length,
    closedLoans: loans.filter(l => l.status === 'funded').length,
    totalVolume: loans.reduce((sum, loan) => sum + (loan.loanAmount || 0), 0)
  };

  return { loans, stats };
};

/**
 * Get broker-specific dashboard data
 */
exports.getBrokerDashboard = async function(userId, _view) {
  const LoanApplication = require('../models/LoanApplication');

  const loans = await LoanApplication.find({
    broker: userId
  })
    .populate('borrower', 'name email')
    .populate('assignedOfficer', 'name email phone')
    .sort({ createdAt: -1 })
    .limit(50);

  const stats = {
    submissions: loans.length,
    approved: loans.filter(l => l.status === 'approved').length,
    inProcess: loans.filter(l => !['funded', 'denied', 'withdrawn'].includes(l.status)).length,
    totalVolume: loans.reduce((sum, loan) => sum + (loan.loanAmount || 0), 0)
  };

  return { loans, stats };
};

/**
 * Get branch manager-specific dashboard data
 */
exports.getBMDashboard = async function(userId, _view) {
  const LoanApplication = require('../models/LoanApplication');
  const User = require('../models/User');

  // Get branch manager's branch
  const bm = await User.findById(userId);
  const branchName = bm.branch?.name;

  if (!branchName) {
    return { loans: [], stats: {}, teamMembers: [] };
  }

  // Get all LOs in the branch
  const teamMembers = await User.find({
    role: { $in: ['loan_officer_retail', 'loan_officer_tpo'] },
    'branch.name': branchName
  });

  const teamIds = teamMembers.map(m => m._id);

  const loans = await LoanApplication.find({
    assignedOfficer: { $in: teamIds }
  })
    .populate('borrower', 'name email')
    .populate('assignedOfficer', 'name email')
    .sort({ createdAt: -1 })
    .limit(100);

  const stats = {
    totalPipeline: loans.length,
    totalVolume: loans.reduce((sum, loan) => sum + (loan.loanAmount || 0), 0),
    teamSize: teamMembers.length,
    byLO: {}
  };

  teamMembers.forEach(member => {
    const memberLoans = loans.filter(l => l.assignedOfficer?._id.toString() === member._id.toString());
    stats.byLO[member.name] = {
      count: memberLoans.length,
      volume: memberLoans.reduce((sum, loan) => sum + (loan.loanAmount || 0), 0)
    };
  });

  return { loans, stats, teamMembers };
};

/**
 * Get admin-specific dashboard data
 */
exports.getAdminDashboard = async function(_userId, _view) {
  const LoanApplication = require('../models/LoanApplication');
  const User = require('../models/User');

  const loans = await LoanApplication.find({})
    .populate('borrower', 'name email')
    .populate('assignedOfficer', 'name email')
    .sort({ createdAt: -1 })
    .limit(100);

  const users = await User.countDocuments();
  const activeLoans = await LoanApplication.countDocuments({
    status: { $nin: ['funded', 'denied', 'withdrawn'] }
  });

  const stats = {
    totalUsers: users,
    totalLoans: loans.length,
    activeLoans,
    totalVolume: loans.reduce((sum, loan) => sum + (loan.loanAmount || 0), 0)
  };

  return { loans, stats };
};
