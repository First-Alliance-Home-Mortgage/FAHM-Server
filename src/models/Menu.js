const mongoose = require('mongoose');

const menuSchema = new mongoose.Schema({
  alias: { type: String, required: true, unique: true },
  label: { type: String, required: true },
  icon: { type: String, required: true },
  route: { type: String, required: true },
  type: { type: String, enum: ['drawer', 'tab', 'stack'], required: true },
  slug: { type: String, required: true },
  content: { type: mongoose.Schema.Types.Mixed, default: null },
  order: { type: Number, required: true },
  visible: { type: Boolean, required: true },
  roles: { type: [String], required: true },
  analytics: {
    views: { type: Number },
    uniqueUsers: { type: Number },
    lastAccessed: { type: String },
  },
}, { timestamps: true });

module.exports = mongoose.model('Menu', menuSchema);