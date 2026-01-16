const { validationResult } = require('express-validator');
const createError = require('http-errors');
const LoanApplication = require('../models/LoanApplication');
const LoanContact = require('../models/LoanContact');
const Message = require('../models/Message');
const EncompassSyncLog = require('../models/EncompassSyncLog');
const encompassService = require('../services/encompassService');
const logger = require('../utils/logger');
const roles = require('../config/roles');

exports.encompassToken = async (req, res, next) => {
  try {
    // const status = await encompassService.getStatus();
    const accessToken = await encompassService.getAccessToken();
    return res.json({ accessToken });
  } catch (err) {
    logger.error('Failed to fetch Encompass access token', { error: err.message });
    return next(err);
  }
};

/**
 * Sync loan data from Encompass
 */
exports.syncLoan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const loan = await LoanApplication.findById(id);

    if (!loan) return next(createError(404, 'Loan not found'));

    // Only allow loan officers, processors, and admins to sync
    if (
      ![roles.LO_TPO, roles.LO_RETAIL, roles.ADMIN].includes(req.user.role) &&
      loan.borrower.toString() !== req.user._id.toString()
    ) {
      return next(createError(403, 'Forbidden'));
    }

    if (!loan.encompassLoanId) {
      return next(createError(400, 'Loan not linked to Encompass'));
    }

    const startTime = Date.now();
    const syncLog = await EncompassSyncLog.create({
      loan: loan._id,
      syncType: 'full',
      direction: 'inbound',
      encompassLoanId: loan.encompassLoanId,
    });

    try {
      // Fetch data from Encompass
      const [loanDetails, milestones, contacts] = await Promise.all([
        encompassService.getLoanDetails(loan.encompassLoanId),
        encompassService.getLoanMilestones(loan.encompassLoanId),
        encompassService.getLoanContacts(loan.encompassLoanId),
      ]);

      // Update loan details
      loan.milestones = milestones;
      loan.lastEncompassSync = new Date();
      loan.encompassData = loanDetails;
      await loan.save();

      // Update or create contacts
      await Promise.all(
        contacts.map(async (contact) => {
          await LoanContact.findOneAndUpdate(
            { loan: loan._id, role: contact.role },
            { ...contact, loan: loan._id },
            { upsert: true, new: true }
          );
        })
      );

      // Update sync log
      syncLog.status = 'success';
      syncLog.syncDuration = Date.now() - startTime;
      syncLog.dataSnapshot = { milestones, contactsCount: contacts.length };
      await syncLog.save();

      return res.json({
        message: 'Loan synced successfully',
        loan: await LoanApplication.findById(loan._id)
          .populate('borrower', 'name email')
          .populate('assignedOfficer', 'name email role'),
        contacts: await LoanContact.find({ loan: loan._id }),
        syncLog: { duration: syncLog.syncDuration, timestamp: syncLog.createdAt },
      });
    } catch (err) {
      syncLog.status = 'failed';
      syncLog.errorMessage = err.message;
      syncLog.syncDuration = Date.now() - startTime;
      await syncLog.save();
      throw err;
    }
  } catch (err) {
    logger.error('Loan sync failed', { error: err.message, loanId: req.params.id });
    return next(err);
  }
};

/**
 * Get loan contacts
 */
exports.getContacts = async (req, res, next) => {
  try {
    const { id } = req.params;
    const loan = await LoanApplication.findById(id);

    if (!loan) return next(createError(404, 'Loan not found'));

    // Check access
    if (
      req.user.role === roles.BORROWER &&
      loan.borrower.toString() !== req.user._id.toString()
    ) {
      return next(createError(403, 'Forbidden'));
    }

    const contacts = await LoanContact.find({ loan: id })
      .populate('user', 'name email phone')
      .sort({ isPrimary: -1, role: 1 });

    return res.json(contacts);
  } catch (err) {
    return next(err);
  }
};

/**
 * Get loan messages (chat history)
 */
exports.getMessages = async (req, res, next) => {
  try {
    const { id } = req.params;
    const loan = await LoanApplication.findById(id);

    if (!loan) return next(createError(404, 'Loan not found'));

    // Check access
    if (
      req.user.role === roles.BORROWER &&
      loan.borrower.toString() !== req.user._id.toString()
    ) {
      return next(createError(403, 'Forbidden'));
    }

    const messages = await Message.find({ loan: id })
      .populate('sender', 'name email role')
      .populate('recipient', 'name email role')
      .sort({ createdAt: 1 })
      .limit(500);

    return res.json(messages);
  } catch (err) {
    return next(err);
  }
};

/**
 * Send message for a loan
 */
exports.sendMessage = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, { errors: errors.array() }));
    }

    const { id } = req.params;
    const { content, recipientId, messageType = 'text' } = req.body;

    const loan = await LoanApplication.findById(id);
    if (!loan) return next(createError(404, 'Loan not found'));

    // Check access
    if (
      req.user.role === roles.BORROWER &&
      loan.borrower.toString() !== req.user._id.toString()
    ) {
      return next(createError(403, 'Forbidden'));
    }

    const message = await Message.create({
      loan: id,
      sender: req.user._id,
      recipient: recipientId,
      content,
      messageType,
      metadata: req.body.metadata,
    });

    // Sync to Encompass if loan is linked
    if (loan.encompassLoanId) {
      const synced = await encompassService.sendMessage(loan.encompassLoanId, {
        content,
        createdAt: message.createdAt,
        senderName: req.user.name,
      });
      message.encompassSynced = synced;
      await message.save();
    }

    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'name email role')
      .populate('recipient', 'name email role');

    return res.status(201).json(populatedMessage);
  } catch (err) {
    return next(err);
  }
};

/**
 * Mark message as read
 */
exports.markMessageRead = async (req, res, next) => {
  try {
    const { id, messageId } = req.params;

    const message = await Message.findOne({ _id: messageId, loan: id });
    if (!message) return next(createError(404, 'Message not found'));

    // Only recipient can mark as read
    if (message.recipient && message.recipient.toString() !== req.user._id.toString()) {
      return next(createError(403, 'Forbidden'));
    }

    message.read = true;
    message.readAt = new Date();
    await message.save();

    return res.json(message);
  } catch (err) {
    return next(err);
  }
};

/**
 * Get sync history for a loan
 */
exports.getSyncHistory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const loan = await LoanApplication.findById(id);

    if (!loan) return next(createError(404, 'Loan not found'));

    // Only allow loan officers and admins
    if (![roles.LO_TPO, roles.LO_RETAIL, roles.ADMIN, roles.BRANCH_MANAGER].includes(req.user.role)) {
      return next(createError(403, 'Forbidden'));
    }

    const syncLogs = await EncompassSyncLog.find({ loan: id })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('-dataSnapshot');

    return res.json({
      lastSync: loan.lastEncompassSync,
      encompassLoanId: loan.encompassLoanId,
      logs: syncLogs,
    });
  } catch (err) {
    return next(err);
  }
};
