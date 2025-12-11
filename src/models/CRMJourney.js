const mongoose = require('mongoose');

const crmJourneySchema = new mongoose.Schema(
  {
    crmJourneyId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    name: {
      type: String,
      required: true
    },
    description: String,
    triggerType: {
      type: String,
      enum: ['milestone_update', 'new_lead', 'application_submit', 'manual', 'scheduled'],
      required: true
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'draft'],
      default: 'active'
    },
    steps: [{
      stepId: String,
      name: String,
      type: {
        type: String,
        enum: ['email', 'sms', 'push_notification', 'task', 'wait']
      },
      delayMinutes: Number,
      content: String
    }],
    targetAudience: {
      contactTypes: [String],
      tags: [String]
    },
    metrics: {
      totalEnrolled: { type: Number, default: 0 },
      completed: { type: Number, default: 0 },
      active: { type: Number, default: 0 }
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

module.exports = mongoose.model('CRMJourney', crmJourneySchema);
