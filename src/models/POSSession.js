const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * POSSession Model
 * Tracks secure handoff sessions between FAHM app and POS systems (Blend, Big POS)
 * Includes encrypted tokens, expiration, analytics, and audit trail
 */
const posSessionSchema = new mongoose.Schema({
  // Session Identification
  sessionToken: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // References
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  loan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LoanApplication',
    index: true
  },
  loanOfficer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  referralSource: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ReferralSource'
  },
  
  // POS System Configuration
  posSystem: {
    type: String,
    enum: ['blend', 'big_pos', 'encompass_consumer_connect'],
    required: true
  },
  posEnvironment: {
    type: String,
    enum: ['sandbox', 'production'],
    default: 'production'
  },
  
  // Session Data (encrypted)
  encryptedData: {
    type: String,
    required: true
  },
  encryptionIV: {
    type: String,
    required: true
  },
  
  // Session Metadata
  purpose: {
    type: String,
    enum: ['new_application', 'continue_application', 'document_upload', 'rate_lock', 'disclosure_review'],
    required: true
  },
  source: {
    type: String,
    enum: ['mobile_app', 'web_app', 'business_card', 'calculator', 'preapproval_letter', 'email_link'],
    default: 'mobile_app'
  },
  
  // Status Tracking
  status: {
    type: String,
    enum: ['pending', 'active', 'completed', 'expired', 'cancelled', 'failed'],
    default: 'pending',
    index: true
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  activatedAt: Date,
  completedAt: Date,
  
  // POS URLs
  redirectUrl: {
    type: String,
    required: true
  },
  callbackUrl: String,
  returnUrl: String,
  
  // Analytics
  analytics: {
    ipAddress: String,
    userAgent: String,
    deviceType: {
      type: String,
      enum: ['mobile', 'tablet', 'desktop', 'unknown'],
      default: 'unknown'
    },
    platform: {
      type: String,
      enum: ['ios', 'android', 'web', 'unknown'],
      default: 'unknown'
    },
    timeToActivation: Number, // seconds
    timeToCompletion: Number, // seconds
    pageViews: {
      type: Number,
      default: 0
    },
    documentsUploaded: {
      type: Number,
      default: 0
    },
    stepsCompleted: {
      type: Number,
      default: 0
    },
    totalSteps: Number
  },
  
  // Branding Configuration
  branding: {
    theme: {
      type: String,
      enum: ['fahm_default', 'co_branded', 'white_label'],
      default: 'fahm_default'
    },
    primaryColor: String,
    secondaryColor: String,
    logo: String,
    partnerLogo: String,
    partnerName: String
  },
  
  // Completion Data
  completionData: {
    applicationId: String,
    loanNumber: String,
    encompassLoanId: String,
    status: String,
    completedSteps: [String],
    nextSteps: [String],
    documentsSubmitted: [{
      documentType: String,
      fileName: String,
      uploadedAt: Date
    }]
  },
  
  // Error Tracking
  errors: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    errorCode: String,
    errorMessage: String,
    errorDetails: Object
  }],
  
  // Audit Trail
  auditLog: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    action: {
      type: String,
      enum: ['created', 'activated', 'viewed', 'step_completed', 'document_uploaded', 'completed', 'expired', 'cancelled', 'error']
    },
    details: String,
    ipAddress: String,
    userAgent: String
  }]
}, {
  timestamps: true,
  suppressReservedKeysWarning: true
});

// Indexes for performance
posSessionSchema.index({ user: 1, status: 1 });
posSessionSchema.index({ loan: 1, status: 1 });
posSessionSchema.index({ loanOfficer: 1, createdAt: -1 });
posSessionSchema.index({ status: 1, expiresAt: 1 });
posSessionSchema.index({ posSystem: 1, status: 1 });
posSessionSchema.index({ createdAt: -1 });

// Static method to generate session token
posSessionSchema.statics.generateSessionToken = function() {
  return crypto.randomBytes(32).toString('hex');
};

// Static method to generate session ID
posSessionSchema.statics.generateSessionId = function() {
  return `pos_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
};

// Method to encrypt session data
posSessionSchema.methods.encryptSessionData = function(data) {
  const algorithm = 'aes-256-cbc';
  const key = Buffer.from(process.env.POS_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex'), 'hex');
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  this.encryptedData = encrypted;
  this.encryptionIV = iv.toString('hex');
  
  return { encrypted, iv: iv.toString('hex') };
};

// Method to decrypt session data
posSessionSchema.methods.decryptSessionData = function() {
  const algorithm = 'aes-256-cbc';
  const key = Buffer.from(process.env.POS_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex'), 'hex');
  const iv = Buffer.from(this.encryptionIV, 'hex');
  
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(this.encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return JSON.parse(decrypted);
};

// Method to check if session is expired
posSessionSchema.methods.isExpired = function() {
  return new Date() > this.expiresAt;
};

// Method to check if session is valid
posSessionSchema.methods.isValid = function() {
  return this.status === 'active' && !this.isExpired();
};

// Method to activate session
posSessionSchema.methods.activate = function(analytics = {}) {
  this.status = 'active';
  this.activatedAt = new Date();
  
  if (analytics.ipAddress) this.analytics.ipAddress = analytics.ipAddress;
  if (analytics.userAgent) this.analytics.userAgent = analytics.userAgent;
  if (analytics.deviceType) this.analytics.deviceType = analytics.deviceType;
  if (analytics.platform) this.analytics.platform = analytics.platform;
  
  const timeToActivation = Math.floor((this.activatedAt - this.createdAt) / 1000);
  this.analytics.timeToActivation = timeToActivation;
  
  this.auditLog.push({
    action: 'activated',
    details: 'Session activated by user',
    ipAddress: analytics.ipAddress,
    userAgent: analytics.userAgent
  });
  
  return this.save();
};

// Method to complete session
posSessionSchema.methods.complete = function(completionData = {}) {
  this.status = 'completed';
  this.completedAt = new Date();
  
  if (this.activatedAt) {
    const timeToCompletion = Math.floor((this.completedAt - this.activatedAt) / 1000);
    this.analytics.timeToCompletion = timeToCompletion;
  }
  
  if (completionData) {
    this.completionData = { ...this.completionData, ...completionData };
  }
  
  this.auditLog.push({
    action: 'completed',
    details: 'Session completed successfully'
  });
  
  return this.save();
};

// Method to mark session as failed
posSessionSchema.methods.fail = function(errorDetails) {
  this.status = 'failed';
  
  this.errors.push({
    errorCode: errorDetails.code || 'UNKNOWN_ERROR',
    errorMessage: errorDetails.message || 'Unknown error occurred',
    errorDetails: errorDetails.details || {}
  });
  
  this.auditLog.push({
    action: 'error',
    details: errorDetails.message || 'Session failed'
  });
  
  return this.save();
};

// Method to track analytics event
posSessionSchema.methods.trackEvent = function(eventType, details = {}) {
  switch (eventType) {
    case 'page_view':
      this.analytics.pageViews += 1;
      break;
    case 'document_upload':
      this.analytics.documentsUploaded += 1;
      break;
    case 'step_complete':
      this.analytics.stepsCompleted += 1;
      break;
  }
  
  this.auditLog.push({
    action: eventType,
    details: JSON.stringify(details)
  });
  
  return this.save();
};

// Method to log audit event
posSessionSchema.methods.logAudit = function(action, details, ipAddress, userAgent) {
  this.auditLog.push({
    action,
    details,
    ipAddress,
    userAgent
  });
  
  return this.save();
};

// Static method to expire old sessions
posSessionSchema.statics.expireOldSessions = async function() {
  const now = new Date();
  
  const result = await this.updateMany(
    {
      status: { $in: ['pending', 'active'] },
      expiresAt: { $lt: now }
    },
    {
      $set: { status: 'expired' },
      $push: {
        auditLog: {
          action: 'expired',
          details: 'Session expired automatically',
          timestamp: now
        }
      }
    }
  );
  
  return result;
};

// Pre-save hook to validate expiration
posSessionSchema.pre('save', function(next) {
  if (this.isNew && !this.expiresAt) {
    // Default expiration: 1 hour
    this.expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  }
  next();
});

module.exports = mongoose.model('POSSession', posSessionSchema);
