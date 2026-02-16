/**
 * Express Middleware: Auto-broadcast on content save
 *
 * Attaches to existing routes so any successful mutation
 * automatically triggers a WebSocket broadcast.
 *
 * Usage:
 *   const { broadcastOnMenuSave, broadcastOnScreenSave } = require('./middleware/broadcastOnSave');
 *   app.use('/api/v1/menus', broadcastOnMenuSave);
 *   app.use('/api/v1/screens', broadcastOnScreenSave);
 */

const { contentBroadcaster } = require('../socket/index');
const logger = require('../utils/logger');

function broadcastOnMenuSave(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();

  const originalJson = res.json.bind(res);
  res.json = function (body) {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const event = { type: 'menu_updated', timestamp: Date.now() };
      // Debug log for WebSocket broadcast
      (req.log || logger).debug('[WS] Broadcasting menu update', event);
      contentBroadcaster.broadcast(event);
    }
    return originalJson(body);
  };

  next();
}

function broadcastOnScreenSave(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();

  const originalJson = res.json.bind(res);
  res.json = function (body) {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const screenId = req.params.id || req.params.screenId || body?.data?._id;
      const alias = req.params.alias || body?.data?.alias;
      const event = {
        type: 'screen_updated',
        screenId,
        alias,
        timestamp: Date.now(),
      };
      // Debug log for WebSocket broadcast
      (req.log || logger).debug('[WS] Broadcasting screen update', event);
      contentBroadcaster.broadcast(event);
    }
    return originalJson(body);
  };

  next();
}

function broadcastOnContentSave(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();

  const originalJson = res.json.bind(res);
  res.json = function (body) {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const event = { type: 'content_updated', timestamp: Date.now() };
      // Debug log for WebSocket broadcast
      (req.log || logger).debug('[WS] Broadcasting content update', event);
      contentBroadcaster.broadcast(event);
    }
    return originalJson(body);
  };

  next();
}

module.exports = { broadcastOnMenuSave, broadcastOnScreenSave, broadcastOnContentSave };
