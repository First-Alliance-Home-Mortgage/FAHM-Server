const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  capabilities: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Capability',
  }],
}, {
  timestamps: true,
});

module.exports = mongoose.model('Role', roleSchema);