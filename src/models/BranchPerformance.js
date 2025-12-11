const mongoose = require('mongoose');

const branchPerformanceSchema = new mongoose.Schema(
  {
    branchCode: {
      type: String,
      required: true,
      index: true
    },
    branchName: {
      type: String,
      required: true
    },
    region: {
      type: String,
      index: true
    },
    branchManager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    // Time period
    periodType: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'],
      required: true
    },
    periodStart: {
      type: Date,
      required: true,
      index: true
    },
    periodEnd: {
      type: Date,
      required: true
    },
    // Team composition
    teamSize: {
      loanOfficers: Number,
      processors: Number,
      total: Number
    },
    // Production metrics
    applications: {
      total: Number,
      retail: Number,
      tpo: Number,
      avgPerLO: Number
    },
    preapprovals: {
      total: Number,
      issued: Number,
      converted: Number,
      conversionRate: Number
    },
    pipeline: {
      activeLoans: Number,
      totalVolume: Number,
      avgLoanAmount: Number,
      byStage: {
        application: Number,
        processing: Number,
        underwriting: Number,
        closing: Number
      }
    },
    funded: {
      total: Number,
      totalVolume: Number,
      avgLoanAmount: Number,
      byProductType: {
        conventional: Number,
        fha: Number,
        va: Number,
        usda: Number,
        jumbo: Number
      }
    },
    // Performance KPIs
    fundingRate: Number, // % of apps that close
    avgCycleTime: Number, // days from app to close
    pullThroughRate: Number, // % of pipeline that closes
    conversionRate: Number, // % of leads to apps
    // Rankings
    companyRank: Number,
    regionalRank: Number,
    // Comparison to goals
    goals: {
      applications: Number,
      volume: Number,
      fundingRate: Number
    },
    goalAttainment: {
      applications: Number, // %
      volume: Number, // %
      fundingRate: Number // %
    },
    // Trend indicators
    monthOverMonth: {
      applications: Number, // % change
      volume: Number,
      fundingRate: Number
    },
    yearOverYear: {
      applications: Number,
      volume: Number,
      fundingRate: Number
    },
    calculatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for performance queries
branchPerformanceSchema.index({ branchCode: 1, periodType: 1, periodStart: -1 });
branchPerformanceSchema.index({ region: 1, periodStart: -1 });
branchPerformanceSchema.index({ branchManager: 1, periodStart: -1 });

module.exports = mongoose.model('BranchPerformance', branchPerformanceSchema);
