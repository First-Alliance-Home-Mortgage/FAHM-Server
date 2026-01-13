const mongoose = require('mongoose');
const connectMongo = require('../src/db/mongoose');
const User = require('../src/models/User');
const Role = require('../src/models/Role');
const logger = require('../src/utils/logger');

const DEFAULT_PASSWORD = 'Password123!';

function roleEmail(role) {

  return `${role.toLowerCase()
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^\w-]/g, '')}@fahmloans.com`;
}

async function seed() {
  await connectMongo();

  // Cleanup: delete all seed users
  logger.info('Cleaning up existing seed users...');
  const seedEmails = await User.deleteMany({});
  logger.info('Deleted seed users', { deletedCount: seedEmails.deletedCount });

  // Get all roles from database
  const roles = await Role.find().select('_id name');
  if (roles.length === 0) {
    logger.warn('No roles found in database. Please seed roles first.');
    return;
  }

  logger.info('Found roles in database', { count: roles.length });

  for (const role of roles) {
    const email = roleEmail(role.name);

    const user = await User.create({
      name: `${role.name} User`,
      email,
      password: DEFAULT_PASSWORD,
      role: role._id,
      phone: '555-000-0000',
      emailVerified: true,
      isActive: true,
    });

    logger.info('Created seed user', { role: role.name, email, id: user._id.toString() });
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
