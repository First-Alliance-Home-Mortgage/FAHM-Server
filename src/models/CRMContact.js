const mongoose = require('mongoose');

const crmContactSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    crmContactId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    contactType: {
      type: String,
      enum: ['borrower', 'partner', 'referral_source', 'realtor', 'other'],
      required: true
    },
    firstName: String,
    lastName: String,
    email: String,
    phone: String,
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    tags: [String],
    status: {
      type: String,
      enum: ['active', 'inactive', 'archived'],
      default: 'active'
    },
    engagementScore: {
      type: Number,
      default: 0
    },
    lastEngagementDate: Date,
    journeys: [{
      journeyId: String,
      journeyName: String,
      status: {
        type: String,
        enum: ['active', 'completed', 'paused', 'cancelled']
      },
      startedAt: Date,
      completedAt: Date
    }],
    customFields: mongoose.Schema.Types.Mixed,
    lastSyncedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Compound index for efficient queries
crmContactSchema.index({ user: 1, contactType: 1 });
crmContactSchema.index({ assignedTo: 1, status: 1 });

module.exports = mongoose.model('CRMContact', crmContactSchema);
