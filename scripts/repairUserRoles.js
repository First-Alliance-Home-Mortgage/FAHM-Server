// scripts/repairUserRoles.js
// Repair script: finds users whose `role` ObjectId references a deleted Role
// document and re-links them to the correct role by matching the role name/slug.
//
// Run AFTER seedCapabilities.js and seedRoles.js:
//   node scripts/seedCapabilities.js
//   node scripts/seedRoles.js
//   node scripts/repairUserRoles.js

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const User = require('../src/models/User');
const Role = require('../src/models/Role');

async function repairUserRoles() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    // Build a map of current roles by _id
    const allRoles = await Role.find().lean();
    const roleById = new Map(allRoles.map(r => [r._id.toString(), r]));
    const roleBySlug = new Map(allRoles.map(r => [r.slug, r]));

    console.log(`Found ${allRoles.length} roles in database`);
    for (const r of allRoles) {
      console.log(`  - ${r.slug} (${r._id})`);
    }

    // Find all users and check their role reference
    const users = await User.find().select('name email role').lean();
    console.log(`\nChecking ${users.length} users for stale role references...\n`);

    let repaired = 0;
    let healthy = 0;
    let orphaned = 0;

    for (const user of users) {
      const roleId = user.role?.toString();

      if (roleId && roleById.has(roleId)) {
        // Role reference is valid
        healthy++;
        continue;
      }

      // Role reference is stale/broken — try to find the correct role
      // We need to figure out what role this user was supposed to have.
      // Check if the raw role value is a string slug (shouldn't be, but handle it)
      let matchedRole = null;

      if (typeof user.role === 'string' && roleBySlug.has(user.role)) {
        matchedRole = roleBySlug.get(user.role);
      }

      if (!matchedRole) {
        // Cannot auto-repair — log for manual review
        console.warn(`  ORPHANED: User "${user.name}" (${user.email}) has stale role ref ${roleId} — cannot auto-match`);
        orphaned++;
        continue;
      }

      await User.updateOne({ _id: user._id }, { $set: { role: matchedRole._id } });
      console.log(`  REPAIRED: User "${user.name}" (${user.email}) -> ${matchedRole.slug}`);
      repaired++;
    }

    console.log(`\nResults: ${healthy} healthy, ${repaired} repaired, ${orphaned} orphaned (need manual fix)`);

    if (orphaned > 0) {
      console.log('\nTo fix orphaned users manually, assign them a role:');
      console.log('  db.users.updateOne({ email: "user@example.com" }, { $set: { role: <roleObjectId> } })');
    }

    process.exit(0);
  } catch (err) {
    console.error('Error repairing user roles:', err);
    process.exit(1);
  }
}

repairUserRoles();
