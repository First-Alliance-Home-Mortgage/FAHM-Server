const mongoose = require('mongoose');

const rateSnapshotSchema = new mongoose.Schema(
  {
    productType: {
      type: String,
      enum: ['conventional', 'fha', 'va', 'usda', 'jumbo'],
      required: true,
      index: true
    },
    loanTerm: {
      type: Number,
      enum: [15, 20, 30],
      required: true
    },
    loanPurpose: {
      type: String,
      enum: ['purchase', 'refinance', 'cash_out_refinance'],
      default: 'purchase'
    },
    rate: {
      type: Number,
      required: true
    },
    apr: {
      type: Number,
      required: true
    },
    points: {
      type: Number,
      default: 0
    },
    lockPeriod: {
      type: Number,
      enum: [30, 45, 60],
      default: 30
    },
    // Pricing adjustments
    adjustments: {
      ltv: Number,
      creditScore: Number,
      propertyType: Number,
      occupancy: Number,
      total: Number
    },
    // Compliance and tracking
    optimalBlueRateId: String,
    investorName: String,
    source: {
      type: String,
      enum: ['optimal_blue', 'manual', 'competitor'],
      default: 'optimal_blue'
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    effectiveDate: {
      type: Date,
      default: Date.now,
      index: true
    },
    expiresAt: {
      type: Date
    },
    metadata: mongoose.Schema.Types.Mixed
  },
  {
    timestamps: true
  }
);

// Compound indexes for efficient rate queries
rateSnapshotSchema.index({ productType: 1, loanTerm: 1, isActive: 1, effectiveDate: -1 });
rateSnapshotSchema.index({ effectiveDate: -1, isActive: 1 });
rateSnapshotSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('RateSnapshot', rateSnapshotSchema);
