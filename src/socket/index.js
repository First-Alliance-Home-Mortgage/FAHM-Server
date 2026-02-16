/**
 * WebSocket module entry point.
 *
 * Usage:
 *   const { contentBroadcaster } = require('./ws');
 *   contentBroadcaster.attach(httpServer);
 */

const jwt = require('jsonwebtoken');
const { ContentUpdateBroadcaster } = require('./ContentUpdateBroadcaster');
const { jwtSecret } = require('../config/env');

/**
 * Replace with your own auth logic.
 * @param {string} token
 * @returns {Promise<{ userId: string, roles: string[] } | null>}
 */
async function verifyToken(token) {
  try {
    const payload = jwt.verify(token, jwtSecret);
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
