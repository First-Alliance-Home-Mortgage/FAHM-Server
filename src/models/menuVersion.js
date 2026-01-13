const mongoose = require('mongoose');

const menuVersionSchema = new mongoose.Schema({
  version: { type: Number, required: true },
  menus: { type: Array, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  comment: { type: String },
});

module.exports = mongoose.model('MenuVersion', menuVersionSchema);