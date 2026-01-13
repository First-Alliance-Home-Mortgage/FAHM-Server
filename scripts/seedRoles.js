// scripts/seedRoles.js
// Seed script for inserting all roles into the database

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const Role = require('../src/models/Role'); // You must have a Role model

const ALL_ROLES = [
  'admin',
  'borrower',
  'loan_officer_tpo',
  'loan_officer_retail',
  'broker',
  'branch_manager',
  'realtor',
];

async function seedRoles() {
  try {
    await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    for (const role of ALL_ROLES) {
      await Role.updateOne(
        { name: role },
        { $setOnInsert: { name: role } },
        { upsert: true }
      );
    }
    console.log('Roles seeded successfully');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding roles:', err);
    process.exit(1);
  }
}

seedRoles();
