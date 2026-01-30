/**
 * Content Updates API Routes
 *
 * REST endpoints for WebSocket broadcast triggers + per-screen content fetch.
 *
 * Mount in your Express app:
 *   const contentUpdatesRouter = require('./routes/contentUpdates');
 *   app.use('/api/v1/content-updates', contentUpdatesRouter);
 */

const { Router } = require('express');
const { contentBroadcaster } = require('../socket/index');

const router = Router();

/**
 * POST /api/v1/content-updates/notify
 *
 * Body:
 *   {
 *     "type": "content_updated" | "menu_updated" | "screen_updated",
 *     "screenId": "optional-screen-id",
 *     "alias": "optional-alias",
 *     "roles": ["borrower"]   // optional: target specific roles
 *   }
 */
router.post('/notify', (req, res) => {
  const { type, screenId, alias, roles } = req.body;

  if (!type || !['content_updated', 'menu_updated', 'screen_updated'].includes(type)) {
    return res.status(400).json({ error: 'Invalid or missing "type" field' });
  }

  const event = { type, screenId, alias, timestamp: Date.now() };

  if (Array.isArray(roles) && roles.length > 0) {
    contentBroadcaster.broadcastToRoles(event, roles);
  } else {
    contentBroadcaster.broadcast(event);
  }

  return res.json({
    ok: true,
    broadcast: { event, connectedClients: contentBroadcaster.connectedCount },
  });
});

/**
 * POST /api/v1/content-updates/screen-updated
 * Body: { "screenId": "abc123", "alias": "home" }
 */
router.post('/screen-updated', (req, res) => {
  const { screenId, alias } = req.body;

  if (!screenId && !alias) {
    return res.status(400).json({ error: 'Provide "screenId" or "alias"' });
  }

  const event = { type: 'screen_updated', screenId, alias, timestamp: Date.now() };
  contentBroadcaster.broadcast(event);

  return res.json({
    ok: true,
    broadcast: { event, connectedClients: contentBroadcaster.connectedCount },
  });
});

/**
 * POST /api/v1/content-updates/menu-updated
 */
router.post('/menu-updated', (req, res) => {
  const event = { type: 'menu_updated', timestamp: Date.now() };
  contentBroadcaster.broadcast(event);

  return res.json({
    ok: true,
    broadcast: { event, connectedClients: contentBroadcaster.connectedCount },
  });
});

/**
 * GET /api/v1/content-updates/status
 */
router.get('/status', (_req, res) => {
  return res.json({ ok: true, connectedClients: contentBroadcaster.connectedCount });
});

module.exports = router;
