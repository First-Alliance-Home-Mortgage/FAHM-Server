
const createError = require('http-errors');
const { body, validationResult } = require('express-validator');
const menuService = require('../services/menuService');
const { audit } = require('../utils/audit');
// POST /menus/reset - restore menu config to system default
const path = require('path');
exports.resetMenus = async (req, res, next) => {
  try {
    // Load the default menu config from the seedMenus.js file (exports { menus })
    const seedMenusPath = path.resolve(__dirname, '../../scripts/seedMenus.js');
    const { menus } = require(seedMenusPath);
    const updatedMenus = await menuService.upsertMenus(menus);
    // Versioning: save a MenuVersion document
    const MenuVersion = require('../models/menuVersion');
    const lastVersion = await MenuVersion.findOne().sort({ version: -1 });
    const newVersion = new MenuVersion({
      version: lastVersion ? lastVersion.version + 1 : 1,
      menus: updatedMenus,
      createdBy: req.user?._id,
      comment: 'System reset',
    });
    await newVersion.save();
    await audit({ action: 'menus.reset', entityType: 'Menu', status: 'success' }, req);
    req.log.info('Menus reset to default');
    res.json(updatedMenus);
  } catch (error) {
    req.log.error('Error resetting menus', { error });
    next(error);
  }
};
// GET /menus/roles - return all available roles
const { roles: rolesMap } = require('../config/roles');
exports.getMenuRoles = (req, res) => {
  // Return all role values as an array
  res.json(Object.values(rolesMap));
};
// Validation array for PUT /menus (MenuConfig: key-value)
exports.validateMenus = [
  body('key').notEmpty().withMessage('key is required'),
  body('value').not().isEmpty().withMessage('value is required'),
];

exports.getMenus = async (req, res, next) => {
  try {
    const menus = await menuService.getAllMenus();
    res.json(menus);
  } catch (error) {
    req.log.error('Error fetching menus', { error });
    next(error);
  }
};

// GET /menus/grouped - get menus grouped by role and route type
exports.getGroupedMenus = async (req, res, next) => {
  try {
    const menus = await menuService.getAllMenus();
    const grouped = { drawer: [], tab: [], stack: [] };
    for (const menu of menus) {
      if (grouped[menu.type]) grouped[menu.type].push(menu);
    }
    // Sort each group by order
    for (const type of Object.keys(grouped)) {
      grouped[type].sort((a, b) => a.order - b.order);
    }
    res.json(grouped);
  } catch (error) {
    req.log?.error?.('Error grouping menus', { error });
    res.status(500).json({ message: 'Failed to group menus' });
  }
};

// GET /menus/versions - get menu version history
exports.getMenuVersions = async (req, res, next) => {
  try {
    const MenuVersion = require('../models/menuVersion');
    const versions = await MenuVersion.find().sort({ version: -1 });
    res.json(versions);
  } catch (error) {
    req.log.error('Error fetching menu versions', { error });
    next(error);
  }
};

// POST /menus/restore/:version - restore a previous menu version
exports.restoreMenuVersion = async (req, res, next) => {
  try {
    const MenuVersion = require('../models/menuVersion');
    const versionNum = parseInt(req.params.version, 10);
    if (isNaN(versionNum)) {
      return next(createError(400, 'Invalid version number'));
    }
    const versionDoc = await MenuVersion.findOne({ version: versionNum });
    if (!versionDoc) {
      return next(createError(404, 'Menu version not found'));
    }
    // Restore menus from this version
    const updatedMenus = await menuService.upsertMenus(versionDoc.menus);
    // Save a new version for the restore action
    const lastVersion = await MenuVersion.findOne().sort({ version: -1 });
    const newVersion = new MenuVersion({
      version: lastVersion ? lastVersion.version + 1 : 1,
      menus: updatedMenus,
      createdBy: req.user?._id,
      comment: `Restored from version ${versionNum}`,
    });
    await newVersion.save();
    await audit({ action: 'menus.restore', entityType: 'Menu', status: 'success', metadata: { restoredFrom: versionNum } }, req);
    req.log.info('Menus restored from version', { restoredFrom: versionNum });
    res.json(updatedMenus);
  } catch (error) {
    req.log.error('Error restoring menu version', { error });
    next(error);
  }
};

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
      req.log.error('Validation errors in PUT /menus', { errors: errors.array(), body: req.body });
      return next(createError(400, { errors: errors.array() }));
    }
    const menus = req.body;
    console.log('Menus to update:', menus);
    await menuService.upsertMenuConfig(menus);

    res.json({ success: true, message: 'Menu configuration updated successfully' });

  } catch (error) {
    req.log.error('Error updating menus', { error, body: req.body });
    next(error);
  }
};
