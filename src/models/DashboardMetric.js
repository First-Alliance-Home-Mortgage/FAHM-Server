const mongoose = require('mongoose');

const dashboardMetricSchema = new mongoose.Schema(
  {
    metricType: {
      type: String,
      enum: [
        'applications',
        'preapprovals',
        'funding_rate',
        'cycle_time',
        'lead_volume',
        'active_pipeline',
        'conversion_rate',
        'avg_loan_amount',
        'pull_through_rate'
      ],
      required: true,
      index: true
    },
    // Time period for metric
    periodType: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'],
      required: true,
      index: true
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
    // User/Branch/Region scope
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    branch: {
      type: String,
      index: true
    },
    region: {
      type: String,
      index: true
    },
    aggregationLevel: {
      type: String,
      enum: ['user', 'branch', 'region', 'company'],
      required: true,
      index: true
    },
    // Metric values
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    // Breakdown by product type
    byProductType: {
      conventional: Number,
      fha: Number,
      va: Number,
      usda: Number,
      jumbo: Number
    },
    // Breakdown by loan source
    byLoanSource: {
      retail: Number,
      tpo: Number,
      referral: Number
    },
    // Additional context
    totalCount: Number,
    totalVolume: Number,
    avgValue: Number,
    metadata: mongoose.Schema.Types.Mixed,
    // Comparison to previous period
    previousPeriodValue: mongoose.Schema.Types.Mixed,
    percentChange: Number,
    calculatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for efficient queries
dashboardMetricSchema.index({ metricType: 1, periodType: 1, periodStart: -1 });
dashboardMetricSchema.index({ aggregationLevel: 1, user: 1, periodStart: -1 });
dashboardMetricSchema.index({ aggregationLevel: 1, branch: 1, periodStart: -1 });
dashboardMetricSchema.index({ aggregationLevel: 1, region: 1, periodStart: -1 });

module.exports = mongoose.model('DashboardMetric', dashboardMetricSchema);
