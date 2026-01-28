const Menu = require('../models/Menu');
const MenuConfig = require('../models/MenuConfig');

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

async function upsertMenuConfig(menus) {
  const filter = { key: 'menuConfig' };
  const update = { value: menus };
  const options = { upsert: true, new: true, setDefaultsOnInsert: true };
  return MenuConfig.findOneAndUpdate(filter, update, options);
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


// Update a menu by ID
async function updateMenu(menuId, menuData) {
  return Menu.findByIdAndUpdate(menuId, menuData, { new: true, runValidators: true });
}

module.exports = {
  getAllMenus,
  upsertMenus,
  getMenuById,
  updateMenu
};
