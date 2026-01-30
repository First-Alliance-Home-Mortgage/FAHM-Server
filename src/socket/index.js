/**
 * WebSocket module entry point.
 *
 * Creates a singleton ContentUpdateBroadcaster with JWT verification
 * and exports it for use across the server.
 *
 * Usage:
 *   const { contentBroadcaster } = require('./ws');
 *   contentBroadcaster.attach(httpServer);
 */

const jwt = require('jsonwebtoken');
const { ContentUpdateBroadcaster } = require('./ContentUpdateBroadcaster');
const { jwtSecret } = require('../config/env');

const JWT_SECRET = jwtSecret || '';

/**
 * Verify a JWT token and extract user info.
 * Replace with your own auth logic as needed.
 *
 * @param {string} token
 * @returns {Promise<{ userId: string, roles: string[] } | null>}
 */
async function verifyToken(token) {
  try {
    const payload = jwt.verify(token, JWT_SECRET);

    const userId = payload.sub || payload.userId;
    if (!userId) return null;

    const roles = payload.roles || (payload.role ? [payload.role] : []);

    return { userId, roles };
  } catch {
    return null;
  }
}

const contentBroadcaster = new ContentUpdateBroadcaster(verifyToken);

module.exports = { contentBroadcaster, ContentUpdateBroadcaster };
