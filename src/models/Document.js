const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
  {
    loan: { type: mongoose.Schema.Types.ObjectId, ref: 'LoanApplication', required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    type: { type: String, enum: ['pdf', 'png', 'jpg', 'jpeg'], default: 'pdf' },
    size: { type: Number }, // bytes
    hash: { type: String, index: true },
    url: { type: String, required: true },
    status: { type: String, enum: ['pending', 'synced'], default: 'pending' },
    scanned: { type: Boolean, default: false },
    scannedAt: { type: Date },
    tempBlobExpiresAt: { type: Date },
  },
  { timestamps: true }
);

// Indexes for common document lookups and cleanup of temp blobs
documentSchema.index({ loan: 1, createdAt: -1 });
documentSchema.index({ uploadedBy: 1, createdAt: -1 });
documentSchema.index({ status: 1, createdAt: -1 });
documentSchema.index(
  { tempBlobExpiresAt: 1 },
  {
    expireAfterSeconds: 0,
    partialFilterExpression: { tempBlobExpiresAt: { $exists: true } }
  }
);

module.exports = mongoose.model('Document', documentSchema);

