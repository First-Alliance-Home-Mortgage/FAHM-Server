// scripts/removeAllRole.js
// Ensures all menus have the full set of role ObjectIds assigned.
// Usage:
//   node scripts/removeAllRole.js           — run against the database
//   node scripts/removeAllRole.js --dry-run — preview changes without writing

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const Menu = require('../src/models/Menu');
const Role = require('../src/models/Role');

const dryRun = process.argv.includes('--dry-run');

async function removeAllRole() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Fetch all roles from the database
    const allRoles = await Role.find().select('_id slug').lean();
    const allRoleIds = allRoles.map(r => r._id);
    const slugById = {};
    for (const role of allRoles) {
      slugById[role._id.toString()] = role.slug;
    }

    console.log(`Found ${allRoles.length} roles in database: ${allRoles.map(r => r.slug).join(', ')}`);

    const menus = await Menu.find().populate('roles');

    let updated = 0;
    for (const menu of menus) {
      const currentRoleIds = menu.roles.map(r => (r._id || r).toString());
      const allRoleIdStrings = allRoleIds.map(id => id.toString());
      const hasAll = allRoleIdStrings.every(id => currentRoleIds.includes(id));

      if (!hasAll) {
        const currentSlugs = menu.roles.map(r => r.slug || slugById[(r._id || r).toString()] || r.toString());
        const allSlugs = allRoles.map(r => r.slug);

        if (dryRun) {
          console.log(`[DRY RUN] ${menu.alias}: [${currentSlugs.join(', ')}] → [${allSlugs.join(', ')}]`);
        } else {
          menu.roles = allRoleIds;
          await menu.save();
          console.log(`Updated "${menu.alias}": roles → [${allSlugs.join(', ')}]`);
        }
        updated++;
      }
    }

    if (updated === 0) {
      console.log('All menus already have all roles assigned. Nothing to update.');
    } else {
      console.log(dryRun ? `\nDry run complete. ${updated} menu(s) would be updated.` : `\n${updated} menu(s) updated successfully.`);
    }
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

removeAllRole();
