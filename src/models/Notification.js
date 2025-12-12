const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['info', 'status', 'rate_alert', 'message'], default: 'status' },
    title: { type: String, required: true },
    body: { type: String },
    read: { type: Boolean, default: false },
    metadata: { type: Object },
  },
  { timestamps: true }
);

// Indexes to optimize notification delivery and read-state queries
notificationSchema.index({ user: 1, read: 1, createdAt: -1 });
notificationSchema.index({ type: 1, user: 1 });

module.exports = mongoose.model('Notification', notificationSchema);

