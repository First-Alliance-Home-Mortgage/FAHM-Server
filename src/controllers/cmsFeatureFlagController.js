const createError = require('http-errors');
const { body, param, validationResult } = require('express-validator');
const cmsService = require('../services/cmsService');
const { audit } = require('../utils/audit');

exports.validateUpsert = [
  body().isArray(),
  body('*.key').isString().notEmpty(),
  body('*.enabled').optional().isBoolean(),
  body('*.roles').optional().isArray(),
  body('*.min_app_version').optional().isString(),
];

exports.list = async (req, res, next) => {
  try {
    const flags = await cmsService.listFeatureFlags();
    res.json(flags);
  } catch (err) {
    req.log.error('cms/feature-flags list failed', { err });
    next(err);
  }
};

exports.upsert = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(createError(400, { errors: errors.array() }));
    const results = await cmsService.upsertFeatureFlags(req.body);
    await audit({ action: 'cms.featureFlags.upsert', entityType: 'FeatureFlag', status: 'success' }, req);
    res.json(results);
  } catch (err) {
    req.log.error('cms/feature-flags upsert failed', { err });
    next(err);
  }
};

exports.validateToggle = [
  param('key').isString().notEmpty(),
  body('enabled').optional().isBoolean(),
];

exports.toggle = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(createError(400, { errors: errors.array() }));
    const updated = await cmsService.toggleFeatureFlag(req.params.key, req.body.enabled);
    if (!updated) return next(createError(404, 'Feature flag not found'));
    await audit({ action: 'cms.featureFlags.toggle', entityType: 'FeatureFlag', status: 'success', metadata: { key: req.params.key } }, req);
    res.json(updated);
  } catch (err) {
    req.log.error('cms/feature-flags toggle failed', { err });
    next(err);
  }
};
