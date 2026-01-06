const createError = require('http-errors');
const { body, validationResult } = require('express-validator');
const menuService = require('../services/menuService');
const { audit } = require('../utils/audit');

// Validation array for PUT /menus
exports.validateMenus = [
  body().isArray().withMessage('Body must be an array'),
  body('*.id').notEmpty().withMessage('id is required'),
  body('*.label').notEmpty().withMessage('label is required'),
  body('*.icon').notEmpty().withMessage('icon is required'),
  body('*.route').notEmpty().withMessage('route is required'),
  body('*.type').isIn(['drawer', 'tab', 'stack']).withMessage('type must be drawer, tab, or stack'),
  body('*.order').isInt().withMessage('order must be an integer'),
  body('*.visible').isBoolean().withMessage('visible must be boolean'),
  body('*.roles').isArray().withMessage('roles must be an array'),
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

exports.putMenus = async (req, res, next) => {
  try {
    console.log('PUT /menus called with body:', req.body);
    req.log.info('PUT /menus body (pre-validation)', { body: req.body });
    const errors = validationResult(req);
    req.log.info('PUT /menus body (post-validation)', { body: req.body, errors: errors.array() });
    console.log('Validation errors:', errors.array());
    if (!errors.isEmpty()) {
      return next(createError(400, { errors: errors.array() }));
    }
    const menus = req.body;
    console.log('Received menus for update:', menus);
    // Check for unique ids
    const ids = menus.map(m => m.id);
    if (new Set(ids).size !== ids.length) {
      return next(createError(400, 'Menu ids must be unique'));
    }
    // TODO: Optionally validate roles against allowed roles
    const updatedMenus = await menuService.upsertMenus(menus);
    await audit({ action: 'menus.update', entityType: 'Menu', status: 'success' }, req);
    req.log.info('Menus updated');
    res.json(updatedMenus);
  } catch (error) {
    req.log.error('Error updating menus', { error });
    next(error);
  }
};
