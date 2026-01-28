
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
// Validation array for PUT /menus (expects array of menu objects)
exports.validateMenu = [
  body('alias').isString().withMessage('Menu alias must be a string'),
  body('label').isString().withMessage('Menu label must be a string'),
  body('icon').isString().withMessage('Menu icon must be a string'),
  body('route').isString().withMessage('Menu route must be a string'),
  body('type').isIn(['drawer', 'tab', 'stack']).withMessage('Menu type must be one of drawer, tab, or stack'),
  body('slug').isString().withMessage('Menu slug must be a string'),
  body('order').isInt({ min: 0 }).withMessage('Menu order must be a non-negative integer'),
  body('visible').isBoolean().withMessage('Menu visible must be a boolean'),
  body('roles').isArray().withMessage('Menu roles must be an array of role strings'),
];
// GET /menus - get all menus

exports.getMenus = async (req, res, next) => {
  try {
    const menus = await menuService.getAllMenus();
    res.json(menus);
  } catch (error) {
    req.log.error('Error fetching menus', { error });
    next(error);
  }
};

exports.createMenu = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    console.log(errors);
    console.log(req.body);

    if (!errors.isEmpty()) {
      return next(createError(400, 'Validation failed', { errors: errors.array() }));
    }
    const menuData = req.body;
    const newMenu = await menuService.createMenu(menuData);
    req.log.info('Menu created', { menuId: newMenu._id });
    res.status(201).json(newMenu);
  } catch (error) {
    req.log.error('Error creating menu', { error, body: req.body });
    next(error);
  }
};

exports.updateMenu = async (req, res, next) => {
  try {
    const errors = validationResult(req);
        console.log(errors);
    console.log(req.body);
    if (!errors.isEmpty()) {
      return next(createError(400, 'Validation failed', { errors: errors.array() }));
    }
    const menuId = req.params.id;
    const menuData = req.body;
    const updatedMenu = await menuService.updateMenu(menuId, menuData);
    if (!updatedMenu) {
      return next(createError(404, 'Menu not found'));
    }
    req.log.info('Menu updated', { menuId: updatedMenu._id });
    res.json(updatedMenu);
  } catch (error) {
    req.log.error('Error updating menu', { error, body: req.body });
    next(error);
  }
};

exports.getMenuById = async (req, res, next) => {
  try {
    const menu = await menuService.getMenuById(req.params.id);
    res.json(menu);
  } catch (error) {
    req.log.error('Error fetching menu by ID', { error });
    next(error);
  }
};

// GET /menus/grouped - get menus grouped by role and route type
exports.getGroupedMenus = async (req, res, _next) => {
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

