# WebSocket Content Update System

Real-time content update system that broadcasts notifications to connected mobile clients when CMS content (menus, screens) is created, updated, or deleted.

## Architecture Overview

```
 CMS / Web App                     Mobile Clients
 ─────────────                     ──────────────
       │                                 │
       │  REST API (POST/PUT/PATCH/DEL)  │
       ▼                                 │
 ┌───────────┐                           │
 │  Express   │──── broadcastOnSave ─────┤
 │  Routes    │     middleware            │
 └───────────┘                           │
       │                                 │
       │  POST /content-updates/notify   │
       ▼                                 │
 ┌─────────────────────────┐             │
 │ ContentUpdateBroadcaster │────────────┘
 │     (WebSocket Server)   │  ws://host/ws/content
 └─────────────────────────┘
```

There are two broadcast mechanisms:

1. **Automatic** -- The `broadcastOnMenuSave` middleware intercepts successful mutations on `/api/v1/menus` and broadcasts without any changes to controller code.
2. **Explicit** -- The CMS calls dedicated REST endpoints under `/api/v1/content-updates/` to trigger targeted broadcasts.

## File Structure

```
src/
├── socket/
│   ├── index.js                    # Singleton broadcaster with JWT verification
│   └── ContentUpdateBroadcaster.js # WebSocket server class
├── middleware/
│   └── broadcastOnSave.js          # Auto-broadcast Express middleware
├── routes/
│   └── contentUpdates.js           # REST endpoints for manual broadcasts
├── app.js                          # Mounts routes and middleware
└── server.js                       # Creates HTTP server, attaches WebSocket
```

## Integration Points

### `src/server.js`

- Uses `http.createServer(app)` instead of `app.listen()` so the WebSocket server can share the same port.
- Imports `contentBroadcaster` from `./socket/index` and calls `contentBroadcaster.attach(server)` after MongoDB connects.
- Registers a `SIGTERM` handler that calls `contentBroadcaster.shutdown()` before closing the HTTP server.

### `src/app.js`

- Mounts `contentUpdatesRouter` at `/api/v1/content-updates`.
- Attaches `broadcastOnMenuSave` middleware at `/api/v1/menus` **before** the main route handler so menu mutations are automatically broadcast.

## WebSocket Connection

### Endpoint

```
ws://<host>:<port>/ws/content?token=<JWT>
```

### Authentication

Clients must provide a valid JWT as a `token` query parameter. The token is verified using the `JWT_SECRET` environment variable. On failure, the server responds with `401 Unauthorized` and destroys the socket.

The verified token must contain:
- `sub` or `userId` -- identifies the user
- `roles` or `role` -- array or string of the user's roles (used for targeted broadcasts)

### Heartbeat

The server pings every connected client every **30 seconds**. Clients that do not respond with a pong are terminated. Standard WebSocket clients handle pong automatically.

### Events Received by Clients

All events are JSON with this shape:

```json
{
  "type": "menu_updated | screen_updated | content_updated",
  "screenId": "optional",
  "alias": "optional",
  "timestamp": 1706000000000
}
```

| Event Type | Trigger | Fields |
|---|---|---|
| `menu_updated` | Menu items added/removed/reordered | `type`, `timestamp` |
| `screen_updated` | A screen's content is saved | `type`, `screenId`, `alias`, `timestamp` |
| `content_updated` | Generic content change | `type`, `timestamp` |

## REST API Endpoints

All endpoints are mounted at `/api/v1/content-updates`.

### POST `/notify`

Generic broadcast endpoint. The CMS calls this to notify clients of any content change.

**Request Body:**

```json
{
  "type": "content_updated | menu_updated | screen_updated",
  "screenId": "optional-screen-id",
  "alias": "optional-alias",
  "roles": ["borrower", "loan_officer_retail"]
}
```

- `type` (required) -- must be one of the three event types.
- `roles` (optional) -- when provided, only clients with a matching role receive the event.

**Response:**

```json
{
  "ok": true,
  "broadcast": {
    "event": { "type": "menu_updated", "timestamp": 1706000000000 },
    "connectedClients": 12
  }
}
```

### POST `/screen-updated`

Convenience endpoint for screen changes.

**Request Body:**

```json
{
  "screenId": "abc123",
  "alias": "home"
}
```

At least one of `screenId` or `alias` is required.

### POST `/menu-updated`

Convenience endpoint for menu changes. No body required.

### GET `/status`

Health check returning the number of connected WebSocket clients.

**Response:**

```json
{
  "ok": true,
  "connectedClients": 12
}
```

## Auto-Broadcast Middleware

### `broadcastOnMenuSave`

Attached to `/api/v1/menus`. On any successful (`2xx`) `POST`, `PUT`, `PATCH`, or `DELETE` request, it broadcasts a `menu_updated` event. Works by wrapping `res.json()` -- no changes to existing controllers are needed.

### `broadcastOnScreenSave`

Available for `/api/v1/screens` (not currently mounted). Broadcasts `screen_updated` with the screen's `id` and `alias` extracted from route params or response body.

### `broadcastOnContentSave`

Generic variant that broadcasts `content_updated`. Can be attached to any route that should trigger a notification.

## Mobile Client Integration

### Connecting (JavaScript example)

```js
const ws = new WebSocket('ws://api.example.com/ws/content?token=' + jwtToken);

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case 'menu_updated':
      // Re-fetch menu configuration
      break;
    case 'screen_updated':
      // Re-fetch screen content for data.screenId or data.alias
      break;
    case 'content_updated':
      // Generic refresh
      break;
  }
};

ws.onclose = () => {
  // Implement reconnection with exponential backoff
};
```

### Connecting (React Native example)

```js
import { useEffect, useRef } from 'react';

function useContentUpdates(token, onEvent) {
  const ws = useRef(null);

  useEffect(() => {
    const url = `ws://api.example.com/ws/content?token=${token}`;
    ws.current = new WebSocket(url);

    ws.current.onmessage = (e) => {
      const event = JSON.parse(e.data);
      onEvent(event);
    };

    ws.current.onclose = () => {
      // Reconnect after delay
      setTimeout(() => {
        ws.current = new WebSocket(url);
      }, 3000);
    };

    return () => ws.current?.close();
  }, [token]);
}
```

## Graceful Shutdown

When the process receives `SIGTERM`:

1. `contentBroadcaster.shutdown()` is called.
2. The heartbeat interval is cleared.
3. All connected clients receive a close frame with code `1001` ("Going Away").
4. The WebSocket server is closed.
5. The HTTP server is closed.
6. The process exits.

## Dependencies

| Package | Purpose |
|---|---|
| `ws` | WebSocket server implementation |
| `jsonwebtoken` | JWT verification for client authentication |
