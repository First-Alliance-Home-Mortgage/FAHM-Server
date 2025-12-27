const { validationResult } = require('express-validator');
const createError = require('http-errors');
const SMSMessage = require('../models/SMSMessage');
const LoanApplication = require('../models/LoanApplication');
const User = require('../models/User');
const smsService = require('../services/smsService');
const encompassService = require('../services/encompassService');
const logger = require('../utils/logger');
const roles = require('../config/roles');
const twilio = require('twilio');
const { security } = require('../config/env');

function verifyTwilioSignature(req) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    logger.warn('TWILIO_AUTH_TOKEN not set; webhook signature verification skipped');
    return true;
  }
  const signature = req.get('x-twilio-signature');
  if (!signature) return false;
  const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  return twilio.validateRequest(authToken, signature, url, req.body || {});
}

/**
 * Send SMS message
 * POST /api/v1/sms/send
 * Access: Authenticated users
 */
exports.sendMessage = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, { errors: errors.array() }));
    }

    const { to, body, loanId, messageType, purpose } = req.body;

    // Fetch loan if provided
    let loan = null;
    if (loanId) {
      loan = await LoanApplication.findById(loanId);
      if (!loan) {
        return next(createError(404, 'Loan application not found'));
      }

      // Authorization check
      if (req.user.role === roles.BORROWER &&
          loan.borrower.toString() !== req.user.userId) {
        return next(createError(403, 'Not authorized to send messages for this loan'));
      }
    }

    // Find recipient user
    const recipient = await User.findOne({
      $or: [
        { phone: to },
        { phone: to.replace(/\D/g, '') },
        { phone: `+1${to.replace(/\D/g, '')}` }
      ]
    });

    // Get sender's phone from user profile or use FAHM default
    const from = req.user.phone || process.env.TWILIO_PHONE_NUMBER;

    // Create SMS message record
    const smsMessage = new SMSMessage({
      from,
      to,
      body,
      direction: 'outbound',
      messageType: messageType || 'manual',
      sender: req.user.userId,
      recipient: recipient?._id,
      loan: loanId || null,
      status: 'queued',
      compliance: {
        purpose: purpose || 'loan_update',
        consentObtained: true,
        consentDate: new Date(),
        tcpaCompliant: true
      },
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      }
    });

    await smsMessage.save();

    // Send via Twilio
    try {
      const twilioResponse = await smsService.sendSMS(to, body);
      
      await smsMessage.markAsSent({
        messageSid: twilioResponse.sid,
        numSegments: twilioResponse.numSegments,
        price: twilioResponse.price,
        priceUnit: twilioResponse.priceUnit
      });

      logger.info(`SMS sent successfully: ${smsMessage.messageId}`, {
        to,
        messageId: smsMessage.messageId,
        twilioSid: twilioResponse.sid
      });
    } catch (twilioError) {
      await smsMessage.markAsFailed('twilio_error', twilioError.message);
      logger.error(`Failed to send SMS via Twilio: ${twilioError.message}`);
      return next(createError(500, 'Failed to send SMS'));
    }

    // Async: Sync to Encompass if loan is associated
    if (loan) {
      smsMessage.syncToEncompass(encompassService).catch(err => {
        logger.error(`Failed to sync SMS to Encompass: ${err.message}`);
      });
    }

    res.json({
      success: true,
      data: {
        messageId: smsMessage.messageId,
        status: smsMessage.status,
        sentAt: smsMessage.sentAt,
        to: smsMessage.formattedTo
      }
    });
  } catch (err) {
    logger.error(`Error sending SMS: ${err.message}`);
    next(err);
  }
};

/**
 * Receive SMS webhook from Twilio
 * POST /api/v1/sms/webhook/receive
 * Access: Public (Twilio webhook)
 */
exports.receiveWebhook = async (req, res, next) => {
  try {
    if (!verifyTwilioSignature(req)) {
      return res.status(401).type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    }

    const { MessageSid, From, To, Body, NumMedia, MediaUrl0, MediaContentType0 } = req.body;

    // Find sender and recipient users
    const sender = await User.findOne({
      $or: [
        { phone: From },
        { phone: From.replace(/\D/g, '') },
        { phone: `+1${From.replace(/\D/g, '')}` }
      ]
    });

    const recipient = await User.findOne({
      $or: [
        { phone: To },
        { phone: To.replace(/\D/g, '') },
        { phone: `+1${To.replace(/\D/g, '')}` }
      ]
    });

    // Find associated loan (most recent active loan for sender)
    let loan = null;
    if (sender) {
      loan = await LoanApplication.findOne({
        borrower: sender._id,
        status: { $in: ['application', 'processing', 'underwriting', 'closing'] }
      }).sort({ createdAt: -1 });
    }

    // Handle media attachments
    const media = [];
    if (NumMedia && parseInt(NumMedia) > 0) {
      media.push({
        contentType: MediaContentType0,
        url: MediaUrl0
      });
    }

    // Create inbound SMS message record
    const smsMessage = new SMSMessage({
      twilioMessageSid: MessageSid,
      from: From,
      to: To,
      body: Body || '',
      direction: 'inbound',
      messageType: 'manual',
      sender: sender?._id,
      recipient: recipient?._id,
      loan: loan?._id,
      status: 'received',
      receivedAt: new Date(),
      media,
      compliance: {
        purpose: 'general_inquiry',
        consentObtained: true,
        tcpaCompliant: true
      }
    });

    await smsMessage.save();

    logger.info(`Inbound SMS received: ${smsMessage.messageId}`, {
      from: From,
      messageId: smsMessage.messageId,
      twilioSid: MessageSid
    });

    // Async: Sync to Encompass if loan is associated
    if (loan) {
      smsMessage.syncToEncompass(encompassService).catch(err => {
        logger.error(`Failed to sync inbound SMS to Encompass: ${err.message}`);
      });
    }

    // Respond to Twilio with TwiML
    res.type('text/xml');
    res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  } catch (err) {
    logger.error(`Error processing inbound SMS webhook: ${err.message}`);
    // Still respond to Twilio to prevent retries
    res.type('text/xml');
    res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  }
};

/**
 * Status callback webhook from Twilio
 * POST /api/v1/sms/webhook/status
 * Access: Public (Twilio webhook)
 */
exports.statusWebhook = async (req, res, next) => {
  try {
    if (!verifyTwilioSignature(req)) {
      return res.status(401).type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    }

    const { MessageSid, MessageStatus, ErrorCode, ErrorMessage } = req.body;

    const smsMessage = await SMSMessage.findOne({ twilioMessageSid: MessageSid });

    if (!smsMessage) {
      logger.warn(`Status update for unknown message: ${MessageSid}`);
      return res.sendStatus(200);
    }

    // Update status based on Twilio status
    switch (MessageStatus) {
      case 'delivered':
        await smsMessage.markAsDelivered();
        break;
      case 'failed':
      case 'undelivered':
        await smsMessage.markAsFailed(ErrorCode, ErrorMessage);
        break;
      default:
        smsMessage.status = MessageStatus;
        smsMessage.deliveryDetails.twilioStatus = MessageStatus;
        await smsMessage.save();
    }

    logger.info(`SMS status updated: ${MessageSid} -> ${MessageStatus}`);

    res.sendStatus(200);
  } catch (err) {
    logger.error(`Error processing status webhook: ${err.message}`);
    res.sendStatus(200); // Still respond to prevent retries
  }
};

/**
 * Get conversation thread
 * GET /api/v1/sms/conversation/:phone
 * Access: Authenticated users
 */
exports.getConversation = async (req, res, next) => {
  try {
    const { phone } = req.params;
    const { limit = 50 } = req.query;

    // Get user's phone number
    const userPhone = req.user.phone || process.env.TWILIO_PHONE_NUMBER;

    // Fetch conversation thread
    const messages = await SMSMessage.getConversationThread(userPhone, phone, parseInt(limit));

    res.json({
      success: true,
      data: {
        messages: messages.reverse(), // Chronological order
        totalCount: messages.length
      }
    });
  } catch (err) {
    logger.error(`Error fetching conversation: ${err.message}`);
    next(err);
  }
};

/**
 * Get messages for a loan
 * GET /api/v1/sms/loan/:loanId
 * Access: Authenticated users
 */
exports.getLoanMessages = async (req, res, next) => {
  try {
    const { loanId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const loan = await LoanApplication.findById(loanId);
    if (!loan) {
      return next(createError(404, 'Loan application not found'));
    }

    // Authorization check
    if (req.user.role === roles.BORROWER &&
        loan.borrower.toString() !== req.user.userId) {
      return next(createError(403, 'Not authorized to view messages for this loan'));
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [messages, total] = await Promise.all([
      SMSMessage.find({ loan: loanId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('sender', 'name email role')
        .populate('recipient', 'name email role')
        .lean(),
      SMSMessage.countDocuments({ loan: loanId })
    ]);

    res.json({
      success: true,
      data: messages.reverse(),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    logger.error(`Error fetching loan messages: ${err.message}`);
    next(err);
  }
};

/**
 * Get user's messages
 * GET /api/v1/sms/my-messages
 * Access: Authenticated users
 */
exports.getMyMessages = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, direction } = req.query;

    const query = {
      $or: [
        { sender: req.user.userId },
        { recipient: req.user.userId }
      ]
    };

    if (direction) {
      query.direction = direction;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [messages, total] = await Promise.all([
      SMSMessage.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('sender', 'name email role')
        .populate('recipient', 'name email role')
        .populate('loan', 'amount status propertyAddress')
        .lean(),
      SMSMessage.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: messages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    logger.error(`Error fetching user messages: ${err.message}`);
    next(err);
  }
};

/**
 * Mark message as read
 * PATCH /api/v1/sms/:messageId/read
 * Access: Authenticated users
 */
exports.markAsRead = async (req, res, next) => {
  try {
    const { messageId } = req.params;

    const message = await SMSMessage.findOne({ messageId });
    if (!message) {
      return next(createError(404, 'Message not found'));
    }

    // Authorization check
    if (message.recipient?.toString() !== req.user.userId) {
      return next(createError(403, 'Not authorized to mark this message as read'));
    }

    await message.markAsRead();

    res.json({
      success: true,
      data: {
        messageId: message.messageId,
        readAt: message.readAt
      }
    });
  } catch (err) {
    logger.error(`Error marking message as read: ${err.message}`);
    next(err);
  }
};

/**
 * Get SMS statistics
 * GET /api/v1/sms/stats
 * Access: Loan Officers, Branch Managers, Admins
 */
exports.getStats = async (req, res, next) => {
  try {
    const { startDate, endDate, loanId } = req.query;

    const filters = {};
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (loanId) filters.loan = loanId;

    // Role-based filtering
    if (req.user.role === roles.LO_RETAIL || req.user.role === roles.LO_TPO) {
      filters.sender = req.user.userId;
    }

    const stats = await SMSMessage.getMessageStats(filters);

    res.json({
      success: true,
      data: stats[0] || {
        totalMessages: 0,
        sentMessages: 0,
        receivedMessages: 0,
        deliveredMessages: 0,
        failedMessages: 0,
        syncedMessages: 0,
        automatedMessages: 0,
        deliveryRate: 0,
        syncRate: 0
      }
    });
  } catch (err) {
    logger.error(`Error fetching SMS stats: ${err.message}`);
    next(err);
  }
};

/**
 * Sync unsynced messages to Encompass (Admin only)
 * POST /api/v1/sms/sync-to-encompass
 * Access: Admin
 */
exports.syncToEncompass = async (req, res, next) => {
  try {
    const unsyncedMessages = await SMSMessage.findUnsyncedMessages();

    const results = {
      total: unsyncedMessages.length,
      synced: 0,
      failed: 0,
      errors: []
    };

    for (const message of unsyncedMessages) {
      try {
        await message.syncToEncompass(encompassService);
        results.synced++;
      } catch (err) {
        results.failed++;
        results.errors.push({
          messageId: message.messageId,
          error: err.message
        });
      }
    }

    logger.info(`Encompass sync completed: ${results.synced}/${results.total} synced`);

    res.json({
      success: true,
      data: results
    });
  } catch (err) {
    logger.error(`Error syncing messages to Encompass: ${err.message}`);
    next(err);
  }
};
