// scripts/removeAllRole.js
// Replaces "all" in the roles array with the full list of actual role names.
// Usage:
//   node scripts/removeAllRole.js           — run against the database
//   node scripts/removeAllRole.js --dry-run — preview changes without writing

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const Menu = require('../src/models/Menu');

const ALL_ROLES = [
  'admin',
  'branch_manager',
  'loan_officer_retail',
  'loan_officer_tpo',
  'broker',
  'realtor',
  'borrower',
];

const dryRun = process.argv.includes('--dry-run');

async function removeAllRole() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const menus = await Menu.find({ roles: { $in: ['all'] } });
    console.log(`Found ${menus.length} menu(s) with "all" in roles`);

    if (menus.length === 0) {
      console.log('Nothing to update.');
      process.exit(0);
    }

    for (const menu of menus) {
      // Remove "all" and merge in ALL_ROLES, preserving any other existing roles
      const existingRoles = menu.roles.filter(r => r !== 'all');
      const newRoles = [...new Set([...ALL_ROLES, ...existingRoles])];

      if (dryRun) {
        console.log(`[DRY RUN] ${menu.alias}: ${JSON.stringify(menu.roles)} → ${JSON.stringify(newRoles)}`);
      } else {
        menu.roles = newRoles;
        await menu.save();
        console.log(`Updated "${menu.alias}": roles → ${JSON.stringify(newRoles)}`);
      }
    }

    console.log(dryRun ? '\nDry run complete. No changes written.' : '\nAll menus updated successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

removeAllRole();
