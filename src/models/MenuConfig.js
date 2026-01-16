const mongoose = require('mongoose');


// MenuConfig schema for storing arbitrary menu configuration as key-value pairs
const menuConfigSchema = new mongoose.Schema({
  // Unique key for the menu configuration entry (e.g., 'mainMenu', 'sidebarMenu')
  key: { type: String, required: true, unique: true },
  // Value can be any type (object, array, string, etc.) representing the menu config data
  value: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true });

module.exports = mongoose.model('MenuConfig', menuConfigSchema);