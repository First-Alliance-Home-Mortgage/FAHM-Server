const mongoose = require('mongoose');

const productPricingSchema = new mongoose.Schema(
  {
    productName: {
      type: String,
      required: true
    },
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
    investorName: {
      type: String,
      required: true
    },
    optimalBlueProductId: {
      type: String,
      unique: true,
      sparse: true
    },
    baseRate: {
      type: Number,
      required: true
    },
    basePrice: {
      type: Number,
      required: true
    },
    // Loan limits
    minLoanAmount: {
      type: Number,
      default: 0
    },
    maxLoanAmount: {
      type: Number,
      required: true
    },
    // LTV requirements
    minLTV: {
      type: Number,
      default: 0
    },
    maxLTV: {
      type: Number,
      required: true
    },
    // Credit score requirements
    minCreditScore: {
      type: Number,
      required: true
    },
    // Property types allowed
    allowedPropertyTypes: [{
      type: String,
      enum: ['single_family', 'condo', 'townhouse', 'multi_family', 'manufactured']
    }],
    // Occupancy types
    allowedOccupancy: [{
      type: String,
      enum: ['primary', 'second_home', 'investment']
    }],
    // Program features
    features: {
      armType: String,
      buydown: Boolean,
      interestOnly: Boolean,
      balloonPayment: Boolean,
      prepaymentPenalty: Boolean
    },
    // Pricing adjustments matrix
    adjustments: mongoose.Schema.Types.Mixed,
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    effectiveDate: {
      type: Date,
      default: Date.now
    },
    lastSyncedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Indexes for product searches
productPricingSchema.index({ productType: 1, loanTerm: 1, isActive: 1 });
productPricingSchema.index({ investorName: 1, isActive: 1 });

module.exports = mongoose.model('ProductPricing', productPricingSchema);
