const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
  {
    loan: { type: mongoose.Schema.Types.ObjectId, ref: 'LoanApplication', required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['pdf', 'png', 'jpg', 'jpeg'], default: 'pdf' },
    size: { type: Number, required: false }, // bytes
    hash: { type: String, index: true },
    url: { type: String, required: true },
    storageKey: { type: String },
    status: { type: String, enum: ['pending', 'uploaded', 'synced', 'failed', 'deleted'], default: 'pending' },
    avStatus: { type: String, enum: ['pending', 'clean', 'infected'], default: 'pending' },
    scanned: { type: Boolean, default: false },
    scannedAt: { type: Date },
    tempBlobExpiresAt: { type: Date },
    versions: [
      {
        url: String,
        storageKey: String,
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

documentSchema.pre('save', function setOwner(next) {
  if (!this.owner) {
    this.owner = this.uploadedBy;
  }
  if (!this.storageKey && this.url) {
    this.storageKey = this.url;
  }
  next();
});

// Indexes for common document lookups and cleanup of temp blobs
documentSchema.index({ loan: 1, createdAt: -1 });
documentSchema.index({ owner: 1, status: 1, createdAt: -1 });
documentSchema.index({ uploadedBy: 1, createdAt: -1 });
documentSchema.index({ status: 1, createdAt: -1 });
documentSchema.index({ avStatus: 1, createdAt: -1 });
documentSchema.index(
  { tempBlobExpiresAt: 1 },
  {
    expireAfterSeconds: 0,
    partialFilterExpression: { tempBlobExpiresAt: { $exists: true } }
  }
);

module.exports = mongoose.model('Document', documentSchema);

