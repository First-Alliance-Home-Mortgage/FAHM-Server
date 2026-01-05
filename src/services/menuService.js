const Menu = require('../models/menu');

async function getAllMenus() {
  return Menu.find().sort({ order: 1 }).lean();
}

async function upsertMenus(menus) {
  // Remove all existing menus, then insert new ones (replace all)
  await Menu.deleteMany({});
  return Menu.insertMany(menus);
}

module.exports = {
  getAllMenus,
  upsertMenus,
};
