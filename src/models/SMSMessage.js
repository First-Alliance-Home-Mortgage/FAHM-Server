const mongoose = require('mongoose');

/**
 * SMSMessage Model
 * Tracks all SMS communications for compliance with 2-way threading
 * Integrates with Twilio for delivery and Encompass for logging
 */
const smsMessageSchema = new mongoose.Schema({
  // Message Identification
  messageId: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  twilioMessageSid: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  
  // Participants
  from: {
    type: String,
    required: true,
    index: true
  },
  to: {
    type: String,
    required: true,
    index: true
  },
  
  // User References
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  
  // Loan Context
  loan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LoanApplication',
    index: true
  },
  
  // Message Content
  body: {
    type: String,
    required: true,
    maxlength: 1600
  },
  direction: {
    type: String,
    enum: ['inbound', 'outbound'],
    required: true,
    index: true
  },
  
  // Message Type
  messageType: {
    type: String,
    enum: ['manual', 'automated', 'notification', 'reminder', 'alert', 'milestone_update'],
    default: 'manual',
    index: true
  },
  
  // Status Tracking
  status: {
    type: String,
    enum: ['queued', 'sending', 'sent', 'delivered', 'failed', 'undelivered', 'received'],
    default: 'queued',
    index: true
  },
  errorCode: String,
  errorMessage: String,
  
  // Threading
  threadId: {
    type: String,
    index: true
  },
  conversationId: {
    type: String,
    index: true
  },
  inReplyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SMSMessage'
  },
  
  // Timestamps
  sentAt: Date,
  deliveredAt: Date,
  receivedAt: Date,
  readAt: Date,
  
  // Encompass Integration
  encompassSync: {
    synced: {
      type: Boolean,
      default: false,
      index: true
    },
    syncedAt: Date,
    encompassLogId: String,
    syncAttempts: {
      type: Number,
      default: 0
    },
    lastSyncAttempt: Date,
    syncError: String
  },
  
  // Compliance and Audit
  compliance: {
    purpose: {
      type: String,
      enum: ['loan_update', 'document_request', 'appointment_reminder', 'general_inquiry', 'marketing', 'servicing', 'collection'],
      required: true
    },
    consentObtained: {
      type: Boolean,
      default: false
    },
    consentDate: Date,
    tcpaCompliant: {
      type: Boolean,
      default: true
    },
    optOutReceived: {
      type: Boolean,
      default: false
    },
    retentionExpiresAt: Date
  },
  
  // Media Attachments
  media: [{
    contentType: String,
    url: String,
    size: Number
  }],
  
  // Metadata
  metadata: {
    ipAddress: String,
    userAgent: String,
    deviceType: String,
    campaignId: String,
    automationTrigger: String,
    customFields: Object
  },
  
  // Delivery Details
  deliveryDetails: {
    numSegments: Number,
    numMedia: Number,
    price: String,
    priceUnit: String,
    twilioStatus: String,
    twilioErrorCode: String
  }
}, {
  timestamps: true
});

// Compound indexes for performance
smsMessageSchema.index({ loan: 1, createdAt: -1 });
smsMessageSchema.index({ threadId: 1, createdAt: 1 });
smsMessageSchema.index({ sender: 1, recipient: 1, createdAt: -1 });
smsMessageSchema.index({ 'encompassSync.synced': 1, createdAt: 1 });
smsMessageSchema.index({ status: 1, 'encompassSync.synced': 1 });
smsMessageSchema.index({ direction: 1, messageType: 1, createdAt: -1 });

// TTL index for auto-deletion based on retention period
smsMessageSchema.index({ 'compliance.retentionExpiresAt': 1 }, { expireAfterSeconds: 0 });

// Virtual for formatted phone numbers
smsMessageSchema.virtual('formattedFrom').get(function() {
  return this.formatPhoneNumber(this.from);
});

smsMessageSchema.virtual('formattedTo').get(function() {
  return this.formatPhoneNumber(this.to);
});

// Method to format phone numbers
smsMessageSchema.methods.formatPhoneNumber = function(phone) {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.substr(1, 3)}) ${cleaned.substr(4, 3)}-${cleaned.substr(7)}`;
  }
  if (cleaned.length === 10) {
    return `+1 (${cleaned.substr(0, 3)}) ${cleaned.substr(3, 3)}-${cleaned.substr(6)}`;
  }
  return phone;
};

// Method to mark as sent
smsMessageSchema.methods.markAsSent = async function(twilioData = {}) {
  this.status = 'sent';
  this.sentAt = new Date();
  
  if (twilioData.messageSid) {
    this.twilioMessageSid = twilioData.messageSid;
  }
  
  if (twilioData.numSegments) {
    this.deliveryDetails.numSegments = twilioData.numSegments;
  }
  
  if (twilioData.price) {
    this.deliveryDetails.price = twilioData.price;
    this.deliveryDetails.priceUnit = twilioData.priceUnit || 'USD';
  }
  
  return this.save();
};

// Method to mark as delivered
smsMessageSchema.methods.markAsDelivered = async function() {
  this.status = 'delivered';
  this.deliveredAt = new Date();
  return this.save();
};

// Method to mark as failed
smsMessageSchema.methods.markAsFailed = async function(errorCode, errorMessage) {
  this.status = 'failed';
  this.errorCode = errorCode;
  this.errorMessage = errorMessage;
  return this.save();
};

// Method to mark as read
smsMessageSchema.methods.markAsRead = async function() {
  this.readAt = new Date();
  return this.save();
};

// Method to sync to Encompass
smsMessageSchema.methods.syncToEncompass = async function(encompassService) {
  try {
    this.encompassSync.syncAttempts += 1;
    this.encompassSync.lastSyncAttempt = new Date();
    
    if (!this.loan) {
      throw new Error('No loan associated with message');
    }
    
    // Call Encompass service to log message
    const result = await encompassService.logSMSMessage({
      loanId: this.loan.encompassLoanId || this.loan._id,
      from: this.from,
      to: this.to,
      body: this.body,
      direction: this.direction,
      timestamp: this.createdAt,
      messageId: this.messageId
    });
    
    this.encompassSync.synced = true;
    this.encompassSync.syncedAt = new Date();
    this.encompassSync.encompassLogId = result.logId;
    this.encompassSync.syncError = null;
    
    return this.save();
  } catch (error) {
    this.encompassSync.syncError = error.message;
    await this.save();
    throw error;
  }
};

// Method to generate thread ID
smsMessageSchema.methods.generateThreadId = function() {
  const participants = [this.from, this.to].sort();
  return `${participants[0]}_${participants[1]}`;
};

// Static method to create message ID
smsMessageSchema.statics.generateMessageId = function() {
  const crypto = require('crypto');
  return `sms_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
};

// Static method to find conversation thread
smsMessageSchema.statics.getConversationThread = function(phone1, phone2, limit = 50) {
  const participants = [phone1, phone2].sort();
  const threadId = `${participants[0]}_${participants[1]}`;
  
  return this.find({ threadId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('sender', 'name email role')
    .populate('recipient', 'name email role')
    .populate('loan', 'amount status propertyAddress')
    .lean();
};

// Static method to find unsynced messages
smsMessageSchema.statics.findUnsyncedMessages = function(limit = 100) {
  return this.find({
    'encompassSync.synced': false,
    'encompassSync.syncAttempts': { $lt: 3 },
    loan: { $exists: true, $ne: null },
    status: { $in: ['sent', 'delivered', 'received'] }
  })
    .sort({ createdAt: 1 })
    .limit(limit)
    .populate('loan');
};

// Static method to get message statistics
smsMessageSchema.statics.getMessageStats = async function(filters = {}) {
  const match = {};
  
  if (filters.startDate) {
    match.createdAt = { $gte: new Date(filters.startDate) };
  }
  if (filters.endDate) {
    match.createdAt = { ...match.createdAt, $lte: new Date(filters.endDate) };
  }
  if (filters.loan) {
    match.loan = filters.loan;
  }
  if (filters.sender) {
    match.sender = filters.sender;
  }
  if (filters.direction) {
    match.direction = filters.direction;
  }
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalMessages: { $sum: 1 },
        sentMessages: {
          $sum: { $cond: [{ $eq: ['$direction', 'outbound'] }, 1, 0] }
        },
        receivedMessages: {
          $sum: { $cond: [{ $eq: ['$direction', 'inbound'] }, 1, 0] }
        },
        deliveredMessages: {
          $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
        },
        failedMessages: {
          $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
        },
        syncedMessages: {
          $sum: { $cond: ['$encompassSync.synced', 1, 0] }
        },
        automatedMessages: {
          $sum: { $cond: [{ $ne: ['$messageType', 'manual'] }, 1, 0] }
        }
      }
    },
    {
      $project: {
        _id: 0,
        totalMessages: 1,
        sentMessages: 1,
        receivedMessages: 1,
        deliveredMessages: 1,
        failedMessages: 1,
        syncedMessages: 1,
        automatedMessages: 1,
        deliveryRate: {
          $cond: [
            { $gt: ['$sentMessages', 0] },
            { $multiply: [{ $divide: ['$deliveredMessages', '$sentMessages'] }, 100] },
            0
          ]
        },
        syncRate: {
          $cond: [
            { $gt: ['$totalMessages', 0] },
            { $multiply: [{ $divide: ['$syncedMessages', '$totalMessages'] }, 100] },
            0
          ]
        }
      }
    }
  ]);
};

// Pre-save hook to generate IDs and set retention
smsMessageSchema.pre('save', function(next) {
  if (this.isNew) {
    // Generate message ID if not set
    if (!this.messageId) {
      this.messageId = this.constructor.generateMessageId();
    }
    
    // Generate thread ID
    if (!this.threadId) {
      this.threadId = this.generateThreadId();
    }
    
    // Set retention expiration (7 years for compliance)
    if (!this.compliance.retentionExpiresAt) {
      this.compliance.retentionExpiresAt = new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000);
    }
    
    // Set received timestamp for inbound messages
    if (this.direction === 'inbound' && !this.receivedAt) {
      this.receivedAt = new Date();
      this.status = 'received';
    }
  }
  
  next();
});

// Ensure virtuals are included in JSON output
smsMessageSchema.set('toJSON', { virtuals: true });
smsMessageSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('SMSMessage', smsMessageSchema);
