const mongoose = require('mongoose');

const capabilitySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  description: {
    type: String,
    trim: true,
  },
  category: {
    type: String,
    enum: ['loan', 'document', 'rates', 'alerts', 'messages', 'dashboard', 'webhooks', 'users', 'audit', 'log', 'other'],
    default: 'other',
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Capability', capabilitySchema);
