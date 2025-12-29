const mongoose = require('mongoose');
const connectMongo = require('../src/db/mongoose');
const User = require('../src/models/User');
const logger = require('../src/utils/logger');

// Roles to seed with one default user each
const availableRoles = [
  'borrower',
  'loan_officer_tpo',
  'loan_officer_retail',
  'broker',
  'branch_manager',
  'realtor',
  'admin',
];

const DEFAULT_PASSWORD = 'Password123!';

function roleEmail(role) {
  return `${role.replace(/_/g, '.')}@example.com`;
}

function roleName(role) {
  return role
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

async function seed() {
  await connectMongo();

  for (const role of availableRoles) {
    const email = roleEmail(role);
    const existing = await User.findOne({ email });
    if (existing) {
      logger.info('Seed user exists; skipping', { role, email });
      continue;
    }

    const user = await User.create({
      name: `${roleName(role)} User`,
      email,
      password: DEFAULT_PASSWORD,
      role,
      phone: '555-000-0000',
      emailVerified: true,
      isActive: true,
    });

    logger.info('Created seed user', { role, email, id: user._id.toString() });
  }
}

seed()
  .catch((err) => {
    logger.error('User seeding failed', { err: err.message });
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
