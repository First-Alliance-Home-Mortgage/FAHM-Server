const MenuConfig = require('../models/MenuConfig');

async function upsertMenuConfig(menus) {
  const filter = { key: 'menuConfig' };
  const update = { value: menus };
  const options = { upsert: true, new: true, setDefaultsOnInsert: true };
  return MenuConfig.findOneAndUpdate(filter, update, options);
}

module.exports = {
  upsertMenuConfig
};
