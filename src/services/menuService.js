const Menu = require('../models/Menu');

// Return all menus, ordered by type then order
async function getAllMenus() {
  return Menu.find().sort({
    type: 1,
    order: 1
  }).lean();
}

async function getMenuById(menuId) {
  return Menu.findById(menuId).lean();
}

// Normalize order within each type, preserve analytics if present
async function upsertMenus(menus) {
  // Group by type and sort by order, then reassign order to be 0-based within each type
  const types = ['drawer', 'tab', 'stack'];
  let normalized = [];
  for (const type of types) {
    const items = menus.filter(m => m.type === type)
      .sort((a, b) => a.order - b.order)
      .map((m, idx) => ({ ...m, order: idx }));
    normalized = normalized.concat(items);
  }
  await Menu.deleteMany({});
  return Menu.insertMany(normalized);
}

async function getMenuByAlias(alias) {
  return Menu.findOne({ alias }).lean();
}

// Create a new menu
async function createMenu(menuData) {
  return Menu.create(menuData);
}

// Update a menu by ID
async function updateMenu(menuId, menuData) {
  return Menu.findByIdAndUpdate(menuId, menuData, { new: true, runValidators: true });
}

// Delete a menu by ID
async function deleteMenu(menuId) {
  return Menu.findByIdAndDelete(menuId);
}

module.exports = {
  getAllMenus,
  upsertMenus,
  getMenuById,
  getMenuByAlias,
  createMenu,
  updateMenu,
  deleteMenu
};
