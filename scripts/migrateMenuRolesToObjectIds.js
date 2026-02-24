// scripts/migrateMenuRolesToObjectIds.js
// One-time migration: converts Menu.roles from string slugs to Role ObjectId references.
// Usage:
//   node scripts/migrateMenuRolesToObjectIds.js           — run migration
//   node scripts/migrateMenuRolesToObjectIds.js --dry-run — preview without writing

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const Role = require('../src/models/Role');

const dryRun = process.argv.includes('--dry-run');

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Build slug → ObjectId map
    const roles = await Role.find().select('_id slug').lean();
    const slugToId = {};
    for (const role of roles) {
      slugToId[role.slug] = role._id;
    }
    console.log(`Found ${roles.length} roles: ${roles.map(r => r.slug).join(', ')}`);

    // Access the raw collection to read documents without schema casting
    const db = mongoose.connection.db;
    const menuCollection = db.collection('menus');
    const menus = await menuCollection.find({}).toArray();
    console.log(`Found ${menus.length} menu(s) to check`);

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const menu of menus) {
      const currentRoles = menu.roles || [];

      // Check if already migrated (roles are ObjectIds)
      if (currentRoles.length > 0 && currentRoles[0] instanceof mongoose.Types.ObjectId) {
        skipped++;
        continue;
      }

      // Check if roles are strings (need migration)
      if (currentRoles.length > 0 && typeof currentRoles[0] === 'string') {
        const roleIds = [];
        const unknownSlugs = [];

        for (const slug of currentRoles) {
          if (slugToId[slug]) {
            roleIds.push(slugToId[slug]);
          } else {
            unknownSlugs.push(slug);
          }
        }

        if (unknownSlugs.length > 0) {
          console.warn(`  WARNING: "${menu.alias}" has unknown role slugs: ${unknownSlugs.join(', ')} — skipping these`);
        }

        if (dryRun) {
          console.log(`[DRY RUN] "${menu.alias}": [${currentRoles.join(', ')}] → [${roleIds.length} ObjectIds]`);
        } else {
          await menuCollection.updateOne(
            { _id: menu._id },
            { $set: { roles: roleIds } }
          );
          console.log(`Migrated "${menu.alias}": ${currentRoles.length} slug(s) → ${roleIds.length} ObjectId(s)`);
        }
        migrated++;
      } else {
        skipped++;
      }
    }

    console.log(`\n--- Summary ---`);
    console.log(`Total menus: ${menus.length}`);
    console.log(`Migrated:    ${migrated}`);
    console.log(`Skipped:     ${skipped} (already ObjectIds or empty)`);
    console.log(`Errors:      ${errors}`);
    if (dryRun) console.log('\nDry run complete. No changes written.');

    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
