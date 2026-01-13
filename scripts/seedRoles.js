// scripts/seedRoles.js
// Seed script for inserting all roles into the database

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const Role = require('../src/models/Role');
const Capability = require('../src/models/Capability');

const ROLES_WITH_CAPABILITIES = [
  {
    name: 'borrower',
    slug: 'borrower',
    capabilities: [
      'loan:read:self',
      'loan:update:self',
      'document:upload',
      'document:download',
      'rates:view',
      'alerts:manage',
      'messages:send',
    ],
  },
  {
    name: 'loan_officer_retail',
    slug: 'loan-officer-retail',
    capabilities: [
      'loan:read',
      'loan:update',
      'loan:create',
      'document:upload',
      'document:download',
      'rates:view',
      'rates:lock',
      'alerts:manage',
      'dashboard:view',
      'webhooks:ingest',
    ],
  },
  {
    name: 'loan_officer_tpo',
    slug: 'loan-officer-tpo',
    capabilities: [
      'loan:read',
      'loan:update',
      'loan:create',
      'document:upload',
      'document:download',
      'rates:view',
      'rates:lock',
      'alerts:manage',
      'dashboard:view',
      'webhooks:ingest',
    ],
  },
  {
    name: 'broker',
    slug: 'broker',
    capabilities: [
      'loan:read',
      'loan:create',
      'document:upload',
      'document:download',
      'rates:view',
      'alerts:manage',
    ],
  },
  {
    name: 'branch_manager',
    slug: 'branch-manager',
    capabilities: [
      'loan:read',
      'loan:update',
      'loan:create',
      'document:download',
      'rates:view',
      'rates:lock',
      'alerts:manage',
      'dashboard:view',
      'users:manage:branch',
    ],
  },
  {
    name: 'realtor',
    slug: 'realtor',
    capabilities: [
      'loan:read:shared',
      'messages:send',
      'rates:view',
    ],
  },
  {
    name: 'admin',
    slug: 'admin',
    capabilities: [
      'loan:read',
      'loan:update',
      'loan:create',
      'document:upload',
      'document:download',
      'rates:view',
      'rates:lock',
      'alerts:manage',
      'webhooks:ingest',
      'users:manage',
      'dashboard:view',
      'audit:read',
    ],
  },
];

async function seedRoles() {
  try {
    await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    
    console.log('Cleaning up existing roles...');
    const deleteResult = await Role.deleteMany({});
    console.log(`Deleted ${deleteResult.deletedCount} existing roles`);
    
    console.log('Seeding roles with capabilities...');
    
    for (const roleData of ROLES_WITH_CAPABILITIES) {
      // Find capability ObjectIds by name
      const capabilityDocs = await Capability.find({ 
        name: { $in: roleData.capabilities } 
      }).select('_id');
      
      const capabilityIds = capabilityDocs.map(cap => cap._id);
      
      // Create new role
      await Role.create({
        name: roleData.name,
        slug: roleData.slug,
        capabilities: capabilityIds
      });
      console.log(`Role "${roleData.name}" created with ${capabilityIds.length} capabilities`);
    }
    
    console.log('Roles seeded successfully');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding roles:', err);
    process.exit(1);
  }
}

seedRoles();
