const mongoose = require('mongoose');

const milestoneSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    status: { type: String, enum: ['pending', 'in_progress', 'completed'], default: 'pending' },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const loanApplicationSchema = new mongoose.Schema(
  {
    borrower: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignedOfficer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    amount: { type: Number, required: true },
    propertyAddress: { type: String },
    status: {
      type: String,
      enum: ['application', 'processing', 'underwriting', 'closing', 'funded'],
      default: 'application',
    },
    milestones: [milestoneSchema],
    source: { type: String, enum: ['retail', 'tpo'], default: 'retail' },
    // Referral source for co-branding
    referralSource: { type: mongoose.Schema.Types.ObjectId, ref: 'ReferralSource' },
    // Encompass integration fields
    encompassLoanId: { type: String, unique: true, sparse: true },
    lastEncompassSync: { type: Date },
    encompassData: { type: Object }, // Store additional Encompass-specific data
    // POS integration fields
    posSystem: { type: String, enum: ['blend', 'big_pos'], sparse: true },
    posApplicationId: { type: String, sparse: true },
    lastPOSSync: { type: Date },
  },
  { timestamps: true }
);

// Query indexes to speed up borrower/officer/referral lookups
loanApplicationSchema.index({ borrower: 1, status: 1 });
loanApplicationSchema.index({ assignedOfficer: 1, status: 1 });
loanApplicationSchema.index({ referralSource: 1, status: 1 });
loanApplicationSchema.index({ posSystem: 1, posApplicationId: 1 });
loanApplicationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('LoanApplication', loanApplicationSchema);

