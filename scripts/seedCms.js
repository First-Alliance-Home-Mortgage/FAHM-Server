// scripts/seedCms.js
const mongoose = require('mongoose');
require('dotenv').config();

const Screen = require('../src/models/Screen');
const NavigationConfig = require('../src/models/NavigationConfig');
const FeatureFlag = require('../src/models/FeatureFlag');
const ComponentRegistryItem = require('../src/models/ComponentRegistryItem');

const screens = [
  {
    slug: 'dashboard',
    title: 'Dashboard',
    route: '/dashboard',
    navigation: { type: 'tab', icon: 'home', order: 1 },
    roles: ['admin', 'borrower'],
    tenant_scope: ['global'],
    components: [
      { type: 'text', props: { value: 'Welcome!' } },
    ],
    status: 'draft',
    version: 1,
  },
];

const navigationConfigs = [
  {
    type: 'drawer',
    role: 'admin',
    items: [ { screen_slug: 'dashboard', order: 1 } ],
  },
];

const featureFlags = [
  { key: 'new_ui', enabled: true, roles: ['admin'], min_app_version: '1.0.0' },
];

const componentRegistry = [
  {
    type: 'button',
    allowed_props: { label: { type: 'string', required: true } },
    allowed_actions: ['navigate', 'api_call'],
    supports_actions: true,
    status: 'active',
  },
];

async function seedCms() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('[seedCms] Missing MONGO_URI in environment.');
      process.exit(1);
    }
    await mongoose.connect(mongoUri);

    await Promise.all([
      Screen.deleteMany({}),
      NavigationConfig.deleteMany({}),
      FeatureFlag.deleteMany({}),
      ComponentRegistryItem.deleteMany({}),
    ]);

    await Screen.insertMany(screens);
    await NavigationConfig.insertMany(navigationConfigs);
    await FeatureFlag.insertMany(featureFlags);
    await ComponentRegistryItem.insertMany(componentRegistry);

    console.log('CMS seeded successfully!');
    process.exit(0);
  } catch (err) {
    console.error('CMS seeding failed:', err);
    process.exit(1);
  }
}

module.exports = { seedCms, screens, navigationConfigs, featureFlags, componentRegistry };

if (require.main === module) {
  seedCms();
}
