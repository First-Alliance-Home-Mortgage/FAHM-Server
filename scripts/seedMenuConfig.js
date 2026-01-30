// scripts/seedMenuConfig.js
// Usage: node scripts/seedMenuConfig.js

const mongoose = require('mongoose');
const MenuConfig = require('../src/models/MenuConfig');
require('dotenv').config();

const defaultMenuConfig = {
  key: 'menuConfig',
  value: {
    mainMenu: [
      { label: 'Home', path: '/', icon: 'home' },
      { label: 'Loans', path: '/loans', icon: 'dollar-sign' },
      { label: 'Documents', path: '/documents', icon: 'file' },
      { label: 'Notifications', path: '/notifications', icon: 'bell' },
    ],
    sidebarMenu: [
      { label: 'Settings', path: '/settings', icon: 'settings' },
      { label: 'Help', path: '/help', icon: 'help-circle' },
    ]
  }
};

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    await MenuConfig.findOneAndUpdate(
      { key: defaultMenuConfig.key },
      { value: defaultMenuConfig.value },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log('MenuConfig seeded successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Failed to seed MenuConfig:', err);
    process.exit(1);
  }
}

seed();
