# WebSocket Content Update Integration Guide

This project uses a WebSocket-based real-time notification system to broadcast content changes (menus, screens, etc.) from the web app (admin/CMS) to mobile app clients.

## Architecture Overview
- **Web App (Admin/CMS):** Triggers broadcasts on content changes (menu/screen updates) via Express middleware.
- **Server:** Hosts a WebSocket endpoint at `/ws/content` using the `ws` library. All broadcasts are sent to connected clients.
- **Mobile App:** Subscribes to `/ws/content` and receives real-time updates to refresh UI or data.

---

## Server Implementation
- **WebSocket Endpoint:** `ws(s)://<host>/ws/content?token=JWT`
- **Authentication:** JWT token required as `token` query param. Token is verified on connection.
- **Broadcast Triggers:**
  - Middleware in `src/middleware/broadcastOnSave.js` wraps `res.json` for menu/screen/content routes.
  - On successful mutation (POST/PUT/PATCH/DELETE), broadcasts an event (e.g., `{ type: 'menu_updated', timestamp }`).
- **Broadcast Logic:**
  - See `src/socket/ContentUpdateBroadcaster.js` for connection, heartbeat, and broadcast details.
  - All connected clients receive the event.

---

## Web App (Admin/CMS) – How to Trigger Broadcasts
- **No client code needed.**
- Any menu or screen change via API (e.g., POST/PUT/DELETE to `/api/v1/menus` or `/api/v1/screens`) automatically triggers a broadcast via the middleware.
- To add a new broadcast type, update the relevant middleware in `broadcastOnSave.js`.

---

## Mobile App – How to Subscribe
**Example (JavaScript/React Native):**
```js
const ws = new WebSocket('wss://<host>/ws/content?token=YOUR_JWT');

ws.onopen = () => {
  console.log('WebSocket connected');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'menu_updated') {
    // Refresh menus or trigger UI update
  }
  if (data.type === 'screen_updated') {
    // Refresh screen or trigger UI update
  }
};

ws.onclose = () => {
  console.log('WebSocket disconnected');
  // Optionally implement reconnect logic
};

ws.onerror = (err) => {
  console.error('WebSocket error', err);
};
```
- **Reconnect logic:** Recommended for production (see Render docs for exponential backoff).
- **Token:** Use a valid JWT for the user.

---

## Event Types
- `menu_updated`: Menus changed (payload: `{ type, timestamp }`)
- `screen_updated`: Screen changed (payload: `{ type, screenId, alias, timestamp }`)
- `content_updated`: Generic content change

---

## Debugging
- Server logs broadcast attempts and client connections.
- If no events are received, check:
  - Client is using `wss://` in production
  - JWT is valid
  - WebSocket endpoint is reachable
  - Server logs show `[WS] Client connected` and `[WS] Broadcast ...`

---

## References
- Middleware: `src/middleware/broadcastOnSave.js`
- WebSocket server: `src/socket/ContentUpdateBroadcaster.js`, `src/socket/index.js`
- Render WebSocket docs: https://render.com/docs/websocket
