const mongoose = require('mongoose');

const rateAlertSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    productType: {
      type: String,
      enum: ['conventional', 'fha', 'va', 'usda', 'jumbo'],
      required: true
    },
    loanTerm: {
      type: Number,
      enum: [10, 15, 20, 25, 30],
      required: true
    },
    
    // Loan scenario for rate matching
    loanAmount: {
      type: Number,
      min: 0,
      default: 300000
    },
    creditScore: {
      type: Number,
      min: 300,
      max: 850,
      default: 740
    },
    ltv: {
      type: Number,
      min: 0,
      max: 100,
      default: 80
    },
    propertyType: {
      type: String,
      enum: ['single_family', 'condo', 'townhouse', 'multi_family', 'manufactured'],
      default: 'single_family'
    },
    
    targetRate: {
      type: Number,
      required: function() {
        return this.triggerType !== 'drops_by';
      }
    },
    triggerType: {
      type: String,
      enum: ['below', 'above', 'drops_by'],
      default: 'below'
    },
    dropAmount: {
      type: Number,
      default: 0.125 // Trigger when rate drops by this much
    },
    baselineRate: {
      type: Number // For drops_by trigger type
    },
    notificationMethod: {
      type: String,
      enum: ['push', 'sms', 'email', 'all'],
      default: 'push'
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'triggered', 'expired', 'cancelled'],
      default: 'active',
      index: true
    },
    loan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LoanApplication'
    },
    lastCheckedAt: Date,
    triggeredAt: Date,
    triggeredRate: Number,
    notificationSent: {
      type: Boolean,
      default: false
    },
    expiresAt: {
      type: Date,
      default: function() {
        return new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days
      },
      index: true
    },
    
    // Trigger history
    triggerHistory: [{
      triggeredAt: Date,
      currentRate: Number,
      targetRate: Number,
      notificationSent: Boolean,
      notificationMethod: String,
      crmLoggedAt: Date
    }],
    
    // CRM integration
    crmActivityId: String,
    totalExpertContactId: String
  },
  {
    timestamps: true
  }
);

// Indexes for efficient alert processing
rateAlertSchema.index({ user: 1, status: 1 });
rateAlertSchema.index({ status: 1, lastCheckedAt: 1 });
rateAlertSchema.index({ productType: 1, loanTerm: 1, status: 1 });
rateAlertSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL

/**
 * Check if alert should trigger based on current rate
 */
rateAlertSchema.methods.shouldTrigger = function(currentRate) {
  if (this.status !== 'active') return false;
  
  switch (this.triggerType) {
    case 'below':
      return currentRate <= this.targetRate;
    case 'above':
      return currentRate >= this.targetRate;
    case 'drops_by':
      return this.baselineRate && (this.baselineRate - currentRate) >= this.dropAmount;
    default:
      return false;
  }
};

/**
 * Trigger alert
 */
rateAlertSchema.methods.trigger = async function(currentRate, notificationMethod) {
  this.status = 'triggered';
  this.triggeredAt = new Date();
  this.triggeredRate = currentRate;
  
  this.triggerHistory.push({
    triggeredAt: new Date(),
    currentRate,
    targetRate: this.targetRate || this.baselineRate,
    notificationSent: false,
    notificationMethod
  });
  
  await this.save();
};

/**
 * Mark notification sent
 */
rateAlertSchema.methods.markNotificationSent = async function() {
  this.notificationSent = true;
  if (this.triggerHistory.length > 0) {
    this.triggerHistory[this.triggerHistory.length - 1].notificationSent = true;
  }
  await this.save();
};

/**
 * Mark CRM logged
 */
rateAlertSchema.methods.markCRMLogged = async function(crmActivityId) {
  this.crmActivityId = crmActivityId;
  if (this.triggerHistory.length > 0) {
    this.triggerHistory[this.triggerHistory.length - 1].crmLoggedAt = new Date();
  }
  await this.save();
};

/**
 * Static: Find alerts to check
 */
rateAlertSchema.statics.findAlertsToCheck = function(minutesAgo = 30) {
  const checkThreshold = new Date(Date.now() - minutesAgo * 60 * 1000);
  return this.find({
    status: 'active',
    $or: [
      { lastCheckedAt: { $lt: checkThreshold } },
      { lastCheckedAt: { $exists: false } }
    ],
    expiresAt: { $gt: new Date() }
  }).populate('user', 'name email phone');
};

/**
 * Static: Expire old alerts
 */
rateAlertSchema.statics.expireOldAlerts = async function() {
  const result = await this.updateMany(
    {
      status: { $in: ['active', 'paused'] },
      expiresAt: { $lt: new Date() }
    },
    { $set: { status: 'expired' } }
  );
  return result.modifiedCount;
};

module.exports = mongoose.model('RateAlert', rateAlertSchema);
