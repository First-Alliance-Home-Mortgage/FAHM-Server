const mongoose = require('mongoose');

/**
 * ReferralSource Model
 * Tracks referral partners (realtors, builders, financial planners, etc.)
 * with branding, contact info, and performance analytics
 */
const referralSourceSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  type: {
    type: String,
    enum: ['realtor', 'builder', 'financial_planner', 'attorney', 'cpa', 'other'],
    required: true,
    default: 'realtor'
  },
  companyName: {
    type: String,
    trim: true,
    maxlength: 100
  },
  
  // Contact Information
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  phone: {
    type: String,
    trim: true
  },
  website: {
    type: String,
    trim: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String
  },
  
  // Branding Assets
  branding: {
    logo: {
      type: String,
      trim: true,
      maxlength: 500
    },
    primaryColor: {
      type: String,
      trim: true,
      match: /^#[0-9A-Fa-f]{6}$/,
      default: '#003B5C' // FAHM default blue
    },
    secondaryColor: {
      type: String,
      trim: true,
      match: /^#[0-9A-Fa-f]{6}$/,
      default: '#FF6B35' // FAHM default orange
    },
    tagline: {
      type: String,
      trim: true,
      maxlength: 150
    },
    customMessage: {
      type: String,
      trim: true,
      maxlength: 500
    }
  },
  
  // Social Media Links
  socialMedia: {
    facebook: String,
    instagram: String,
    linkedin: String,
    twitter: String
  },
  
  // License and Credentials
  licenseNumber: {
    type: String,
    trim: true
  },
  licenseState: {
    type: String,
    trim: true,
    uppercase: true,
    maxlength: 2
  },
  
  // Relationship Management
  assignedLoanOfficer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  partnershipTier: {
    type: String,
    enum: ['bronze', 'silver', 'gold', 'platinum'],
    default: 'bronze'
  },
  partnershipStartDate: {
    type: Date,
    default: Date.now
  },
  
  // Co-Branding Preferences
  coBrandingSettings: {
    enablePreapprovalLetters: {
      type: Boolean,
      default: true
    },
    enableBusinessCards: {
      type: Boolean,
      default: true
    },
    enableEmailCommunications: {
      type: Boolean,
      default: true
    },
    enableBorrowerView: {
      type: Boolean,
      default: true
    },
    customDisclaimer: {
      type: String,
      trim: true,
      maxlength: 500
    }
  },
  
  // Analytics Counters
  analytics: {
    totalLeads: {
      type: Number,
      default: 0
    },
    totalApplications: {
      type: Number,
      default: 0
    },
    totalPreapprovals: {
      type: Number,
      default: 0
    },
    totalFundedLoans: {
      type: Number,
      default: 0
    },
    totalFundedVolume: {
      type: Number,
      default: 0
    },
    lastReferralDate: Date,
    conversionRate: {
      type: Number,
      default: 0
    }
  },
  
  // Status and Activity
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for performance
referralSourceSchema.index({ assignedLoanOfficer: 1 });
referralSourceSchema.index({ status: 1 });
referralSourceSchema.index({ type: 1 });
referralSourceSchema.index({ 'analytics.totalLeads': -1 });
referralSourceSchema.index({ 'analytics.totalFundedLoans': -1 });
referralSourceSchema.index({ partnershipTier: 1, status: 1 });

// Virtual for full name with company
referralSourceSchema.virtual('fullName').get(function() {
  return this.companyName ? `${this.name} (${this.companyName})` : this.name;
});

// Method to increment analytics counters
referralSourceSchema.methods.incrementLead = function() {
  this.analytics.totalLeads += 1;
  this.analytics.lastReferralDate = new Date();
  return this.save();
};

referralSourceSchema.methods.incrementApplication = function() {
  this.analytics.totalApplications += 1;
  this.analytics.conversionRate = this.analytics.totalLeads > 0 
    ? (this.analytics.totalApplications / this.analytics.totalLeads) * 100 
    : 0;
  return this.save();
};

referralSourceSchema.methods.incrementPreapproval = function() {
  this.analytics.totalPreapprovals += 1;
  return this.save();
};

referralSourceSchema.methods.incrementFundedLoan = function(loanAmount) {
  this.analytics.totalFundedLoans += 1;
  this.analytics.totalFundedVolume += loanAmount;
  return this.save();
};

// Method to get branding configuration
referralSourceSchema.methods.getBrandingConfig = function() {
  return {
    name: this.name,
    companyName: this.companyName,
    logo: this.branding.logo,
    primaryColor: this.branding.primaryColor,
    secondaryColor: this.branding.secondaryColor,
    tagline: this.branding.tagline,
    customMessage: this.branding.customMessage,
    email: this.email,
    phone: this.phone,
    website: this.website
  };
};

// Method to check if co-branding is enabled for a specific feature
referralSourceSchema.methods.isCoBrandingEnabled = function(feature) {
  const featureMap = {
    'preapproval': 'enablePreapprovalLetters',
    'business_card': 'enableBusinessCards',
    'email': 'enableEmailCommunications',
    'borrower_view': 'enableBorrowerView'
  };
  
  const setting = featureMap[feature];
  return setting ? this.coBrandingSettings[setting] : false;
};

// Static method to get top performers
referralSourceSchema.statics.getTopPerformers = function(limit = 10, metric = 'totalFundedLoans') {
  const sortField = `analytics.${metric}`;
  return this.find({ status: 'active' })
    .sort({ [sortField]: -1 })
    .limit(limit)
    .populate('assignedLoanOfficer', 'name email')
    .lean();
};

// Static method to get referral sources by loan officer
referralSourceSchema.statics.getByLoanOfficer = function(loanOfficerId) {
  return this.find({ 
    assignedLoanOfficer: loanOfficerId,
    status: 'active'
  })
    .sort({ 'analytics.totalLeads': -1 })
    .lean();
};

// Pre-save hook to calculate conversion rate
referralSourceSchema.pre('save', function(next) {
  if (this.isModified('analytics.totalLeads') || this.isModified('analytics.totalApplications')) {
    this.analytics.conversionRate = this.analytics.totalLeads > 0 
      ? parseFloat(((this.analytics.totalApplications / this.analytics.totalLeads) * 100).toFixed(2))
      : 0;
  }
  next();
});

// Ensure virtuals are included in JSON output
referralSourceSchema.set('toJSON', { virtuals: true });
referralSourceSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('ReferralSource', referralSourceSchema);
