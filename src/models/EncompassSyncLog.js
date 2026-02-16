const mongoose = require('mongoose');

const encompassSyncLogSchema = new mongoose.Schema(
  {
    loan: { type: mongoose.Schema.Types.ObjectId, ref: 'LoanApplication' },
    syncType: {
      type: String,
      enum: ['status', 'milestones', 'contacts', 'documents', 'full', 'link', 'unlink', 'webhook'],
      required: true,
    },
    direction: {
      type: String,
      enum: ['inbound', 'outbound'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'success', 'failed', 'partial'],
      default: 'pending',
    },
    encompassLoanId: { type: String },
    dataSnapshot: { type: Object },
    errorMessage: { type: String },
    syncDuration: { type: Number }, // milliseconds
  },
  { timestamps: true }
);

encompassSyncLogSchema.index({ loan: 1, createdAt: -1 });
encompassSyncLogSchema.index({ status: 1, syncType: 1 });

module.exports = mongoose.model('EncompassSyncLog', encompassSyncLogSchema);
