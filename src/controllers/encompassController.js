const { validationResult } = require('express-validator');
const createError = require('http-errors');
const LoanApplication = require('../models/LoanApplication');
const LoanContact = require('../models/LoanContact');
const Message = require('../models/Message');
const EncompassSyncLog = require('../models/EncompassSyncLog');
const encompassService = require('../services/encompassService');
const logger = require('../utils/logger');
const { integrations } = require('../config/env');

const STAFF_ROLES = ['loan_officer_tpo', 'loan_officer_retail', 'admin'];
const BORROWER_ROLE = 'borrower';

exports.encompassToken = async (req, res, next) => {
  try {
    const accessToken = await encompassService.getAccessToken();
    return res.json({ accessToken });
  } catch (err) {
    logger.error('Failed to fetch Encompass access token', { error: err.message });
    return next(err);
  }
};

/**
 * Introspect current Encompass token
 */
exports.introspectToken = async (req, res, next) => {
  try {
    const result = await encompassService.introspectToken();
    if (!result) {
      return res.status(503).json({ active: false, message: 'Token introspection failed' });
    }
    return res.json(result);
  } catch (err) {
    logger.error('Token introspection failed', { error: err.message });
    return next(err);
  }
};

/**
 * Revoke current Encompass token
 */
exports.revokeToken = async (req, res, next) => {
  try {
    const revoked = await encompassService.revokeToken();
    return res.json({ revoked, message: revoked ? 'Token revoked' : 'Revocation failed' });
  } catch (err) {
    logger.error('Token revocation failed', { error: err.message });
    return next(err);
  }
};

/**
 * Test Encompass connection
 */
exports.testConnection = async (req, res, _next) => {
  try {
    const startTime = Date.now();
    const results = {
      timestamp: new Date().toISOString(),
      checks: {},
    };

    // Test 1: Check environment configuration
    const hasClientId = !!integrations.encompassClientId;
    const hasClientSecret = !!integrations.encompassClientSecret;
    const hasInstanceId = !!integrations.encompassInstanceId;

    results.checks.configuration = {
      status: hasClientId && hasClientSecret && hasInstanceId ? 'pass' : 'fail',
      details: {
        clientIdConfigured: hasClientId,
        clientSecretConfigured: hasClientSecret,
        instanceIdConfigured: hasInstanceId,
      },
    };

    if (!hasClientId || !hasClientSecret || !hasInstanceId) {
      results.connected = false;
      results.message = 'Missing Encompass configuration. Check environment variables.';
      results.duration = Date.now() - startTime;
      return res.status(503).json(results);
    }

    // Test 2: Get access token
    try {
      const token = await encompassService.getAccessToken();
      results.checks.authentication = {
        status: 'pass',
        details: {
          tokenObtained: !!token,
          tokenLength: token ? token.length : 0,
        },
      };
    } catch (err) {
      results.checks.authentication = {
        status: 'fail',
        error: err.message,
      };
      results.connected = false;
      results.message = 'Failed to authenticate with Encompass API';
      results.duration = Date.now() - startTime;
      return res.status(503).json(results);
    }

    // Test 3: Check API connectivity (optional status endpoint)
    try {
      const status = await encompassService.getStatus();
      results.checks.apiConnectivity = {
        status: 'pass',
        details: status,
      };
    } catch (err) {
      // Status endpoint might not be available, but auth worked
      results.checks.apiConnectivity = {
        status: 'warning',
        message: 'Status endpoint not available, but authentication succeeded',
        error: err.message,
      };
    }

    results.connected = true;
    results.message = 'Successfully connected to Encompass API';
    results.duration = Date.now() - startTime;

    logger.info('Encompass connection test successful', { duration: results.duration });

    return res.json(results);
  } catch (err) {
    logger.error('Encompass connection test failed', { error: err.message });
    return res.status(503).json({
      connected: false,
      message: 'Connection test failed',
      error: err.message,
      timestamp: new Date().toISOString(),
    });
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
    const userSlug = req.user.role?.slug;
    if (
      !STAFF_ROLES.includes(userSlug) &&
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

    // Check access — borrowers can only view their own loan contacts
    if (
      req.user.role?.slug === BORROWER_ROLE &&
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

    // Check access — borrowers can only view their own loan messages
    if (
      req.user.role?.slug === BORROWER_ROLE &&
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

    // Check access — borrowers can only message on their own loans
    if (
      req.user.role?.slug === BORROWER_ROLE &&
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
    if (!['loan_officer_tpo', 'loan_officer_retail', 'admin', 'branch_manager'].includes(req.user.role?.slug)) {
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

/**
 * Link a loan to Encompass
 */
exports.linkLoan = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, { errors: errors.array() }));
    }

    const { id } = req.params;
    const { encompassLoanId } = req.body;

    const loan = await LoanApplication.findById(id);
    if (!loan) return next(createError(404, 'Loan not found'));

    // Only allow loan officers and admins
    if (!STAFF_ROLES.includes(req.user.role?.slug)) {
      return next(createError(403, 'Forbidden'));
    }

    // Verify the Encompass loan exists
    try {
      await encompassService.getLoanDetails(encompassLoanId);
    } catch (_err) {
      return next(createError(400, 'Invalid Encompass loan ID or loan not accessible'));
    }

    // Check if another loan is already linked to this Encompass ID
    const existingLink = await LoanApplication.findOne({
      encompassLoanId,
      _id: { $ne: id },
    });
    if (existingLink) {
      return next(createError(409, 'This Encompass loan is already linked to another application'));
    }

    loan.encompassLoanId = encompassLoanId;
    await loan.save();

    // Log the linking action
    await EncompassSyncLog.create({
      loan: loan._id,
      syncType: 'link',
      direction: 'outbound',
      encompassLoanId,
      status: 'success',
    });

    logger.info('Loan linked to Encompass', {
      loanId: id,
      encompassLoanId,
      userId: req.user._id,
    });

    return res.json({
      message: 'Loan linked to Encompass successfully',
      loan: await LoanApplication.findById(id)
        .populate('borrower', 'name email')
        .populate('assignedOfficer', 'name email role'),
    });
  } catch (err) {
    logger.error('Failed to link loan to Encompass', { error: err.message, loanId: req.params.id });
    return next(err);
  }
};

/**
 * Unlink a loan from Encompass
 */
exports.unlinkLoan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const loan = await LoanApplication.findById(id);

    if (!loan) return next(createError(404, 'Loan not found'));

    // Only allow admins to unlink
    if (req.user.role?.slug !== 'admin') {
      return next(createError(403, 'Only admins can unlink loans from Encompass'));
    }

    if (!loan.encompassLoanId) {
      return next(createError(400, 'Loan is not linked to Encompass'));
    }

    const previousEncompassId = loan.encompassLoanId;
    loan.encompassLoanId = null;
    loan.lastEncompassSync = null;
    loan.encompassData = null;
    await loan.save();

    // Log the unlinking action
    await EncompassSyncLog.create({
      loan: loan._id,
      syncType: 'unlink',
      direction: 'outbound',
      encompassLoanId: previousEncompassId,
      status: 'success',
    });

    logger.info('Loan unlinked from Encompass', {
      loanId: id,
      previousEncompassId,
      userId: req.user._id,
    });

    return res.json({
      message: 'Loan unlinked from Encompass successfully',
      loan: await LoanApplication.findById(id)
        .populate('borrower', 'name email')
        .populate('assignedOfficer', 'name email role'),
    });
  } catch (err) {
    logger.error('Failed to unlink loan from Encompass', { error: err.message, loanId: req.params.id });
    return next(err);
  }
};

/**
 * Update loan status in Encompass
 */
exports.updateStatus = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, { errors: errors.array() }));
    }

    const { id } = req.params;
    const { status, milestones } = req.body;

    const loan = await LoanApplication.findById(id);
    if (!loan) return next(createError(404, 'Loan not found'));

    // Only allow loan officers and admins
    if (!STAFF_ROLES.includes(req.user.role?.slug)) {
      return next(createError(403, 'Forbidden'));
    }

    if (!loan.encompassLoanId) {
      return next(createError(400, 'Loan not linked to Encompass'));
    }

    const startTime = Date.now();
    const syncLog = await EncompassSyncLog.create({
      loan: loan._id,
      syncType: 'status',
      direction: 'outbound',
      encompassLoanId: loan.encompassLoanId,
    });

    try {
      await encompassService.updateLoanStatus(loan.encompassLoanId, status, milestones);

      // Update local loan status
      if (status) {
        loan.status = status;
      }
      if (milestones) {
        loan.milestones = milestones;
      }
      await loan.save();

      syncLog.status = 'success';
      syncLog.syncDuration = Date.now() - startTime;
      await syncLog.save();

      return res.json({
        message: 'Loan status updated in Encompass',
        loan: await LoanApplication.findById(id)
          .populate('borrower', 'name email')
          .populate('assignedOfficer', 'name email role'),
      });
    } catch (err) {
      syncLog.status = 'failed';
      syncLog.errorMessage = err.message;
      syncLog.syncDuration = Date.now() - startTime;
      await syncLog.save();
      throw err;
    }
  } catch (err) {
    logger.error('Failed to update loan status in Encompass', { error: err.message, loanId: req.params.id });
    return next(err);
  }
};

/**
 * Upload document to Encompass
 */
exports.uploadDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, documentType, base64Content, mimeType } = req.body;

    const loan = await LoanApplication.findById(id);
    if (!loan) return next(createError(404, 'Loan not found'));

    // Only allow loan officers, processors, admins, or the borrower themselves
    if (
      !STAFF_ROLES.includes(req.user.role?.slug) &&
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
      syncType: 'documents',
      direction: 'outbound',
      encompassLoanId: loan.encompassLoanId,
    });

    try {
      const result = await encompassService.uploadDocument(loan.encompassLoanId, {
        title: title || 'Uploaded Document',
        documentType: documentType || 'Other',
        file: {
          contentType: mimeType || 'application/pdf',
          content: base64Content,
        },
      });

      syncLog.status = 'success';
      syncLog.syncDuration = Date.now() - startTime;
      syncLog.dataSnapshot = { documentId: result.attachmentId };
      await syncLog.save();

      return res.status(201).json({
        message: 'Document uploaded to Encompass',
        document: result,
      });
    } catch (err) {
      syncLog.status = 'failed';
      syncLog.errorMessage = err.message;
      syncLog.syncDuration = Date.now() - startTime;
      await syncLog.save();
      throw err;
    }
  } catch (err) {
    logger.error('Failed to upload document to Encompass', { error: err.message, loanId: req.params.id });
    return next(err);
  }
};

/**
 * Get documents from Encompass
 */
exports.getDocuments = async (req, res, next) => {
  try {
    const { id } = req.params;
    const loan = await LoanApplication.findById(id);

    if (!loan) return next(createError(404, 'Loan not found'));

    // Check access — borrowers can only view their own loan documents
    if (
      req.user.role?.slug === BORROWER_ROLE &&
      loan.borrower.toString() !== req.user._id.toString()
    ) {
      return next(createError(403, 'Forbidden'));
    }

    if (!loan.encompassLoanId) {
      return next(createError(400, 'Loan not linked to Encompass'));
    }

    const documents = await encompassService.getDocuments(loan.encompassLoanId);

    return res.json(documents);
  } catch (err) {
    logger.error('Failed to get documents from Encompass', { error: err.message, loanId: req.params.id });
    return next(err);
  }
};

/**
 * Download a document from Encompass
 */
exports.downloadDocument = async (req, res, next) => {
  try {
    const { id, attachmentId } = req.params;
    const loan = await LoanApplication.findById(id);

    if (!loan) return next(createError(404, 'Loan not found'));

    // Check access — borrowers can only download their own loan documents
    if (
      req.user.role?.slug === BORROWER_ROLE &&
      loan.borrower.toString() !== req.user._id.toString()
    ) {
      return next(createError(403, 'Forbidden'));
    }

    if (!loan.encompassLoanId) {
      return next(createError(400, 'Loan not linked to Encompass'));
    }

    const document = await encompassService.downloadDocument(loan.encompassLoanId, attachmentId);

    res.set({
      'Content-Type': document.contentType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${document.filename || 'document'}"`,
    });

    return res.send(Buffer.from(document.data));
  } catch (err) {
    logger.error('Failed to download document from Encompass', {
      error: err.message,
      loanId: req.params.id,
      attachmentId: req.params.attachmentId,
    });
    return next(err);
  }
};

/**
 * Handle Encompass webhook events
 */
exports.webhook = async (req, res, next) => {
  try {
    const signature = req.headers['x-encompass-signature'];
    const webhookSecret = integrations.encompassWebhookSecret;

    // Verify webhook signature if secret is configured
    if (webhookSecret && signature) {
      const isValid = encompassService.verifyWebhookSignature(req.body, signature, webhookSecret);
      if (!isValid) {
        logger.warn('Invalid Encompass webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    const { eventType, resourceType, resourceId, data } = req.body;

    logger.info('Received Encompass webhook', { eventType, resourceType, resourceId });

    // Find the linked loan
    const loan = await LoanApplication.findOne({ encompassLoanId: resourceId });

    if (!loan) {
      logger.warn('Received webhook for unlinked loan', { encompassLoanId: resourceId });
      return res.status(200).json({ message: 'Acknowledged, loan not linked' });
    }

    // Log the webhook event
    const syncLog = await EncompassSyncLog.create({
      loan: loan._id,
      syncType: eventType || 'webhook',
      direction: 'inbound',
      encompassLoanId: resourceId,
      dataSnapshot: { eventType, data },
    });

    try {
      // Handle different event types
      switch (eventType) {
        case 'loan.milestone.updated':
          const milestones = await encompassService.getLoanMilestones(resourceId);
          loan.milestones = milestones;
          loan.lastEncompassSync = new Date();
          await loan.save();
          break;

        case 'loan.status.changed':
          const loanDetails = await encompassService.getLoanDetails(resourceId);
          loan.encompassData = loanDetails;
          loan.lastEncompassSync = new Date();
          if (data?.status) {
            loan.status = data.status;
          }
          await loan.save();
          break;

        case 'loan.contacts.updated':
          const contacts = await encompassService.getLoanContacts(resourceId);
          await Promise.all(
            contacts.map(async (contact) => {
              await LoanContact.findOneAndUpdate(
                { loan: loan._id, role: contact.role },
                { ...contact, loan: loan._id },
                { upsert: true, new: true }
              );
            })
          );
          break;

        default:
          logger.info('Unhandled webhook event type', { eventType });
      }

      syncLog.status = 'success';
      await syncLog.save();

      return res.status(200).json({ message: 'Webhook processed successfully' });
    } catch (err) {
      syncLog.status = 'failed';
      syncLog.errorMessage = err.message;
      await syncLog.save();
      throw err;
    }
  } catch (err) {
    logger.error('Failed to process Encompass webhook', { error: err.message });
    return next(err);
  }
};
