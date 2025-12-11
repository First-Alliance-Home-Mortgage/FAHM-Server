const mongoose = require('mongoose');

const consentManagementSchema = new mongoose.Schema(
  {
    borrower: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    grantedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    grantedToRole: {
      type: String,
      enum: ['realtor', 'broker', 'loan_officer_tpo', 'loan_officer_retail', 'branch_manager'],
      required: true
    },
    loan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LoanApplication',
      index: true
    },
    dataScope: {
      personalInfo: {
        type: Boolean,
        default: false,
        description: 'Name, email, phone, address'
      },
      financialInfo: {
        type: Boolean,
        default: false,
        description: 'Income, assets, debts, credit score'
      },
      loanDetails: {
        type: Boolean,
        default: false,
        description: 'Loan amount, rate, terms, status'
      },
      documents: {
        type: Boolean,
        default: false,
        description: 'Uploaded documents and files'
      },
      milestones: {
        type: Boolean,
        default: false,
        description: 'Loan progress and milestone updates'
      },
      communications: {
        type: Boolean,
        default: false,
        description: 'Messages and notifications'
      }
    },
    purpose: {
      type: String,
      required: true,
      enum: [
        'referral_partnership',
        'co_branding',
        'transaction_coordination',
        'market_analysis',
        'compliance_review',
        'other'
      ]
    },
    purposeDescription: {
      type: String,
      maxlength: 500
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'revoked', 'expired'],
      default: 'pending',
      index: true
    },
    grantedAt: {
      type: Date
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    },
    revokedAt: {
      type: Date
    },
    revokedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    revocationReason: {
      type: String,
      maxlength: 500
    },
    ipAddress: {
      type: String
    },
    userAgent: {
      type: String
    },
    consentText: {
      type: String,
      required: true
    },
    consentVersion: {
      type: String,
      default: '1.0'
    },
    autoRenew: {
      type: Boolean,
      default: false
    },
    notificationPreferences: {
      emailOnGrant: {
        type: Boolean,
        default: true
      },
      emailOnRevoke: {
        type: Boolean,
        default: true
      },
      emailOnExpiry: {
        type: Boolean,
        default: true
      }
    },
    auditLog: [{
      action: {
        type: String,
        enum: ['created', 'granted', 'accessed', 'modified', 'revoked', 'expired']
      },
      performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      timestamp: {
        type: Date,
        default: Date.now
      },
      details: String,
      ipAddress: String
    }]
  },
  {
    timestamps: true
  }
);

// Compound index for efficient queries
consentManagementSchema.index({ borrower: 1, status: 1 });
consentManagementSchema.index({ grantedTo: 1, status: 1 });
consentManagementSchema.index({ loan: 1, status: 1 });
consentManagementSchema.index({ expiresAt: 1, status: 1 });

// Auto-grant consent if pending
consentManagementSchema.methods.grant = async function() {
  this.status = 'active';
  this.grantedAt = new Date();
  this.auditLog.push({
    action: 'granted',
    performedBy: this.borrower,
    timestamp: new Date(),
    details: 'Consent granted by borrower'
  });
  await this.save();
};

// Revoke consent
consentManagementSchema.methods.revoke = async function(revokedBy, reason) {
  this.status = 'revoked';
  this.revokedAt = new Date();
  this.revokedBy = revokedBy;
  this.revocationReason = reason;
  this.auditLog.push({
    action: 'revoked',
    performedBy: revokedBy,
    timestamp: new Date(),
    details: reason || 'Consent revoked'
  });
  await this.save();
};

// Check if consent is valid
consentManagementSchema.methods.isValid = function() {
  if (this.status !== 'active') return false;
  if (new Date() > this.expiresAt) {
    this.status = 'expired';
    this.save();
    return false;
  }
  return true;
};

// Log access
consentManagementSchema.methods.logAccess = async function(accessedBy, details, ipAddress) {
  this.auditLog.push({
    action: 'accessed',
    performedBy: accessedBy,
    timestamp: new Date(),
    details,
    ipAddress
  });
  await this.save();
};

// Check if specific data scope is granted
consentManagementSchema.methods.hasDataScope = function(scope) {
  return this.dataScope[scope] === true;
};

// Static method to check if user has consent to access data
consentManagementSchema.statics.hasActiveConsent = async function(borrowerId, userId, dataScope) {
  const consent = await this.findOne({
    borrower: borrowerId,
    grantedTo: userId,
    status: 'active',
    expiresAt: { $gt: new Date() }
  });

  if (!consent) return false;
  
  // If specific data scope requested, check it
  if (dataScope) {
    return consent.hasDataScope(dataScope);
  }
  
  return true;
};

// Expire old consents (run via cron)
consentManagementSchema.statics.expireConsents = async function() {
  const result = await this.updateMany(
    {
      status: 'active',
      expiresAt: { $lt: new Date() }
    },
    {
      $set: { status: 'expired' },
      $push: {
        auditLog: {
          action: 'expired',
          timestamp: new Date(),
          details: 'Consent expired automatically'
        }
      }
    }
  );
  
  return result.modifiedCount;
};

const ConsentManagement = mongoose.model('ConsentManagement', consentManagementSchema);

module.exports = ConsentManagement;
