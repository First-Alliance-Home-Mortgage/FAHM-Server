# WebSocket Mobile Integration Guide (React Native / Expo)

> Real-time content update listener for the FAHM mobile app.

---

## Overview

The FAHM backend broadcasts real-time events via WebSocket when content (menus, screens, navigation configs, feature flags) is modified by administrators. The mobile app subscribes to these events to keep cached data in sync without polling.

### Flow

```
  Admin saves change in CMS (REST API)
           |
           v
  broadcastOnSave middleware intercepts 2xx response
           |
           v
  ContentUpdateBroadcaster sends event to all connected WS clients
           |
           v
  Mobile app receives event --> refreshes local data --> UI updates
```

---

## Connection Details

| Property        | Value                                          |
| --------------- | ---------------------------------------------- |
| **Endpoint**    | `wss://<host>/ws/content`                      |
| **Auth**        | JWT passed as query parameter: `?token=<JWT>`  |
| **Protocol**    | Standard WebSocket (`ws` library on server)    |
| **Heartbeat**   | Server pings every 30 seconds                  |
| **Events**      | `menu_updated`, `screen_updated`, `content_updated` |

---

## Event Payloads

### `menu_updated`

Fired when any menu or menu-config is created, updated, deleted, visibility toggled, reset, or restored.

```json
{
  "type": "menu_updated",
  "timestamp": 1719484200000
}
```

### `screen_updated`

Fired when a CMS screen is created, patched, or published.

```json
{
  "type": "screen_updated",
  "screenId": "64abc123...",
  "alias": "dashboard",
  "timestamp": 1719484200000
}
```

### `content_updated`

Fired when navigation configs or feature flags are saved, or manually triggered by admin.

```json
{
  "type": "content_updated",
  "timestamp": 1719484200000
}
```

---

## Events That Trigger Broadcasts

These backend operations automatically broadcast WebSocket events:

| Operation                                  | Event              |
| ------------------------------------------ | ------------------ |
| `POST /api/v1/menus`                       | `menu_updated`     |
| `PUT /api/v1/menus/:id`                    | `menu_updated`     |
| `PATCH /api/v1/menus/:id/visibility`       | `menu_updated`     |
| `DELETE /api/v1/menus/:id`                  | `menu_updated`     |
| `POST /api/v1/menus/reset`                 | `menu_updated`     |
| `POST /api/v1/menus/restore/:version`      | `menu_updated`     |
| `PUT /api/v1/menu-config`                  | `menu_updated`     |
| `POST /api/v1/cms/screens`                 | `screen_updated`   |
| `PATCH /api/v1/cms/screens/:slug`          | `screen_updated`   |
| `POST /api/v1/cms/screens/:slug/publish`   | `screen_updated`   |
| `PUT /api/v1/cms/navigation-configs`       | `content_updated`  |
| `PUT /api/v1/cms/feature-flags`            | `content_updated`  |
| `PATCH /api/v1/cms/feature-flags/:key`     | `content_updated`  |
| `POST /api/v1/content-updates/notify`      | *(varies by body)* |
| `POST /api/v1/content-updates/menu-updated`    | `menu_updated`  |
| `POST /api/v1/content-updates/screen-updated`  | `screen_updated`|

---

## Implementation (React Native / Expo)

### 1. WebSocket Manager

A standalone class with reconnection, AppState handling, and token refresh support.

```typescript
// services/WebSocketManager.ts

import { AppState, AppStateStatus } from 'react-native';

type EventHandler = (data: any) => void;

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private baseUrl: string;
  private getToken: () => string | null;
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 15;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isClosedManually = false;
  private appStateSubscription: any = null;

  constructor(baseUrl: string, getToken: () => string | null) {
    this.baseUrl = baseUrl;
    this.getToken = getToken;
  }

  connect(): void {
    const token = this.getToken();
    if (!token) return;
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.isClosedManually = false;

    try {
      const url = `${this.baseUrl}/ws/content?token=${token}`;
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('[WS] Connected');
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event: WebSocketMessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          // Notify type-specific handlers
          this.handlers.get(data.type)?.forEach((h) => h(data));
          // Notify wildcard handlers
          this.handlers.get('*')?.forEach((h) => h(data));
        } catch (err) {
          console.error('[WS] Parse error:', err);
        }
      };

      this.ws.onclose = () => {
        console.log('[WS] Disconnected');
        if (!this.isClosedManually) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (err: Event) => {
        console.error('[WS] Error:', err);
      };
    } catch (err) {
      console.error('[WS] Connection failed:', err);
      this.scheduleReconnect();
    }
  }

  /** Subscribe to an event type. Returns an unsubscribe function. */
  on(eventType: string, handler: EventHandler): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);

    return () => {
      this.handlers.get(eventType)?.delete(handler);
    };
  }

  /** Start listening to AppState to auto-reconnect on foreground. */
  startAppStateListener(): void {
    this.appStateSubscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState === 'active') {
          // App came to foreground — reconnect if needed
          if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.reconnectAttempts = 0;
            this.connect();
          }
        }
      }
    );
  }

  disconnect(): void {
    this.isClosedManually = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.appStateSubscription?.remove();
    this.appStateSubscription = null;
    this.ws?.close();
    this.ws = null;
    this.handlers.clear();
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // --- Private ---

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[WS] Max reconnect attempts reached');
      return;
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, ... capped at 30s
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }
}
```

### 2. React Context Provider

Provides a singleton WebSocket manager to the entire app.

```typescript
// providers/WebSocketProvider.tsx

import React, { createContext, useContext, useEffect, useRef } from 'react';
import { WebSocketManager } from '../services/WebSocketManager';
import { useAuth } from '../hooks/useAuth'; // your auth hook

const API_WS_URL = process.env.EXPO_PUBLIC_WS_URL || 'wss://api.fahm.com';

const WebSocketContext = createContext<WebSocketManager | null>(null);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const managerRef = useRef<WebSocketManager | null>(null);

  useEffect(() => {
    if (!token) return;

    const manager = new WebSocketManager(API_WS_URL, () => token);
    managerRef.current = manager;

    manager.startAppStateListener();
    manager.connect();

    return () => {
      manager.disconnect();
      managerRef.current = null;
    };
  }, [token]);

  return (
    <WebSocketContext.Provider value={managerRef.current}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketManager(): WebSocketManager | null {
  return useContext(WebSocketContext);
}
```

### 3. Event Subscription Hook

```typescript
// hooks/useWSEvent.ts

import { useEffect, useRef } from 'react';
import { useWebSocketManager } from '../providers/WebSocketProvider';

type WSEventType = 'menu_updated' | 'screen_updated' | 'content_updated' | '*';

export function useWSEvent(eventType: WSEventType, callback: (data: any) => void) {
  const manager = useWebSocketManager();
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!manager) return;

    const unsubscribe = manager.on(eventType, (data) => {
      callbackRef.current(data);
    });

    return unsubscribe;
  }, [manager, eventType]);
}
```

### 4. Data Refresh Hook (React Query / TanStack Query)

Automatically invalidates cached queries when events arrive.

```typescript
// hooks/useWSCacheInvalidation.ts

import { useQueryClient } from '@tanstack/react-query';
import { useWSEvent } from './useWSEvent';

export function useWSCacheInvalidation() {
  const queryClient = useQueryClient();

  useWSEvent('menu_updated', () => {
    queryClient.invalidateQueries({ queryKey: ['menus'] });
    queryClient.invalidateQueries({ queryKey: ['menu-config'] });
  });

  useWSEvent('screen_updated', (data) => {
    queryClient.invalidateQueries({ queryKey: ['screens'] });
    if (data.alias) {
      queryClient.invalidateQueries({ queryKey: ['screens', data.alias] });
    }
  });

  useWSEvent('content_updated', () => {
    queryClient.invalidateQueries({ queryKey: ['navigation-configs'] });
    queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
  });
}
```

---

## Wiring It Up

### App Entry Point

```typescript
// App.tsx (or app/_layout.tsx for Expo Router)

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WebSocketProvider } from './providers/WebSocketProvider';
import { AuthProvider } from './providers/AuthProvider';

const queryClient = new QueryClient();

export default function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <WebSocketProvider>
          <AppNavigator />
        </WebSocketProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
}
```

### Root Navigator (activate cache invalidation)

```typescript
// navigation/AppNavigator.tsx

import { useWSCacheInvalidation } from '../hooks/useWSCacheInvalidation';

export function AppNavigator() {
  // This single call keeps all caches in sync via WebSocket
  useWSCacheInvalidation();

  return (
    // your navigator tree
  );
}
```

### Screen-Level Usage (toast / custom reaction)

```typescript
// screens/DashboardScreen.tsx

import { useWSEvent } from '../hooks/useWSEvent';
import Toast from 'react-native-toast-message';

export function DashboardScreen() {
  useWSEvent('menu_updated', () => {
    Toast.show({ type: 'info', text1: 'Navigation updated' });
  });

  useWSEvent('screen_updated', (data) => {
    if (data.alias === 'dashboard') {
      Toast.show({ type: 'info', text1: 'Dashboard content refreshed' });
    }
  });

  return (/* ... */);
}
```

---

## Production Considerations

### Environment Config

```env
# .env (Expo)
EXPO_PUBLIC_WS_URL=wss://api.fahm.com

# .env.development
EXPO_PUBLIC_WS_URL=ws://localhost:4000
```

### AppState Reconnection

The `WebSocketManager.startAppStateListener()` handles reconnecting when the app returns from background. This is critical on mobile where the OS may close idle socket connections.

### Token Expiration

If the JWT expires while the socket is open, the server drops the connection. The reconnect logic calls `getToken()` on each attempt, so it automatically picks up a refreshed token from your auth store.

### Network Connectivity

For robust handling, combine with `@react-native-community/netinfo`:

```typescript
import NetInfo from '@react-native-community/netinfo';

// Inside WebSocketManager or as a separate hook
NetInfo.addEventListener((state) => {
  if (state.isConnected && !manager.isConnected) {
    manager.connect();
  }
});
```

---

## Debugging

1. **Check server logs** — Look for `[WS] Client connected` and `[WS] Broadcast` entries
2. **Verify JWT** — Token must be valid; expired tokens return `401` on upgrade
3. **Use `wss://` in production** — `ws://` will be rejected by most production proxies
4. **React Native debugger** — Console logs from `WebSocketManager` show connection state and events
5. **GET /api/v1/content-updates/status** — Returns `{ connectedClients: N }` to confirm your client is counted

---

## Server-Side Reference

| File | Purpose |
| ---- | ------- |
| `src/socket/ContentUpdateBroadcaster.js` | WebSocket server, connection management, `broadcast()` / `broadcastToRoles()` |
| `src/socket/index.js` | JWT verification, singleton `contentBroadcaster` instance |
| `src/middleware/broadcastOnSave.js` | Express middleware (`broadcastOnMenuSave`, `broadcastOnScreenSave`, `broadcastOnContentSave`) |
| `src/routes/contentUpdates.js` | Manual broadcast REST endpoints (admin only) |
| `src/server.js` | `contentBroadcaster.attach(server)` at startup |
