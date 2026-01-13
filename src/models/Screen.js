const mongoose = require('mongoose');

const navigationSchema = new mongoose.Schema({
  type: { type: String, enum: ['drawer', 'tab', 'stack', 'modal'], required: true },
  icon: { type: String },
  order: { type: Number, default: 0 },
}, { _id: false });

const componentSchema = new mongoose.Schema({
  type: { type: String, required: true },
  props: { type: mongoose.Schema.Types.Mixed },
}, { _id: false });

const screenSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  route: { type: String, required: true },
  navigation: { type: navigationSchema, required: true },
  roles: { type: [String], default: [] },
  tenant_scope: { type: [String], default: [] },
  components: { type: [componentSchema], default: [] },
  status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  version: { type: Number, default: 1 },
}, { timestamps: true });

module.exports = mongoose.model('Screen', screenSchema);
