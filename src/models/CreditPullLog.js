const mongoose = require('mongoose');

const creditPullLogSchema = new mongoose.Schema(
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
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    creditReport: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CreditReport'
    },
    pullType: {
      type: String,
      enum: ['hard', 'soft'],
      default: 'hard'
    },
    purpose: {
      type: String,
      enum: ['preapproval', 'underwriting', 'reissue', 'monitoring'],
      required: true
    },
    status: {
      type: String,
      enum: ['initiated', 'completed', 'failed'],
      default: 'initiated',
      index: true
    },
    xactusTransactionId: String,
    cost: Number,
    errorMessage: String,
    borrowerConsent: {
      obtained: {
        type: Boolean,
        required: true,
        default: false
      },
      consentDate: Date,
      ipAddress: String,
      userAgent: String
    },
    notificationSent: {
      type: Boolean,
      default: false
    },
    notifiedAt: Date
  },
  {
    timestamps: true
  }
);

// Indexes for reporting and compliance
creditPullLogSchema.index({ createdAt: -1 });
creditPullLogSchema.index({ requestedBy: 1, createdAt: -1 });
creditPullLogSchema.index({ status: 1, notificationSent: 1 });

module.exports = mongoose.model('CreditPullLog', creditPullLogSchema);
