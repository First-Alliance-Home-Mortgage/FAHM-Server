const Screen = require('../models/Screen');
const NavigationConfig = require('../models/NavigationConfig');
const FeatureFlag = require('../models/FeatureFlag');
const ComponentRegistryItem = require('../models/ComponentRegistryItem');

// Screens
async function listScreens() {
  return Screen.find().lean();
}
async function getScreenBySlug(slug) {
  return Screen.findOne({ slug }).lean();
}
async function createScreen(data) {
  const screen = await Screen.create(data);
  return screen.toObject();
}
async function updateScreen(slug, patch) {
  const screen = await Screen.findOneAndUpdate({ slug }, patch, { new: true });
  return screen ? screen.toObject() : null;
}
async function publishScreen(slug) {
  const screen = await Screen.findOne({ slug });
  if (!screen) return null;
  screen.status = 'published';
  screen.version = (screen.version || 1) + 1;
  await screen.save();
  return screen.toObject();
}

// Navigation Configs
async function listNavigationConfigs() {
  return NavigationConfig.find().lean();
}
async function upsertNavigationConfigs(configs) {
  const results = [];
  for (const cfg of configs) {
    const updated = await NavigationConfig.findOneAndUpdate(
      { type: cfg.type, role: cfg.role },
      { $set: { items: cfg.items } },
      { upsert: true, new: true }
    );
    results.push(updated.toObject());
  }
  return results;
}

// Feature Flags
async function listFeatureFlags() {
  return FeatureFlag.find().lean();
}
async function upsertFeatureFlags(flags) {
  const results = [];
  for (const flag of flags) {
    const updated = await FeatureFlag.findOneAndUpdate(
      { key: flag.key },
      { $set: { enabled: !!flag.enabled, roles: flag.roles || [], min_app_version: flag.min_app_version } },
      { upsert: true, new: true }
    );
    results.push(updated.toObject());
  }
  return results;
}
async function toggleFeatureFlag(key, enabled) {
  const flag = await FeatureFlag.findOne({ key });
  if (!flag) return null;
  flag.enabled = typeof enabled === 'boolean' ? enabled : !flag.enabled;
  await flag.save();
  return flag.toObject();
}

// Component Registry
async function listComponentRegistry() {
  return ComponentRegistryItem.find().lean();
}

module.exports = {
  listScreens,
  getScreenBySlug,
  createScreen,
  updateScreen,
  publishScreen,
  listNavigationConfigs,
  upsertNavigationConfigs,
  listFeatureFlags,
  upsertFeatureFlags,
  toggleFeatureFlag,
  listComponentRegistry,
};
