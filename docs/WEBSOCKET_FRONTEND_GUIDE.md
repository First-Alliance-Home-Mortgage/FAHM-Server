# WebSocket Frontend Integration Guide (Next.js)

> Real-time content updates for the FAHM Next.js frontend.

---

## Overview

The FAHM backend broadcasts real-time events via WebSocket when content (menus, screens, CMS) is modified by administrators. The frontend subscribes to these events to keep the UI in sync without polling.

### Architecture

```
  Admin makes CMS change (REST API)
           │
           ▼
  Backend middleware detects mutation
           │
           ▼
  ContentUpdateBroadcaster sends event to all connected WS clients
           │
           ▼
  Frontend receives event → invalidates React Query cache → UI refreshes
```

---

## Connection Details

| Property | Value |
|---|---|
| **Endpoint** | `ws(s)://<host>/ws/content` |
| **Auth** | JWT passed as query parameter: `?token=<JWT>` |
| **Protocol** | Standard WebSocket (`ws` library on server) |
| **Heartbeat** | Server sends ping every 30 seconds |
| **Events** | `menu_updated`, `screen_updated`, `content_updated` |

---

## Event Payloads

### `menu_updated`
Fired when any menu is created, updated, deleted, visibility toggled, reset, or restored.

```json
{
  "type": "menu_updated",
  "timestamp": "2024-06-15T10:30:00.000Z"
}
```

### `screen_updated`
Fired when a CMS screen is created, updated, or published.

```json
{
  "type": "screen_updated",
  "screenId": "64abc123...",
  "alias": "dashboard",
  "timestamp": "2024-06-15T10:30:00.000Z"
}
```

### `content_updated`
Generic content change event (manually triggered by admin via REST).

```json
{
  "type": "content_updated",
  "timestamp": "2024-06-15T10:30:00.000Z"
}
```

---

## Implementation

### 1. WebSocket Manager Class

For production use, create a reusable WebSocket manager with reconnection logic.

```typescript
// lib/websocket.ts

type EventHandler = (data: any) => void;

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string;
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isClosedManually = false;

  constructor(baseUrl: string, token: string) {
    this.url = `${baseUrl}/ws/content?token=${token}`;
    this.token = token;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    this.isClosedManually = false;

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('[WS] Connected');
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const handlers = this.handlers.get(data.type);
          handlers?.forEach((handler) => handler(data));

          // Also notify wildcard listeners
          const wildcardHandlers = this.handlers.get('*');
          wildcardHandlers?.forEach((handler) => handler(data));
        } catch (err) {
          console.error('[WS] Failed to parse message:', err);
        }
      };

      this.ws.onclose = () => {
        console.log('[WS] Disconnected');
        if (!this.isClosedManually) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('[WS] Error:', error);
      };
    } catch (err) {
      console.error('[WS] Connection failed:', err);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WS] Max reconnect attempts reached');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  on(eventType: string, handler: EventHandler): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.handlers.get(eventType)?.delete(handler);
    };
  }

  disconnect(): void {
    this.isClosedManually = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.ws?.close();
    this.ws = null;
    this.handlers.clear();
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
```

### 2. React Hook

```typescript
// hooks/useWebSocket.ts
'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useQueryClient } from '@tanstack/react-query';
import { WebSocketManager } from '@/lib/websocket';

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000';

export function useWebSocket() {
  const token = useAuthStore((s) => s.token);
  const queryClient = useQueryClient();
  const managerRef = useRef<WebSocketManager | null>(null);

  useEffect(() => {
    if (!token) return;

    const manager = new WebSocketManager(WS_BASE, token);
    managerRef.current = manager;

    // Register event handlers that invalidate React Query caches
    manager.on('menu_updated', () => {
      queryClient.invalidateQueries({ queryKey: ['menus'] });
    });

    manager.on('screen_updated', (data) => {
      queryClient.invalidateQueries({ queryKey: ['screens'] });
      if (data.alias) {
        queryClient.invalidateQueries({ queryKey: ['screens', data.alias] });
      }
    });

    manager.on('content_updated', () => {
      queryClient.invalidateQueries({ queryKey: ['cms'] });
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
    });

    manager.connect();

    return () => {
      manager.disconnect();
      managerRef.current = null;
    };
  }, [token, queryClient]);

  return {
    isConnected: managerRef.current?.isConnected ?? false,
  };
}
```

### 3. Custom Event Subscription Hook

For components that need to react to specific events beyond cache invalidation:

```typescript
// hooks/useWSEvent.ts
'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { WebSocketManager } from '@/lib/websocket';

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000';

// Singleton manager for shared subscriptions
let sharedManager: WebSocketManager | null = null;
let subscriberCount = 0;

function getManager(token: string): WebSocketManager {
  if (!sharedManager) {
    sharedManager = new WebSocketManager(WS_BASE, token);
    sharedManager.connect();
  }
  subscriberCount++;
  return sharedManager;
}

function releaseManager(): void {
  subscriberCount--;
  if (subscriberCount <= 0 && sharedManager) {
    sharedManager.disconnect();
    sharedManager = null;
    subscriberCount = 0;
  }
}

export function useWSEvent(
  eventType: 'menu_updated' | 'screen_updated' | 'content_updated' | '*',
  callback: (data: any) => void
) {
  const token = useAuthStore((s) => s.token);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!token) return;

    const manager = getManager(token);
    const unsubscribe = manager.on(eventType, (data) => {
      callbackRef.current(data);
    });

    return () => {
      unsubscribe();
      releaseManager();
    };
  }, [token, eventType]);
}
```

### 4. Usage Examples

#### In Dashboard Layout (auto-refresh navigation)
```typescript
// app/(dashboard)/layout.tsx
'use client';

import { useWebSocket } from '@/hooks/useWebSocket';

export default function DashboardLayout({ children }) {
  useWebSocket(); // Connects WS and auto-invalidates caches
  return <div>{children}</div>;
}
```

#### Show Toast on Menu Update
```typescript
// components/layout/Header.tsx
'use client';

import { useWSEvent } from '@/hooks/useWSEvent';
import { toast } from 'your-toast-library';

export function Header() {
  useWSEvent('menu_updated', () => {
    toast.info('Navigation has been updated');
  });

  useWSEvent('screen_updated', (data) => {
    toast.info(`Screen "${data.alias}" has been updated`);
  });

  return <header>...</header>;
}
```

#### Admin: Show Connected Clients Count
```typescript
// components/admin/WSStatus.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export function WSStatus() {
  const { data } = useQuery({
    queryKey: ['ws-status'],
    queryFn: () => apiClient.get('/content-updates/status').then((r) => r.data),
    refetchInterval: 10000, // Poll every 10s
  });

  return (
    <div className="flex items-center gap-2">
      <span className="w-2 h-2 rounded-full bg-green-500" />
      <span>{data?.connectedClients ?? 0} clients connected</span>
    </div>
  );
}
```

---

## Production Considerations

### Use WSS in Production
```env
# .env.local (production)
NEXT_PUBLIC_WS_URL=wss://api.fahm.com
```

### Connection State Indicator

```typescript
// components/ui/ConnectionStatus.tsx
'use client';

import { useState, useEffect } from 'react';
import { useWSEvent } from '@/hooks/useWSEvent';

export function ConnectionStatus() {
  const [connected, setConnected] = useState(false);

  useWSEvent('*', () => {
    setConnected(true);
  });

  return (
    <div className="flex items-center gap-1 text-xs">
      <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
      <span>{connected ? 'Live' : 'Offline'}</span>
    </div>
  );
}
```

### Handling Token Expiration

If the JWT expires while the WebSocket is connected, the server will drop the connection. The reconnect logic will attempt to reconnect, but the new connection will also fail if the token hasn't been refreshed.

**Solution:** Before reconnecting, check if the token in the auth store has been refreshed by the Axios interceptor:

```typescript
// In WebSocketManager.scheduleReconnect:
private scheduleReconnect(): void {
  const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

  this.reconnectTimer = setTimeout(() => {
    // Get fresh token from store
    const freshToken = useAuthStore.getState().token;
    if (freshToken && freshToken !== this.token) {
      this.token = freshToken;
      this.url = `${WS_BASE}/ws/content?token=${freshToken}`;
    }
    this.reconnectAttempts++;
    this.connect();
  }, delay);
}
```

---

## Debugging Checklist

If WebSocket events are not being received:

1. **Check connection URL** — Ensure `wss://` in production, `ws://` in development
2. **Verify JWT** — Token must be valid and not expired
3. **Check CORS/proxy** — WebSocket upgrades may be blocked by proxies
4. **Server logs** — Look for `[WS] Client connected` and `[WS] Broadcast` messages
5. **Browser DevTools** — Network tab > WS filter shows connection status and messages
6. **Render/Heroku** — Some PaaS platforms require specific WebSocket configuration

---

## Events That Trigger Broadcasts

These backend operations automatically broadcast WebSocket events via the `broadcastOnSave` middleware:

| Operation | Event |
|---|---|
| `POST /api/v1/menus` | `menu_updated` |
| `PUT /api/v1/menus/:id` | `menu_updated` |
| `PATCH /api/v1/menus/:id/visibility` | `menu_updated` |
| `DELETE /api/v1/menus/:id` | `menu_updated` |
| `POST /api/v1/menus/reset` | `menu_updated` |
| `POST /api/v1/menus/restore/:version` | `menu_updated` |
| `POST /api/v1/cms/screens` | `screen_updated` |
| `PATCH /api/v1/cms/screens/:slug` | `screen_updated` |
| `POST /api/v1/cms/screens/:slug/publish` | `screen_updated` |
| `POST /api/v1/content-updates/notify` | `content_updated` |
| `POST /api/v1/content-updates/menu-updated` | `menu_updated` |
| `POST /api/v1/content-updates/screen-updated` | `screen_updated` |
