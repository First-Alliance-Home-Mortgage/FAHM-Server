const mongoose = require('mongoose');

/**
 * ReferralSourceAnalytics Model
 * Time-series data for tracking referral source performance over time
 * Supports daily, monthly, and yearly aggregations
 */
const referralSourceAnalyticsSchema = new mongoose.Schema({
  // Reference to referral source
  referralSource: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ReferralSource',
    required: true,
    index: true
  },
  
  // Time period
  periodType: {
    type: String,
    enum: ['daily', 'monthly', 'yearly'],
    required: true
  },
  periodDate: {
    type: Date,
    required: true,
    index: true
  },
  
  // Lead Metrics
  leads: {
    total: {
      type: Number,
      default: 0
    },
    new: {
      type: Number,
      default: 0
    },
    returning: {
      type: Number,
      default: 0
    }
  },
  
  // Application Metrics
  applications: {
    total: {
      type: Number,
      default: 0
    },
    started: {
      type: Number,
      default: 0
    },
    submitted: {
      type: Number,
      default: 0
    },
    conversionRate: {
      type: Number,
      default: 0
    }
  },
  
  // Preapproval Metrics
  preapprovals: {
    total: {
      type: Number,
      default: 0
    },
    issued: {
      type: Number,
      default: 0
    },
    used: {
      type: Number,
      default: 0
    }
  },
  
  // Loan Pipeline Metrics
  loans: {
    inProgress: {
      type: Number,
      default: 0
    },
    underwriting: {
      type: Number,
      default: 0
    },
    approved: {
      type: Number,
      default: 0
    },
    funded: {
      type: Number,
      default: 0
    },
    withdrawn: {
      type: Number,
      default: 0
    },
    denied: {
      type: Number,
      default: 0
    }
  },
  
  // Revenue Metrics
  revenue: {
    totalLoanVolume: {
      type: Number,
      default: 0
    },
    averageLoanAmount: {
      type: Number,
      default: 0
    },
    estimatedCommission: {
      type: Number,
      default: 0
    }
  },
  
  // Engagement Metrics
  engagement: {
    emailOpens: {
      type: Number,
      default: 0
    },
    emailClicks: {
      type: Number,
      default: 0
    },
    appLogins: {
      type: Number,
      default: 0
    },
    documentsUploaded: {
      type: Number,
      default: 0
    },
    messagesExchanged: {
      type: Number,
      default: 0
    }
  },
  
  // Co-Branding Usage
  coBrandingUsage: {
    preapprovalLettersGenerated: {
      type: Number,
      default: 0
    },
    businessCardsViewed: {
      type: Number,
      default: 0
    },
    coBrandedEmailsSent: {
      type: Number,
      default: 0
    }
  },
  
  // Product Type Breakdown
  productTypes: [{
    name: {
      type: String,
      enum: ['conventional', 'fha', 'va', 'usda', 'jumbo', 'other']
    },
    count: {
      type: Number,
      default: 0
    },
    volume: {
      type: Number,
      default: 0
    }
  }],
  
  // Metadata
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
referralSourceAnalyticsSchema.index({ referralSource: 1, periodType: 1, periodDate: -1 });
referralSourceAnalyticsSchema.index({ periodType: 1, periodDate: -1 });
referralSourceAnalyticsSchema.index({ 'revenue.totalLoanVolume': -1 });

// Method to calculate conversion rate
referralSourceAnalyticsSchema.methods.calculateConversionRate = function() {
  if (this.leads.total > 0) {
    this.applications.conversionRate = parseFloat(
      ((this.applications.submitted / this.leads.total) * 100).toFixed(2)
    );
  } else {
    this.applications.conversionRate = 0;
  }
  return this.applications.conversionRate;
};

// Method to calculate average loan amount
referralSourceAnalyticsSchema.methods.calculateAverageLoanAmount = function() {
  if (this.loans.funded > 0) {
    this.revenue.averageLoanAmount = parseFloat(
      (this.revenue.totalLoanVolume / this.loans.funded).toFixed(2)
    );
  } else {
    this.revenue.averageLoanAmount = 0;
  }
  return this.revenue.averageLoanAmount;
};

// Method to update product type breakdown
referralSourceAnalyticsSchema.methods.addProductType = function(productType, loanAmount) {
  const existingProduct = this.productTypes.find(p => p.name === productType);
  
  if (existingProduct) {
    existingProduct.count += 1;
    existingProduct.volume += loanAmount;
  } else {
    this.productTypes.push({
      name: productType,
      count: 1,
      volume: loanAmount
    });
  }
  
  return this.save();
};

// Static method to aggregate analytics by date range
referralSourceAnalyticsSchema.statics.getAnalyticsByDateRange = function(
  referralSourceId,
  startDate,
  endDate,
  periodType = 'daily'
) {
  return this.find({
    referralSource: referralSourceId,
    periodType: periodType,
    periodDate: { $gte: startDate, $lte: endDate }
  })
    .sort({ periodDate: 1 })
    .lean();
};

// Static method to get top performing referral sources
referralSourceAnalyticsSchema.statics.getTopPerformers = function(
  startDate,
  endDate,
  // metric = 'revenue.totalLoanVolume',
  limit = 10
) {
  return this.aggregate([
    {
      $match: {
        periodDate: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: '$referralSource',
        totalVolume: { $sum: '$revenue.totalLoanVolume' },
        totalLoans: { $sum: '$loans.funded' },
        totalLeads: { $sum: '$leads.total' },
        totalApplications: { $sum: '$applications.submitted' }
      }
    },
    {
      $lookup: {
        from: 'referralsources',
        localField: '_id',
        foreignField: '_id',
        as: 'referralSource'
      }
    },
    {
      $unwind: '$referralSource'
    },
    {
      $sort: { totalVolume: -1 }
    },
    {
      $limit: limit
    },
    {
      $project: {
        _id: 1,
        name: '$referralSource.name',
        companyName: '$referralSource.companyName',
        totalVolume: 1,
        totalLoans: 1,
        totalLeads: 1,
        totalApplications: 1,
        conversionRate: {
          $cond: [
            { $gt: ['$totalLeads', 0] },
            { $multiply: [{ $divide: ['$totalApplications', '$totalLeads'] }, 100] },
            0
          ]
        }
      }
    }
  ]);
};

// Static method to create or update analytics record
referralSourceAnalyticsSchema.statics.createOrUpdatePeriod = async function(
  referralSourceId,
  periodType,
  periodDate,
  updateData
) {
  const record = await this.findOneAndUpdate(
    {
      referralSource: referralSourceId,
      periodType: periodType,
      periodDate: periodDate
    },
    {
      $inc: updateData,
      $set: { lastUpdated: new Date() }
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true
    }
  );
  
  // Recalculate derived metrics
  record.calculateConversionRate();
  record.calculateAverageLoanAmount();
  await record.save();
  
  return record;
};

// Pre-save hook to update calculated fields
referralSourceAnalyticsSchema.pre('save', function(next) {
  this.calculateConversionRate();
  this.calculateAverageLoanAmount();
  this.lastUpdated = new Date();
  next();
});

module.exports = mongoose.model('ReferralSourceAnalytics', referralSourceAnalyticsSchema);
