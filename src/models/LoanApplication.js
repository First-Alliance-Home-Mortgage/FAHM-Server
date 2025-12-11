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
    // Encompass integration fields
    encompassLoanId: { type: String, unique: true, sparse: true },
    lastEncompassSync: { type: Date },
    encompassData: { type: Object }, // Store additional Encompass-specific data
  },
  { timestamps: true }
);

module.exports = mongoose.model('LoanApplication', loanApplicationSchema);

