const mongoose = require('mongoose');

const componentRegistryItemSchema = new mongoose.Schema({
  type: { type: String, required: true, unique: true },
  allowed_props: { type: mongoose.Schema.Types.Mixed, default: {} },
  allowed_actions: { type: [String], default: [] },
  supports_actions: { type: Boolean, default: false },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
}, { timestamps: true });

module.exports = mongoose.model('ComponentRegistryItem', componentRegistryItemSchema);
