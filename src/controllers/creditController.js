const createError = require('http-errors');
const { validationResult } = require('express-validator');
const xactusService = require('../services/xactusService');
const CreditReport = require('../models/CreditReport');
const CreditPullLog = require('../models/CreditPullLog');
const LoanApplication = require('../models/LoanApplication');
const User = require('../models/User');
const Notification = require('../models/Notification');
const logger = require('../utils/logger');

/**
 * Request tri-merge credit report for a borrower
 */
exports.requestCreditReport = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, { errors: errors.array() }));
    }

    const { loanId } = req.params;
    const { 
      borrowerId, 
      pullType = 'hard', 
      purpose = 'preapproval',
      borrowerConsent 
    } = req.body;

    // Validate borrower consent
    if (!borrowerConsent || !borrowerConsent.obtained) {
      return next(createError(400, 'Borrower consent is required for credit pull'));
    }

    // Validate loan
    const loan = await LoanApplication.findById(loanId);
    if (!loan) {
      return next(createError(404, 'Loan not found'));
    }

    // Validate borrower
    const borrower = await User.findById(borrowerId);
    if (!borrower) {
      return next(createError(404, 'Borrower not found'));
    }

    // Create credit pull log
    const pullLog = await CreditPullLog.create({
      loan: loanId,
      borrower: borrowerId,
      requestedBy: req.user.id,
      pullType,
      purpose,
      borrowerConsent: {
        obtained: borrowerConsent.obtained,
        consentDate: borrowerConsent.consentDate || new Date(),
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    try {
      // Request credit report from Xactus
      const xactusResponse = await xactusService.requestTriMergeReport({
        firstName: borrower.name.split(' ')[0],
        lastName: borrower.name.split(' ').slice(1).join(' '),
        ssn: req.body.ssn, // SSN should be provided in request (not stored in User model)
        dateOfBirth: req.body.dateOfBirth,
        address: req.body.address,
        purpose
      });

      // Create credit report record
      const creditReport = new CreditReport({
        loan: loanId,
        borrower: borrowerId,
        requestedBy: req.user.id,
        xactusReportId: xactusResponse.xactusReportId,
        reportType: xactusResponse.reportData.reportType,
        status: xactusResponse.status === 'completed' ? 'completed' : 'pending',
        scores: xactusResponse.reportData.scores,
        tradelines: xactusResponse.reportData.tradelines,
        publicRecords: xactusResponse.reportData.publicRecords,
        inquiries: xactusResponse.reportData.inquiries,
        summary: xactusResponse.reportData.summary
      });

      // Calculate mid score
      creditReport.calculateMidScore();

      // Encrypt and store raw data
      creditReport.encryptSensitiveData(xactusResponse.reportData.rawData);

      await creditReport.save();

      // Update pull log
      pullLog.status = 'completed';
      pullLog.creditReport = creditReport._id;
      pullLog.xactusTransactionId = xactusResponse.transactionId;
      await pullLog.save();

      // Notify loan officer
      await exports.notifyLoanOfficer(loan, borrower, creditReport);

      logger.info('Credit report requested successfully', {
        loanId,
        borrowerId,
        reportId: creditReport._id,
        midScore: creditReport.midScore
      });

      res.status(201).json({
        message: 'Credit report requested successfully',
        creditReport: {
          _id: creditReport._id,
          xactusReportId: creditReport.xactusReportId,
          status: creditReport.status,
          scores: creditReport.scores,
          midScore: creditReport.midScore,
          summary: creditReport.summary,
          createdAt: creditReport.createdAt,
          expiresAt: creditReport.expiresAt
        }
      });
    } catch (error) {
      // Update pull log with failure
      pullLog.status = 'failed';
      pullLog.errorMessage = error.message;
      await pullLog.save();

      throw error;
    }
  } catch (error) {
    logger.error('Failed to request credit report', { error: error.message });
    next(createError(500, 'Failed to request credit report'));
  }
};

/**
 * Get credit report by ID
 */
exports.getCreditReport = async (req, res, next) => {
  try {
    const { reportId } = req.params;
    const { includeRawData = false } = req.query;

    let query = CreditReport.findById(reportId)
      .populate('borrower', 'name email')
      .populate('loan', 'amount propertyAddress status')
      .populate('requestedBy', 'name email');

    // Include encrypted raw data only if explicitly requested
    if (includeRawData === 'true') {
      query = query.select('+encryptedData +encryptionIV');
    }

    const creditReport = await query;

    if (!creditReport) {
      return next(createError(404, 'Credit report not found'));
    }

    // Check authorization
    const canAccess = 
      req.user.id === creditReport.borrower._id.toString() ||
      req.user.id === creditReport.requestedBy._id.toString() ||
      req.user.id === creditReport.loan.assignedOfficer?.toString() ||
      ['admin', 'loan_officer_retail', 'loan_officer_tpo'].includes(req.user.role?.slug);

    if (!canAccess) {
      return next(createError(403, 'Access denied'));
    }

    const response = {
      creditReport: {
        _id: creditReport._id,
        xactusReportId: creditReport.xactusReportId,
        reportType: creditReport.reportType,
        status: creditReport.status,
        scores: creditReport.scores,
        midScore: creditReport.midScore,
        tradelines: creditReport.tradelines,
        publicRecords: creditReport.publicRecords,
        inquiries: creditReport.inquiries,
        summary: creditReport.summary,
        borrower: creditReport.borrower,
        loan: creditReport.loan,
        requestedBy: creditReport.requestedBy,
        createdAt: creditReport.createdAt,
        expiresAt: creditReport.expiresAt
      }
    };

    // Decrypt raw data if requested and user has permission
    if (includeRawData === 'true' && ['admin', 'loan_officer_retail', 'loan_officer_tpo'].includes(req.user.role?.slug)) {
      response.creditReport.rawData = creditReport.decryptSensitiveData();
    }

    res.json(response);
  } catch (error) {
    logger.error('Failed to get credit report', { error: error.message });
    next(createError(500, 'Failed to retrieve credit report'));
  }
};

/**
 * Get all credit reports for a loan
 */
exports.getCreditReportsForLoan = async (req, res, next) => {
  try {
    const { loanId } = req.params;

    const loan = await LoanApplication.findById(loanId);
    if (!loan) {
      return next(createError(404, 'Loan not found'));
    }

    // Check authorization
    const canAccess = 
      req.user.id === loan.borrower?.toString() ||
      req.user.id === loan.assignedOfficer?.toString() ||
      ['admin', 'loan_officer_retail', 'loan_officer_tpo'].includes(req.user.role?.slug);

    if (!canAccess) {
      return next(createError(403, 'Access denied'));
    }

    const creditReports = await CreditReport.find({ loan: loanId })
      .populate('borrower', 'name email')
      .populate('requestedBy', 'name email')
      .sort('-createdAt');

    res.json({
      loan: loanId,
      creditReports: creditReports.map(report => ({
        _id: report._id,
        xactusReportId: report.xactusReportId,
        reportType: report.reportType,
        status: report.status,
        midScore: report.midScore,
        borrower: report.borrower,
        requestedBy: report.requestedBy,
        createdAt: report.createdAt,
        expiresAt: report.expiresAt
      }))
    });
  } catch (error) {
    logger.error('Failed to get credit reports for loan', { error: error.message });
    next(createError(500, 'Failed to retrieve credit reports'));
  }
};

/**
 * Reissue/refresh credit report
 */
exports.reissueCreditReport = async (req, res, next) => {
  try {
    const { reportId } = req.params;

    const existingReport = await CreditReport.findById(reportId);
    if (!existingReport) {
      return next(createError(404, 'Credit report not found'));
    }

    // Create new pull log
    const pullLog = await CreditPullLog.create({
      loan: existingReport.loan,
      borrower: existingReport.borrower,
      requestedBy: req.user.id,
      pullType: 'hard',
      purpose: 'reissue'
    });

    try {
      // Request reissue from Xactus
      const xactusResponse = await xactusService.reissueReport(existingReport.xactusReportId);

      // Create new credit report record
      const newReport = new CreditReport({
        loan: existingReport.loan,
        borrower: existingReport.borrower,
        requestedBy: req.user.id,
        xactusReportId: xactusResponse.xactusReportId,
        reportType: xactusResponse.reportData.reportType,
        status: xactusResponse.status === 'completed' ? 'completed' : 'pending',
        scores: xactusResponse.reportData.scores,
        tradelines: xactusResponse.reportData.tradelines,
        publicRecords: xactusResponse.reportData.publicRecords,
        inquiries: xactusResponse.reportData.inquiries,
        summary: xactusResponse.reportData.summary
      });

      newReport.calculateMidScore();
      newReport.encryptSensitiveData(xactusResponse.reportData.rawData);
      await newReport.save();

      // Update pull log
      pullLog.status = 'completed';
      pullLog.creditReport = newReport._id;
      pullLog.xactusTransactionId = xactusResponse.transactionId;
      await pullLog.save();

      // Notify loan officer
      const loan = await LoanApplication.findById(existingReport.loan);
      const borrower = await User.findById(existingReport.borrower);
      await exports.notifyLoanOfficer(loan, borrower, newReport);

      logger.info('Credit report reissued successfully', {
        oldReportId: reportId,
        newReportId: newReport._id
      });

      res.json({
        message: 'Credit report reissued successfully',
        creditReport: {
          _id: newReport._id,
          xactusReportId: newReport.xactusReportId,
          status: newReport.status,
          scores: newReport.scores,
          midScore: newReport.midScore,
          summary: newReport.summary,
          createdAt: newReport.createdAt
        }
      });
    } catch (error) {
      pullLog.status = 'failed';
      pullLog.errorMessage = error.message;
      await pullLog.save();
      throw error;
    }
  } catch (error) {
    logger.error('Failed to reissue credit report', { error: error.message });
    next(createError(500, 'Failed to reissue credit report'));
  }
};

/**
 * Get credit pull logs
 */
exports.getCreditPullLogs = async (req, res, next) => {
  try {
    const { loanId, borrowerId, status, limit = 50 } = req.query;

    const query = {};
    if (loanId) query.loan = loanId;
    if (borrowerId) query.borrower = borrowerId;
    if (status) query.status = status;

    const logs = await CreditPullLog.find(query)
      .populate('borrower', 'name email')
      .populate('requestedBy', 'name email')
      .populate('creditReport', 'xactusReportId midScore status')
      .sort('-createdAt')
      .limit(parseInt(limit));

    res.json({ logs });
  } catch (error) {
    logger.error('Failed to get credit pull logs', { error: error.message });
    next(createError(500, 'Failed to retrieve credit pull logs'));
  }
};

/**
 * Delete expired credit reports (FCRA compliance)
 */
exports.deleteExpiredReports = async (req, res, next) => {
  try {
    const now = new Date();
    
    const expiredReports = await CreditReport.find({
      expiresAt: { $lt: now },
      status: { $ne: 'expired' }
    });

    let deletedCount = 0;
    for (const report of expiredReports) {
      // Mark as expired instead of hard delete for audit trail
      report.status = 'expired';
      report.encryptedData = undefined;
      report.encryptionIV = undefined;
      report.tradelines = [];
      report.publicRecords = [];
      report.inquiries = [];
      await report.save();
      deletedCount++;
    }

    logger.info('Expired credit reports purged per FCRA', { deletedCount });

    res.json({
      message: 'Expired credit reports purged',
      deletedCount
    });
  } catch (error) {
    logger.error('Failed to delete expired reports', { error: error.message });
    next(createError(500, 'Failed to delete expired reports'));
  }
};

/**
 * Notify loan officer of new credit data
 */
exports.notifyLoanOfficer = async (loan, borrower, creditReport) => {
  try {
    if (!loan.assignedOfficer) {
      return;
    }

    await Notification.create({
      user: loan.assignedOfficer,
      type: 'credit_report_ready',
      title: 'New Credit Report Available',
      message: `Credit report for ${borrower.name} is ready. Mid score: ${creditReport.midScore}`,
      metadata: {
        loanId: loan._id,
        borrowerId: borrower._id,
        creditReportId: creditReport._id,
        midScore: creditReport.midScore
      }
    });

    logger.info('Loan officer notified of new credit report', {
      loanOfficer: loan.assignedOfficer,
      creditReportId: creditReport._id
    });
  } catch (error) {
    logger.error('Failed to notify loan officer', { error: error.message });
  }
};
