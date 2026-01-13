// scripts/seedCapabilities.js
// Seed script for inserting all capabilities into the database

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const Capability = require('../src/models/Capability');

const ALL_CAPABILITIES = [
  { name: 'loan:read:self', slug: 'loan-read-self', description: 'Read own loan information', category: 'loan' },
  { name: 'loan:update:self', slug: 'loan-update-self', description: 'Update own loan information', category: 'loan' },
  { name: 'loan:read', slug: 'loan-read', description: 'Read all loan information', category: 'loan' },
  { name: 'loan:update', slug: 'loan-update', description: 'Update loan information', category: 'loan' },
  { name: 'loan:create', slug: 'loan-create', description: 'Create new loans', category: 'loan' },
  { name: 'loan:read:shared', slug: 'loan-read-shared', description: 'Read shared loan information', category: 'loan' },
  
  { name: 'document:upload', slug: 'document-upload', description: 'Upload documents', category: 'document' },
  { name: 'document:download', slug: 'document-download', description: 'Download documents', category: 'document' },
  
  { name: 'rates:view', slug: 'rates-view', description: 'View mortgage rates', category: 'rates' },
  { name: 'rates:lock', slug: 'rates-lock', description: 'Lock mortgage rates', category: 'rates' },
  
  { name: 'alerts:manage', slug: 'alerts-manage', description: 'Manage rate alerts', category: 'alerts' },
  
  { name: 'messages:send', slug: 'messages-send', description: 'Send messages', category: 'messages' },
  
  { name: 'dashboard:view', slug: 'dashboard-view', description: 'View dashboard', category: 'dashboard' },
  
  { name: 'webhooks:ingest', slug: 'webhooks-ingest', description: 'Receive webhook data', category: 'webhooks' },
  
  { name: 'users:manage', slug: 'users-manage', description: 'Manage all users', category: 'users' },
  { name: 'users:manage:branch', slug: 'users-manage-branch', description: 'Manage branch users', category: 'users' },
  
  { name: 'audit:read', slug: 'audit-read', description: 'Read audit logs', category: 'audit' },
];

async function seedCapabilities() {
  try {
    await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    
    console.log('Cleaning up existing capabilities...');
    const deleteResult = await Capability.deleteMany({});
    console.log(`Deleted ${deleteResult.deletedCount} existing capabilities`);
    
    console.log('Seeding capabilities...');
    
    for (const capData of ALL_CAPABILITIES) {
      await Capability.create(capData);
      console.log(`Capability "${capData.name}" created`);
    }
    
    console.log(`Successfully seeded ${ALL_CAPABILITIES.length} capabilities`);
    process.exit(0);
  } catch (err) {
    console.error('Error seeding capabilities:', err);
    process.exit(1);
  }
}

seedCapabilities();
