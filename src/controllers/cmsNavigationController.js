const createError = require('http-errors');
const { body, validationResult } = require('express-validator');
const cmsService = require('../services/cmsService');
const { audit } = require('../utils/audit');

exports.validateUpsert = [
  body().isArray(),
  body('*.type').isIn(['drawer', 'tab', 'stack', 'modal']),
  body('*.role').isString().notEmpty(),
  body('*.items').isArray(),
  body('*.items.*.screen_slug').isString().notEmpty(),
  body('*.items.*.order').optional().isInt(),
];

exports.list = async (req, res, next) => {
  try {
    const configs = await cmsService.listNavigationConfigs();
    res.json(configs);
  } catch (err) {
    req.log.error('cms/navigation-configs list failed', { err });
    next(err);
  }
};

exports.upsert = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(createError(400, { errors: errors.array() }));
    const results = await cmsService.upsertNavigationConfigs(req.body);
    await audit({ action: 'cms.navigation.upsert', entityType: 'NavigationConfig', status: 'success' }, req);
    res.json(results);
  } catch (err) {
    req.log.error('cms/navigation-configs upsert failed', { err });
    next(err);
  }
};
