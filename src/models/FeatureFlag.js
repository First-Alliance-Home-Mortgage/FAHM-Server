const mongoose = require('mongoose');

const featureFlagSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: false },
  roles: { type: [String], default: [] },
  min_app_version: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('FeatureFlag', featureFlagSchema);
