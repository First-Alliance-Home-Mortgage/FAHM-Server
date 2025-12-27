const mongoose = require('mongoose');
const crypto = require('crypto');

const metadataSchema = new mongoose.Schema(
  {
    ip: String,
    userAgent: String,
  },
  { _id: false }
);

const refreshTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
    revokedAt: { type: Date },
    revokedReason: { type: String },
    replacedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'RefreshToken' },
    metadata: metadataSchema,
  },
  { timestamps: true }
);

refreshTokenSchema.index({ user: 1, revokedAt: 1 });

refreshTokenSchema.methods.isExpired = function isExpired() {
  return Boolean(this.expiresAt && this.expiresAt.getTime() <= Date.now());
};

refreshTokenSchema.methods.isActive = function isActive() {
  return !this.revokedAt && !this.isExpired();
};

refreshTokenSchema.statics.hashToken = function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
};

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
