const crypto = require('crypto');
const { validationResult } = require('express-validator');
const createError = require('http-errors');
const mongoose = require('mongoose');
const LoanApplication = require('../models/LoanApplication');
const LoanContact = require('../models/LoanContact');
const Message = require('../models/Message');
const Document = require('../models/Document');
const EncompassSyncLog = require('../models/EncompassSyncLog');
const User = require('../models/User');
const logger = require('../utils/logger');
const escapeRegex = require('../utils/escapeRegex');
const { integrations } = require('../config/env');

const STAFF_ROLES = ['loan_officer_tpo', 'loan_officer_retail', 'admin'];
const BORROWER_ROLE = 'borrower';

/**
 * Valid loan statuses matching the LoanApplication model enum.
 */
const VALID_STATUSES = ['application', 'processing', 'underwriting', 'closing', 'funded'];

/**
 * Test local database connection
 */
exports.testConnection = async (req, res, _next) => {
  try {
    const startTime = Date.now();
    const results = {
      timestamp: new Date().toISOString(),
      checks: {},
    };

    // Check MongoDB connection
    const dbState = mongoose.connection.readyState;
    const dbStateMap = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };

    results.checks.database = {
      status: dbState === 1 ? 'pass' : 'fail',
      details: { state: dbStateMap[dbState] || 'unknown' },
    };

    if (dbState !== 1) {
      results.connected = false;
      results.message = 'Database not connected';
      results.duration = Date.now() - startTime;
      return res.status(503).json(results);
    }

    // Quick count to verify read access
    const loanCount = await LoanApplication.countDocuments();
    results.checks.dataAccess = {
      status: 'pass',
      details: { loanCount },
    };

    results.connected = true;
    results.message = 'Local database connection healthy';
    results.duration = Date.now() - startTime;

    logger.info('Connection test successful', { duration: results.duration });

    return res.json(results);
  } catch (err) {
    logger.error('Connection test failed', { error: err.message });
    return res.status(503).json({
      connected: false,
      message: 'Connection test failed',
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Get loan details with contacts and milestones (local data)
 */
exports.syncLoan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const loan = await LoanApplication.findById(id);

    if (!loan) return next(createError(404, 'Loan not found'));

    const userSlug = req.user.role?.slug;
    if (
      !STAFF_ROLES.includes(userSlug) &&
      loan.borrower.toString() !== req.user._id.toString()
    ) {
      return next(createError(403, 'Forbidden'));
    }

    const contacts = await LoanContact.find({ loan: loan._id })
      .populate('user', 'name email phone')
      .sort({ isPrimary: -1, role: 1 });

    const populatedLoan = await LoanApplication.findById(loan._id)
      .populate('borrower', 'name email')
      .populate('assignedOfficer', 'name email role');

    return res.json({
      message: 'Loan data retrieved successfully',
      loan: populatedLoan,
      contacts,
    });
  } catch (err) {
    logger.error('Failed to retrieve loan data', { error: err.message, loanId: req.params.id });
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
 * Link a loan to an external reference ID
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

    if (!STAFF_ROLES.includes(req.user.role?.slug)) {
      return next(createError(403, 'Forbidden'));
    }

    // Check if another loan is already linked to this ID
    const existingLink = await LoanApplication.findOne({
      encompassLoanId,
      _id: { $ne: id },
    });
    if (existingLink) {
      return next(createError(409, 'This external loan ID is already linked to another application'));
    }

    loan.encompassLoanId = encompassLoanId;
    await loan.save();

    await EncompassSyncLog.create({
      loan: loan._id,
      syncType: 'link',
      direction: 'outbound',
      encompassLoanId,
      status: 'success',
    });

    logger.info('Loan linked', {
      loanId: id,
      encompassLoanId,
      userId: req.user._id,
    });

    return res.json({
      message: 'Loan linked successfully',
      loan: await LoanApplication.findById(id)
        .populate('borrower', 'name email')
        .populate('assignedOfficer', 'name email role'),
    });
  } catch (err) {
    logger.error('Failed to link loan', { error: err.message, loanId: req.params.id });
    return next(err);
  }
};

/**
 * Unlink a loan from external reference
 */
exports.unlinkLoan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const loan = await LoanApplication.findById(id);

    if (!loan) return next(createError(404, 'Loan not found'));

    if (req.user.role?.slug !== 'admin') {
      return next(createError(403, 'Only admins can unlink loans'));
    }

    if (!loan.encompassLoanId) {
      return next(createError(400, 'Loan is not linked to an external reference'));
    }

    const previousEncompassId = loan.encompassLoanId;
    loan.encompassLoanId = null;
    loan.lastEncompassSync = null;
    loan.encompassData = null;
    await loan.save();

    await EncompassSyncLog.create({
      loan: loan._id,
      syncType: 'unlink',
      direction: 'outbound',
      encompassLoanId: previousEncompassId,
      status: 'success',
    });

    logger.info('Loan unlinked', {
      loanId: id,
      previousEncompassId,
      userId: req.user._id,
    });

    return res.json({
      message: 'Loan unlinked successfully',
      loan: await LoanApplication.findById(id)
        .populate('borrower', 'name email')
        .populate('assignedOfficer', 'name email role'),
    });
  } catch (err) {
    logger.error('Failed to unlink loan', { error: err.message, loanId: req.params.id });
    return next(err);
  }
};

/**
 * Update loan status locally
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

    if (!STAFF_ROLES.includes(req.user.role?.slug)) {
      return next(createError(403, 'Forbidden'));
    }

    if (status) {
      loan.status = status;
    }
    if (milestones) {
      loan.milestones = milestones;
    }
    await loan.save();

    return res.json({
      message: 'Loan status updated',
      loan: await LoanApplication.findById(id)
        .populate('borrower', 'name email')
        .populate('assignedOfficer', 'name email role'),
    });
  } catch (err) {
    logger.error('Failed to update loan status', { error: err.message, loanId: req.params.id });
    return next(err);
  }
};

/**
 * Upload document (store locally)
 */
exports.uploadDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, base64Content, mimeType } = req.body;

    const loan = await LoanApplication.findById(id);
    if (!loan) return next(createError(404, 'Loan not found'));

    if (
      !STAFF_ROLES.includes(req.user.role?.slug) &&
      loan.borrower.toString() !== req.user._id.toString()
    ) {
      return next(createError(403, 'Forbidden'));
    }

    // Determine file type from mimeType
    const mimeToType = {
      'application/pdf': 'pdf',
      'image/png': 'png',
      'image/jpeg': 'jpeg',
      'image/jpg': 'jpg',
    };
    const fileType = mimeToType[mimeType] || 'pdf';

    // Calculate file size from base64 content
    const fileSize = base64Content ? Math.ceil((base64Content.length * 3) / 4) : 0;

    const document = await Document.create({
      loan: loan._id,
      uploadedBy: req.user._id,
      name: title || 'Uploaded Document',
      type: fileType,
      size: fileSize,
      url: `data:${mimeType || 'application/pdf'};base64,${base64Content}`,
      status: 'uploaded',
    });

    return res.status(201).json({
      message: 'Document uploaded successfully',
      document: {
        id: document._id,
        title: document.name,
        type: document.type,
        size: document.size,
        status: document.status,
        createdAt: document.createdAt,
      },
    });
  } catch (err) {
    logger.error('Failed to upload document', { error: err.message, loanId: req.params.id });
    return next(err);
  }
};

/**
 * Get documents for a loan (local data)
 */
exports.getDocuments = async (req, res, next) => {
  try {
    const { id } = req.params;
    const loan = await LoanApplication.findById(id);

    if (!loan) return next(createError(404, 'Loan not found'));

    if (
      req.user.role?.slug === BORROWER_ROLE &&
      loan.borrower.toString() !== req.user._id.toString()
    ) {
      return next(createError(403, 'Forbidden'));
    }

    const documents = await Document.find({ loan: id })
      .populate('uploadedBy', 'name email')
      .sort({ createdAt: -1 });

    return res.json(documents.map(doc => ({
      id: doc._id,
      title: doc.name,
      type: doc.type,
      size: doc.size,
      status: doc.status,
      createdAt: doc.createdAt,
      createdBy: doc.uploadedBy?.name || 'Unknown',
    })));
  } catch (err) {
    logger.error('Failed to get documents', { error: err.message, loanId: req.params.id });
    return next(err);
  }
};

/**
 * Download a document (local data)
 */
exports.downloadDocument = async (req, res, next) => {
  try {
    const { id, documentId } = req.params;
    const loan = await LoanApplication.findById(id);

    if (!loan) return next(createError(404, 'Loan not found'));

    if (
      req.user.role?.slug === BORROWER_ROLE &&
      loan.borrower.toString() !== req.user._id.toString()
    ) {
      return next(createError(403, 'Forbidden'));
    }

    const document = await Document.findOne({ _id: documentId, loan: id });
    if (!document) return next(createError(404, 'Document not found'));

    // If URL is a data URI, extract and send the content
    if (document.url && document.url.startsWith('data:')) {
      const matches = document.url.match(/^data:(.+);base64,(.+)$/);
      if (matches) {
        const contentType = matches[1];
        const base64Data = matches[2];
        res.set({
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${document.name}"`,
        });
        return res.send(Buffer.from(base64Data, 'base64'));
      }
    }

    // For external URLs, redirect
    return res.redirect(document.url);
  } catch (err) {
    logger.error('Failed to download document', {
      error: err.message,
      loanId: req.params.id,
      documentId: req.params.documentId,
    });
    return next(err);
  }
};

/**
 * Query the local loan pipeline.
 *
 * Queries the LoanApplication collection with filters, sorting, and pagination.
 */
exports.queryPipeline = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, { errors: errors.array() }));
    }

    const {
      status,
      loanOfficer,
      borrowerName,
      dateFrom,
      dateTo,
      source,
      sortField,
      sortOrder,
    } = req.query;
    const start = parseInt(req.query.start, 10) || 0;
    const limit = Math.min(parseInt(req.query.limit, 10) || 25, 100);

    const filter = {};

    // Filter by status (comma-separated)
    if (status) {
      const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
      if (statuses.length === 1) {
        filter.status = statuses[0];
      } else if (statuses.length > 1) {
        filter.status = { $in: statuses };
      }
    }

    // Filter by source
    if (source) {
      filter.source = source;
    }

    // Filter by loan officer (by ObjectId or name search)
    if (loanOfficer) {
      if (mongoose.Types.ObjectId.isValid(loanOfficer)) {
        filter.assignedOfficer = loanOfficer;
      } else {
        const safeQ = escapeRegex(loanOfficer);
        const matchingOfficers = await User.find({
          name: { $regex: safeQ, $options: 'i' },
        }).select('_id');
        if (matchingOfficers.length > 0) {
          filter.assignedOfficer = { $in: matchingOfficers.map(u => u._id) };
        } else {
          // No matching officers — return empty result
          return res.json({ data: [], total: 0, start, limit });
        }
      }
    }

    // Filter by borrower name
    if (borrowerName) {
      const safeQ = escapeRegex(borrowerName);
      const matchingBorrowers = await User.find({
        name: { $regex: safeQ, $options: 'i' },
      }).select('_id');
      if (matchingBorrowers.length > 0) {
        filter.borrower = { $in: matchingBorrowers.map(u => u._id) };
      } else {
        return res.json({ data: [], total: 0, start, limit });
      }
    }

    // Date range filter on createdAt
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    // Build sort
    const sortMap = {
      status: 'status',
      amount: 'amount',
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    };
    const sortKey = sortMap[sortField] || 'updatedAt';
    const sort = { [sortKey]: sortOrder === 'asc' ? 1 : -1 };

    const total = await LoanApplication.countDocuments(filter);
    const loans = await LoanApplication.find(filter)
      .populate('borrower', 'name email')
      .populate('assignedOfficer', 'name email role')
      .sort(sort)
      .skip(start)
      .limit(limit);

    const data = loans.map(loan => ({
      _id: loan._id,
      loanNumber: loan._id.toString().slice(-8).toUpperCase(),
      borrowerName: loan.borrower?.name || null,
      borrowerEmail: loan.borrower?.email || null,
      loanAmount: loan.amount,
      status: loan.status,
      loanOfficerName: loan.assignedOfficer?.name || null,
      propertyAddress: loan.propertyAddress || null,
      source: loan.source,
      applicationDate: loan.createdAt,
      lastModified: loan.updatedAt,
      milestones: loan.milestones,
      encompassLoanId: loan.encompassLoanId || null,
    }));

    logger.info('Pipeline queried', { count: data.length, start, limit, total });

    return res.json({
      data,
      total,
      start,
      limit,
    });
  } catch (err) {
    logger.error('Failed to query pipeline', { error: err.message });
    return next(err);
  }
};

/**
 * Get field definitions available for pipeline queries.
 */
exports.getPipelineFields = async (_req, res, _next) => {
  const fields = [
    { name: 'status', label: 'Loan Status', type: 'string', sortable: true, filterable: true, values: VALID_STATUSES },
    { name: 'amount', label: 'Loan Amount', type: 'number', sortable: true, filterable: false },
    { name: 'source', label: 'Loan Source', type: 'string', sortable: false, filterable: true, values: ['retail', 'tpo'] },
    { name: 'borrowerName', label: 'Borrower Name', type: 'string', sortable: false, filterable: true },
    { name: 'loanOfficer', label: 'Loan Officer', type: 'string', sortable: false, filterable: true },
    { name: 'propertyAddress', label: 'Property Address', type: 'string', sortable: false, filterable: false },
    { name: 'createdAt', label: 'Application Date', type: 'date', sortable: true, filterable: true },
    { name: 'updatedAt', label: 'Last Modified', type: 'date', sortable: true, filterable: true },
  ];

  return res.json({ data: fields, total: fields.length });
};

/**
 * Handle webhook events (process locally)
 */
exports.webhook = async (req, res, next) => {
  try {
    // Verify webhook signature when a secret is configured
    const webhookSecret = integrations.encompassWebhookSecret;
    if (webhookSecret) {
      const signature = req.headers['x-webhook-signature'] || req.headers['x-signature'];
      if (!signature) {
        logger.warn('Webhook request missing signature header');
        return res.status(401).json({ error: 'Missing webhook signature' });
      }
      const payload = JSON.stringify(req.body);
      const expected = crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex');
      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
        logger.warn('Webhook signature verification failed');
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }
    } else {
      logger.warn('ENCOMPASS_WEBHOOK_SECRET not set – webhook signature verification skipped');
    }

    const { eventType, resourceType, resourceId, data } = req.body;

    logger.info('Received webhook', { eventType, resourceType, resourceId });

    // Find the linked loan
    const loan = await LoanApplication.findOne({ encompassLoanId: resourceId });

    if (!loan) {
      logger.warn('Received webhook for unlinked loan', { resourceId });
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
      switch (eventType) {
        case 'loan.milestone.updated':
          if (data?.milestones) {
            loan.milestones = data.milestones;
            await loan.save();
          }
          break;

        case 'loan.status.changed':
          if (data?.status) {
            loan.status = data.status;
          }
          if (data?.encompassData) {
            loan.encompassData = data.encompassData;
          }
          await loan.save();
          break;

        case 'loan.contacts.updated':
          if (Array.isArray(data?.contacts)) {
            await Promise.all(
              data.contacts.map(async (contact) => {
                await LoanContact.findOneAndUpdate(
                  { loan: loan._id, role: contact.role },
                  { ...contact, loan: loan._id },
                  { upsert: true, new: true }
                );
              })
            );
          }
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
    logger.error('Failed to process webhook', { error: err.message });
    return next(err);
  }
};

// Export for use in routes validation
exports.VALID_STATUSES = VALID_STATUSES;
