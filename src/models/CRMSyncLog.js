const mongoose = require('mongoose');

const crmSyncLogSchema = new mongoose.Schema(
  {
    syncType: {
      type: String,
      enum: ['contact', 'journey', 'activity', 'full'],
      required: true
    },
    direction: {
      type: String,
      enum: ['inbound', 'outbound', 'bidirectional'],
      required: true
    },
    status: {
      type: String,
      enum: ['success', 'partial', 'failed'],
      required: true
    },
    recordsProcessed: {
      type: Number,
      default: 0
    },
    recordsSucceeded: {
      type: Number,
      default: 0
    },
    recordsFailed: {
      type: Number,
      default: 0
    },
    errorMessage: String,
    dataSnapshot: mongoose.Schema.Types.Mixed,
    syncDuration: Number // in milliseconds
  },
  {
    timestamps: true
  }
);

// Indexes for reporting
crmSyncLogSchema.index({ syncType: 1, createdAt: -1 });
crmSyncLogSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('CRMSyncLog', crmSyncLogSchema);
