const cmsService = require('../services/cmsService');

exports.list = async (req, res, next) => {
  try {
    const components = await cmsService.listComponentRegistry();
    res.json(components);
  } catch (err) {
    req.log.error('cms/component-registry list failed', { err });
    next(err);
  }
};
