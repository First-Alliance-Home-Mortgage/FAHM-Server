/**
 * Content Updates API Routes
 *
 * REST endpoints that the web app / CMS calls after saving content changes.
 * These endpoints trigger WebSocket broadcasts to connected mobile clients.
 *
 * Mount in your Express app:
 *   const contentUpdatesRouter = require('./routes/contentUpdates');
 *   app.use('/api/v1/content-updates', contentUpdatesRouter);
 */

const { Router } = require('express');
const { contentBroadcaster } = require('../socket');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();

/**
 * POST /api/v1/content-updates/notify
 *
 * Called by the CMS / web app when any screen content is saved.
 *
 * Body:
 *   {
 *     "type": "content_updated" | "menu_updated" | "screen_updated",
 *     "screenId": "optional-screen-id",
 *     "alias": "optional-alias",
 *     "roles": ["borrower", "loan_officer_retail"]   // optional: target specific roles
 *   }
 */
router.post('/notify', authenticate, authorize({ roles: ['admin'] }), (req, res) => {
  const { type, screenId, alias, roles } = req.body;

  if (!type || !['content_updated', 'menu_updated', 'screen_updated'].includes(type)) {
    return res.status(400).json({ error: 'Invalid or missing "type" field' });
  }

  const event = {
    type,
    screenId,
    alias,
    timestamp: Date.now(),
  };

  if (Array.isArray(roles) && roles.length > 0) {
    contentBroadcaster.broadcastToRoles(event, roles);
  } else {
    contentBroadcaster.broadcast(event);
  }

  return res.json({
    ok: true,
    broadcast: {
      event,
      connectedClients: contentBroadcaster.connectedCount,
    },
  });
});

/**
 * POST /api/v1/content-updates/screen-updated
 *
 * Convenience endpoint: broadcast a screen_updated event for a specific screen.
 *
 * Body:
 *   { "screenId": "abc123", "alias": "home" }
 */
router.post('/screen-updated', authenticate, authorize({ roles: ['admin'] }), (req, res) => {
  const { screenId, alias } = req.body;

  if (!screenId && !alias) {
    return res.status(400).json({ error: 'Provide "screenId" or "alias"' });
  }

  const event = {
    type: 'screen_updated',
    screenId,
    alias,
    timestamp: Date.now(),
  };

  contentBroadcaster.broadcast(event);

  return res.json({
    ok: true,
    broadcast: {
      event,
      connectedClients: contentBroadcaster.connectedCount,
    },
  });
});

/**
 * POST /api/v1/content-updates/menu-updated
 *
 * Convenience endpoint: broadcast a menu_updated event.
 * Call this when drawer, tab, or stack menu items are added/removed/reordered.
 */
router.post('/menu-updated', authenticate, authorize({ roles: ['admin'] }), (req, res) => {
  const event = {
    type: 'menu_updated',
    timestamp: Date.now(),
  };

  contentBroadcaster.broadcast(event);

  return res.json({
    ok: true,
    broadcast: {
      event,
      connectedClients: contentBroadcaster.connectedCount,
    },
  });
});

/**
 * GET /api/v1/content-updates/status
 *
 * Health check showing how many clients are connected.
 */
router.get('/status', (_req, res) => {
  return res.json({
    ok: true,
    connectedClients: contentBroadcaster.connectedCount,
  });
});

module.exports = router;
