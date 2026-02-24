const Menu = require('../models/Menu');
const Role = require('../models/Role');

// Return all menus, ordered by type then order
async function getAllMenus() {
  return Menu.find().populate('roles').sort({
    type: 1,
    order: 1
  }).lean();
}

async function getMenuById(menuId) {
  return Menu.findById(menuId).populate('roles').lean();
}

// Normalize a single role entry to an ObjectId.
// Handles: ObjectId, populated object with _id, or string slug (legacy).
async function normalizeRoleEntry(entry, slugToIdMap) {
  const mongoose = require('mongoose');
  // Already an ObjectId instance
  if (entry instanceof mongoose.Types.ObjectId) return entry;
  // Populated object with _id
  if (entry && typeof entry === 'object' && entry._id) return entry._id;
  // Valid ObjectId string
  if (typeof entry === 'string' && mongoose.Types.ObjectId.isValid(entry) && String(new mongoose.Types.ObjectId(entry)) === entry) {
    return new mongoose.Types.ObjectId(entry);
  }
  // Legacy string slug — resolve via map
  if (typeof entry === 'string' && slugToIdMap[entry]) return slugToIdMap[entry];
  return null;
}

// Normalize order within each type, resolve roles to ObjectIds
async function upsertMenus(menus) {
  // Build slug→ObjectId map for legacy string role resolution
  const allRoles = await Role.find().select('_id slug').lean();
  const slugToIdMap = {};
  for (const role of allRoles) {
    slugToIdMap[role.slug] = role._id;
  }

  // Group by type and sort by order, then reassign order to be 0-based within each type
  const types = ['drawer', 'tab', 'stack'];
  let normalized = [];
  for (const type of types) {
    const items = menus.filter(m => m.type === type)
      .sort((a, b) => a.order - b.order)
      .map((m, idx) => ({ ...m, order: idx }));
    normalized = normalized.concat(items);
  }

  // Normalize roles on each menu to ObjectIds
  for (const menu of normalized) {
    if (Array.isArray(menu.roles)) {
      const resolvedRoles = [];
      for (const entry of menu.roles) {
        const id = await normalizeRoleEntry(entry, slugToIdMap);
        if (id) resolvedRoles.push(id);
      }
      menu.roles = resolvedRoles;
    }
  }

  await Menu.deleteMany({});
  const inserted = await Menu.insertMany(normalized);
  // Re-fetch with populated roles since insertMany doesn't support populate
  const ids = inserted.map(m => m._id);
  return Menu.find({ _id: { $in: ids } }).populate('roles').sort({ type: 1, order: 1 }).lean();
}

async function getMenuByAlias(alias) {
  return Menu.findOne({ alias }).populate('roles').lean();
}

// Create a new menu
async function createMenu(menuData) {
  const menu = await Menu.create(menuData);
  return menu.populate('roles');
}

// Update a menu by ID
async function updateMenu(menuId, menuData) {
  return Menu.findByIdAndUpdate(menuId, menuData, { new: true, runValidators: true }).populate('roles');
}

// Delete a menu by ID
async function deleteMenu(menuId) {
  return Menu.findByIdAndDelete(menuId);
}

// Resolve an array of role slugs to ObjectIds
async function resolveRoleSlugs(slugs) {
  const roles = await Role.find({ slug: { $in: slugs } }).select('_id slug').lean();
  const slugToId = {};
  for (const role of roles) {
    slugToId[role.slug] = role._id;
  }
  const ids = [];
  const missing = [];
  for (const slug of slugs) {
    if (slugToId[slug]) {
      ids.push(slugToId[slug]);
    } else {
      missing.push(slug);
    }
  }
  if (missing.length > 0) {
    throw new Error(`Unknown role slugs: ${missing.join(', ')}`);
  }
  return ids;
}

module.exports = {
  getAllMenus,
  upsertMenus,
  getMenuById,
  getMenuByAlias,
  createMenu,
  updateMenu,
  deleteMenu,
  resolveRoleSlugs
};
