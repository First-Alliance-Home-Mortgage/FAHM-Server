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

module.exports = mongoose.model('Notification', notificationSchema);

