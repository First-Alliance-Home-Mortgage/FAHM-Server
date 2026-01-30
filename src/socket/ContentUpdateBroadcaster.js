/**
 * ContentUpdateBroadcaster
 *
 * Manages WebSocket connections from mobile clients and broadcasts
 * content update notifications when screen content is changed via
 * the web app / CMS.
 *
 * Usage:
 *   const { ContentUpdateBroadcaster } = require('./ws/ContentUpdateBroadcaster');
 *   const broadcaster = new ContentUpdateBroadcaster(verifyToken);
 *   broadcaster.attach(httpServer);
 */

const { WebSocketServer, WebSocket } = require('ws');
const url = require('url');

class ContentUpdateBroadcaster {
  /**
   * @param {(token: string) => Promise<{ userId: string, roles: string[] } | null>} verifyToken
   */
  constructor(verifyToken) {
    this.wss = null;
    this.clients = new Set();
    this.heartbeatInterval = null;
    this.verifyToken = verifyToken;
  }

  /**
   * Attach the WebSocket server to an existing HTTP server.
   * Listens on the `/ws/content` path.
   * @param {import('http').Server} server
   */
  attach(server) {
    this.wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', async (request, socket, head) => {
      const { pathname, query } = url.parse(request.url || '', true);

      if (pathname !== '/ws/content') {
        socket.destroy();
        return;
      }

      const token = query.token;
      let authPayload = null;

      if (token) {
        try {
          authPayload = await this.verifyToken(token);
        } catch {
          // verification failed
        }
      }

      if (!authPayload) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      this.wss.handleUpgrade(request, socket, head, (ws) => {
        this.wss.emit('connection', ws, request, authPayload);
      });
    });

    this.wss.on('connection', (ws, _req, auth) => {
      const client = {
        ws,
        userId: auth.userId,
        roles: auth.roles,
        connectedAt: Date.now(),
        isAlive: true,
      };

      this.clients.add(client);
      console.log(`[WS] Client connected: ${auth.userId} (${this.clients.size} total)`);

      ws.on('pong', () => { client.isAlive = true; });

      ws.on('close', () => {
        this.clients.delete(client);
        console.log(`[WS] Client disconnected: ${auth.userId} (${this.clients.size} total)`);
      });

      ws.on('error', (err) => {
        console.error(`[WS] Client error (${auth.userId}):`, err.message);
        this.clients.delete(client);
      });
    });

    this._startHeartbeat();
    console.log('[WS] ContentUpdateBroadcaster attached on /ws/content');
  }

  /**
   * Broadcast a content update event to all connected clients.
   * @param {{ type: string, screenId?: string, alias?: string, timestamp: number }} event
   */
  broadcast(event) {
    const message = JSON.stringify(event);
    let sent = 0;

    for (const client of this.clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
        sent++;
      }
    }

    console.log(`[WS] Broadcast "${event.type}" to ${sent}/${this.clients.size} clients`);
  }

  /**
   * Send a targeted update to clients with specific roles.
   * @param {{ type: string, screenId?: string, alias?: string, timestamp: number }} event
   * @param {string[]} roles
   */
  broadcastToRoles(event, roles) {
    const message = JSON.stringify(event);
    let sent = 0;

    for (const client of this.clients) {
      if (client.ws.readyState !== WebSocket.OPEN) continue;
      const hasRole = client.roles && client.roles.some((r) => roles.includes(r));
      if (hasRole) {
        client.ws.send(message);
        sent++;
      }
    }

    console.log(`[WS] Broadcast "${event.type}" to ${sent} clients (roles: ${roles.join(', ')})`);
  }

  /** @returns {number} */
  get connectedCount() {
    return this.clients.size;
  }

  shutdown() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    for (const client of this.clients) {
      client.ws.close(1001, 'Server shutting down');
    }
    this.clients.clear();
    if (this.wss) { this.wss.close(); this.wss = null; }
    console.log('[WS] ContentUpdateBroadcaster shut down');
  }

  /** @private */
  _startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      for (const client of this.clients) {
        if (!client.isAlive) { client.ws.terminate(); this.clients.delete(client); continue; }
        client.isAlive = false;
        client.ws.ping();
      }
    }, 30_000);
  }
}

module.exports = { ContentUpdateBroadcaster };
