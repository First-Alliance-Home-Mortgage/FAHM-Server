const menuConfigService = require('../services/menuConfigService');

exports.getMenuConfig = async (req, res, next) => {
  try {
    const MenuConfig = require('../models/MenuConfig');
    const config = await MenuConfig.findOne({ key: 'menuConfig' }).lean();
    if (!config) {
      return res.status(404).json({ message: 'Menu configuration not found' });
    }
    res.json(config.value);
  } catch (error) {
    req.log.error('Error fetching menu configuration', { error });
    next(error);
  }
};

exports.putMenus = async (req, res, next) => {
  try {
    const menus = req.body;
    await menuConfigService.upsertMenuConfig(menus);
    res.json({ success: true, message: 'Menu configuration updated successfully' });
  } catch (error) {
    req.log.error('Error updating menus', { error, body: req.body });
    next(error);
  }
};