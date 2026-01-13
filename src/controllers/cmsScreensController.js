const createError = require('http-errors');
const { body, param, validationResult } = require('express-validator');
const cmsService = require('../services/cmsService');
const { audit } = require('../utils/audit');

exports.validateCreate = [
  body('slug').isString().notEmpty(),
  body('title').isString().notEmpty(),
  body('route').isString().notEmpty(),
  body('navigation.type').isIn(['drawer', 'tab', 'stack', 'modal']),
  body('navigation.icon').optional().isString(),
  body('navigation.order').optional().isInt(),
  body('roles').optional().isArray(),
  body('tenant_scope').optional().isArray(),
  body('components').optional().isArray(),
  body('status').optional().isIn(['draft', 'published']),
  body('version').optional().isInt(),
];

exports.validatePatch = [
  param('slug').isString().notEmpty(),
];

exports.list = async (req, res, next) => {
  try {
    const screens = await cmsService.listScreens();
    res.json(screens);
  } catch (err) {
    req.log.error('cms/screens list failed', { err });
    next(err);
  }
};

exports.getOne = async (req, res, next) => {
  try {
    const screen = await cmsService.getScreenBySlug(req.params.slug);
    if (!screen) return next(createError(404, 'Screen not found'));
    res.json(screen);
  } catch (err) {
    req.log.error('cms/screens get failed', { err });
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(createError(400, { errors: errors.array() }));
    const screen = await cmsService.createScreen({
      slug: req.body.slug,
      title: req.body.title,
      route: req.body.route,
      navigation: req.body.navigation,
      roles: req.body.roles || [],
      tenant_scope: req.body.tenant_scope || [],
      components: req.body.components || [],
      status: req.body.status || 'draft',
      version: req.body.version || 1,
    });
    await audit({ action: 'cms.screen.create', entityType: 'Screen', entityId: screen._id, status: 'success' }, req);
    res.status(201).json(screen);
  } catch (err) {
    req.log.error('cms/screens create failed', { err });
    next(err);
  }
};

exports.patch = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(createError(400, { errors: errors.array() }));
    const updated = await cmsService.updateScreen(req.params.slug, req.body);
    if (!updated) return next(createError(404, 'Screen not found'));
    await audit({ action: 'cms.screen.update', entityType: 'Screen', status: 'success', metadata: { slug: req.params.slug } }, req);
    res.json(updated);
  } catch (err) {
    req.log.error('cms/screens patch failed', { err });
    next(err);
  }
};

exports.publish = async (req, res, next) => {
  try {
    const updated = await cmsService.publishScreen(req.params.slug);
    if (!updated) return next(createError(404, 'Screen not found'));
    await audit({ action: 'cms.screen.publish', entityType: 'Screen', status: 'success', metadata: { slug: req.params.slug } }, req);
    res.json(updated);
  } catch (err) {
    req.log.error('cms/screens publish failed', { err });
    next(err);
  }
};
