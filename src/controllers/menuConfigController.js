
const createError = require('http-errors');
const { body, validationResult } = require('express-validator');
const menuConfigService = require('../services/menuConfigService');


// Validation array for PUT /menus (expects array of menu objects)
exports.validateMenuConfigObject = [
  body().custom(value => {
    if (typeof value !== 'object' || Array.isArray(value) || value === null) {
      throw new Error('Request body must be an object');
    }
    for (const key of Object.keys(value)) {
      if (typeof key !== 'string') throw new Error('Menu key must be a string');
      // Optionally check value type here
    }
    return true;
  }),
];

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
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, 'Validation failed', { errors: errors.array() }));
    }

    const menus = req.body;
    await menuConfigService.upsertMenuConfig(menus);
    res.json({ success: true, message: 'Menu configuration updated successfully' });
  } catch (error) {
    req.log.error('Error updating menus', { error, body: req.body });
    next(error);
  }
};