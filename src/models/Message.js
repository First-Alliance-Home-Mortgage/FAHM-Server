const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    loan: { type: mongoose.Schema.Types.ObjectId, ref: 'LoanApplication', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    messageType: {
      type: String,
      enum: ['text', 'system', 'document', 'milestone'],
      default: 'text',
    },
    content: { type: String, required: true },
    read: { type: Boolean, default: false },
    readAt: { type: Date },
    metadata: { type: Object },
    encompassSynced: { type: Boolean, default: false },
  },
  { timestamps: true }
);

messageSchema.index({ loan: 1, createdAt: -1 });
messageSchema.index({ recipient: 1, read: 1 });

module.exports = mongoose.model('Message', messageSchema);
