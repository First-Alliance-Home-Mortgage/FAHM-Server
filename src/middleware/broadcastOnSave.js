/**
 * Express Middleware: Auto-broadcast on content save
 *
 * Attaches to existing menu/content mutation routes so that
 * any successful POST/PUT/PATCH/DELETE automatically triggers
 * a WebSocket broadcast without changing existing controller code.
 *
 * Usage:
 *   const { broadcastOnMenuSave, broadcastOnScreenSave } = require('./middleware/broadcastOnSave');
 *
 *   // Attach BEFORE your route handlers:
 *   app.use('/api/v1/menus', broadcastOnMenuSave);
 *   app.use('/api/v1/screens', broadcastOnScreenSave);
 */

const { contentBroadcaster } = require('../socket');

/**
 * After a successful mutation (POST/PUT/PATCH/DELETE) on menu routes,
 * broadcast a menu_updated event.
 */
function broadcastOnMenuSave(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }

  const originalJson = res.json.bind(res);
  res.json = function (body) {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      contentBroadcaster.broadcast({
        type: 'menu_updated',
        timestamp: Date.now(),
      });
    }
    return originalJson(body);
  };

  next();
}

/**
 * After a successful mutation on screen/content routes,
 * broadcast a screen_updated event with the screen's alias or id.
 */
function broadcastOnScreenSave(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }

  const originalJson = res.json.bind(res);
  res.json = function (body) {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const screenId = req.params.id || req.params.screenId || body?.data?._id;
      const alias = req.params.alias || body?.data?.alias;

      contentBroadcaster.broadcast({
        type: 'screen_updated',
        screenId,
        alias,
        timestamp: Date.now(),
      });
    }
    return originalJson(body);
  };

  next();
}

/**
 * Generic content update broadcaster.
 * Broadcasts content_updated on any successful mutation.
 */
function broadcastOnContentSave(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }

  const originalJson = res.json.bind(res);
  res.json = function (body) {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      contentBroadcaster.broadcast({
        type: 'content_updated',
        timestamp: Date.now(),
      });
    }
    return originalJson(body);
  };

  next();
}

module.exports = {
  broadcastOnMenuSave,
  broadcastOnScreenSave,
  broadcastOnContentSave,
};
