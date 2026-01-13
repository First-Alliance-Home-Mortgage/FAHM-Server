# Menu Backend Implementation Guide

This frontend expects a simple REST backend for menu management (single active configuration, no version history). Use the schema and endpoints below to stay compatible.

## Endpoints

- `GET /menus`
  - Returns the full array of menu objects (see schema). Include unassigned items too.
- `GET /menus/grouped` (optional if you populate the FE grouping server-side)
  - Shape: `{ drawer: MenuItem[], tab: MenuItem[], stack: MenuItem[] }`
  - `MenuItem` here can be minimal `{ id, label, icon?, roles?, visible?, order?, type? }`.
- `GET /menus/roles`
  - Returns array of valid role strings. The FE falls back to its built-in roles if empty.
- `POST /menus/reset`
  - Resets to a preset/default configuration. Should also reset labels/icons/visibility/roles/order/type.
- `PUT /menus`
  - Body: `MenuItem[]` (complete list). Persist all items; do not drop unassigned ones.

## MenuItem Schema (as used by the FE)

```ts
interface MenuItem {
  id: string;               // stable key
  label: string;            // display label
  icon: string;             // icon name (string identifier)
  route: string;            // app route
  type: 'drawer' | 'tab' | 'stack'; // grouping determines placement
  parent: string | null;    // unused today; keep null
  order: number;            // position within its type (0-based ok)
  visible: boolean;         // if false, FE hides it
  roles?: string[];         // allowed roles
  analytics?: {             // optional; FE shows if present
    views: number;
    uniqueUsers?: number;
    lastAccessed?: string;  // ISO date string
  };
}
```

### Notes
- Always return all menus. The FE sends all menus on save; keep unassigned items instead of deleting them.
- `type` + `order` drive placement. If an item is unassigned in FE, preserve its previous type/order when saving.
- `visible` and `roles` gate rendering. FE uses them directly.
- `icon` and `label` are editable by admins; persist changes.

## Save Flow (PUT /menus)
- FE sends every menu item with updated `type`, `order`, `label`, `icon`, `visible`, `roles`.
- Persist atomically. Recommend validating:
  - unique `id`
  - `type` in `['drawer','tab','stack']`
  - `order` numeric (normalize if needed)
  - `roles` subset of known roles
- Return 200 with the saved array (or minimal ack). FE does not require transformed data.

## Reset Flow (POST /menus/reset)
- Replace current config with your preset/defaults.
- After reset, `GET /menus` should reflect the preset.

## Grouped Endpoint (GET /menus/grouped)
- Optional convenience. If implemented, return arrays ordered by `order`. FE will render in that order.

## Roles Endpoint (GET /menus/roles)
- Return allowed roles as strings. FE defaults to its local list if this is empty or fails.

## Error Handling
- Non-200 responses should include `{ message: string }` when possible.
- FE surfaces generic errors; clearer messages improve UX.

## Minimal Sample Response (GET /menus)
```json
[
  {
    "id": "dashboard",
    "label": "Dashboard",
    "icon": "gauge",
    "route": "/dashboard",
    "type": "tab",
    "parent": null,
    "order": 0,
    "visible": true,
    "roles": ["admin", "borrower"],
    "analytics": { "views": 1200, "uniqueUsers": 340, "lastAccessed": "2025-12-15T10:00:00Z" }
  },
  {
    "id": "admin",
    "label": "Admin",
    "icon": "shield",
    "route": "/admin",
    "type": "drawer",
    "parent": null,
    "order": 0,
    "visible": true,
    "roles": ["admin"]
  }
]
```

## Checklist
- [ ] Implement endpoints above
- [ ] Persist full menu array on PUT (do not drop unassigned items)
- [ ] Enforce unique `id`, valid `type`, and normalized `order`
- [ ] Preserve `label`, `icon`, `visible`, `roles`
- [ ] Reset endpoint sets default config
- [ ] Optional: grouped endpoint returns ordered arrays per type
- [ ] Optional: populate `analytics` if available
