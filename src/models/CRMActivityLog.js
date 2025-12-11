const mongoose = require('mongoose');

const crmActivityLogSchema = new mongoose.Schema(
  {
    crmContact: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CRMContact',
      required: true,
      index: true
    },
    activityType: {
      type: String,
      enum: ['message', 'push_notification', 'email', 'sms', 'call', 'journey_step', 'milestone_update', 'application_submit'],
      required: true
    },
    direction: {
      type: String,
      enum: ['inbound', 'outbound'],
      required: true
    },
    subject: String,
    content: String,
    metadata: mongoose.Schema.Types.Mixed,
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    crmSynced: {
      type: Boolean,
      default: false
    },
    crmActivityId: String,
    syncedAt: Date
  },
  {
    timestamps: true
  }
);

// Indexes for efficient querying
crmActivityLogSchema.index({ crmContact: 1, createdAt: -1 });
crmActivityLogSchema.index({ crmSynced: 1 });
crmActivityLogSchema.index({ activityType: 1, createdAt: -1 });

module.exports = mongoose.model('CRMActivityLog', crmActivityLogSchema);
