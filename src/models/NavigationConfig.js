const mongoose = require('mongoose');

const itemsSchema = new mongoose.Schema({
  screen_slug: { type: String, required: true },
  order: { type: Number, default: 0 },
}, { _id: false });

const navigationConfigSchema = new mongoose.Schema({
  type: { type: String, enum: ['drawer', 'tab', 'stack', 'modal'], required: true },
  role: { type: String, required: true },
  items: { type: [itemsSchema], default: [] },
}, { timestamps: true });

navigationConfigSchema.index({ type: 1, role: 1 }, { unique: true });

module.exports = mongoose.model('NavigationConfig', navigationConfigSchema);
