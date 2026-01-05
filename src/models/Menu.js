const mongoose = require('mongoose');

const menuSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  label: { type: String, required: true },
  icon: { type: String, required: true },
  route: { type: String, required: true },
  type: { type: String, enum: ['drawer', 'tab', 'stack'], required: true },
  parent: { type: String, default: null },
  order: { type: Number, required: true },
  visible: { type: Boolean, required: true },
  roles: { type: [String], required: true },
}, { timestamps: true });

module.exports = mongoose.model('Menu', menuSchema);