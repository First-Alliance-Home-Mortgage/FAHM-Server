const mongoose = require('mongoose');

const loanContactSchema = new mongoose.Schema(
  {
    loan: { type: mongoose.Schema.Types.ObjectId, ref: 'LoanApplication', required: true },
    role: {
      type: String,
      enum: ['loan_officer', 'processor', 'underwriter', 'closer', 'other'],
      required: true,
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, required: true },
    email: { type: String },
    phone: { type: String },
    encompassId: { type: String }, // External Encompass user ID
    isPrimary: { type: Boolean, default: false },
  },
  { timestamps: true }
);

loanContactSchema.index({ loan: 1, role: 1 });

module.exports = mongoose.model('LoanContact', loanContactSchema);
