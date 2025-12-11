const mongoose = require('mongoose');

const rateLockSchema = new mongoose.Schema(
  {
    loan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LoanApplication',
      required: true,
      index: true
    },
    borrower: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    lockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    optimalBlueLockId: {
      type: String,
      unique: true,
      sparse: true
    },
    rateSnapshot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RateSnapshot',
      required: true
    },
    lockedRate: {
      type: Number,
      required: true
    },
    lockedAPR: {
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
      required: true
    },
    lockExpiresAt: {
      type: Date,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'extended', 'expired', 'released', 'cancelled'],
      default: 'pending',
      index: true
    },
    confirmedAt: {
      type: Date
    },
    // Lock extension tracking
    extensionHistory: [
      {
        extendedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        extendedAt: Date,
        originalExpiration: Date,
        newExpiration: Date,
        extensionDays: Number,
        extensionFee: Number,
        reason: String
      }
    ],
    // Lock details
    loanAmount: {
      type: Number,
      required: true
    },
    productType: {
      type: String,
      enum: ['conventional', 'fha', 'va', 'usda', 'jumbo'],
      required: true
    },
    loanTerm: {
      type: Number,
      enum: [15, 20, 30],
      required: true
    },
    loanPurpose: {
      type: String,
      enum: ['purchase', 'refinance', 'cashout_refinance']
    },
    propertyType: String,
    occupancy: String,
    ltv: Number,
    creditScore: Number,
    // Cost breakdown
    pricing: {
      baseRate: Number,
      adjustments: Number,
      totalAdjustment: Number,
      priceAsPercent: Number
    },
    // Investor information
    investorName: String,
    investorLockConfirmation: String,
    // Notes and communications
    notes: String,
    internalNotes: String
  },
  {
    timestamps: true
  }
);

// Indexes for lock management
rateLockSchema.index({ loan: 1, status: 1 });
rateLockSchema.index({ lockExpiresAt: 1, status: 1 });
rateLockSchema.index({ borrower: 1, createdAt: -1 });

module.exports = mongoose.model('RateLock', rateLockSchema);
