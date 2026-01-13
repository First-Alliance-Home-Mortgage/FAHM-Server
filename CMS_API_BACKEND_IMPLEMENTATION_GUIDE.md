# CMS API – Backend Implementation Guide

## Overview
This document describes the backend API structure and data contracts for the FAHM-Web CMS features: Screens, Navigation, Feature Flags, and Component Registry. These endpoints enable dynamic, role-based UI and navigation management for both web and mobile clients.

---

## 1. Data Models

### Screen
- `slug` (string): Unique identifier for the screen
- `title` (string): Display name
- `route` (string): Route path
- `navigation` (object): `{ type: 'drawer'|'tab'|'stack'|'modal', icon: string, order: number }`
- `roles` (string[]): Roles allowed to access
- `tenant_scope` (string[]): Tenant scoping
- `components` (array): List of component objects (see registry)
- `status` ('draft'|'published')
- `version` (number)

### NavigationConfig
- `type` ('drawer'|'tab'|'stack'|'modal')
- `role` (string)
- `items` (array): `{ screen_slug: string, order: number }[]`

### FeatureFlag
- `key` (string)
- `enabled` (boolean)
- `roles` (string[])
- `min_app_version` (string, optional)

### ComponentRegistryItem
- `type` (string)
- `allowed_props` (object)
- `allowed_actions` (string[])
- `supports_actions` (boolean)
- `status` ('active'|'inactive')

---

## 2. API Endpoints

### Screens
- `GET /cms/screens` – List all screens
- `GET /cms/screens/:slug` – Get a single screen
- `POST /cms/screens` – Create a new screen
- `PATCH /cms/screens/:slug` – Update a screen
- `POST /cms/screens/:slug/publish` – Publish a screen

### Navigation
- `GET /cms/navigation-configs` – List all navigation configs
- `PUT /cms/navigation-configs` – Upsert navigation configs (bulk)

### Feature Flags
- `GET /cms/feature-flags` – List all feature flags
- `PUT /cms/feature-flags` – Upsert feature flags (bulk)
- `PATCH /cms/feature-flags/:key` – Toggle a feature flag

### Component Registry
- `GET /cms/component-registry` – List all registered components

---

## 3. Permissions & Security
- Only users with the `admin` role can create, update, or publish screens, navigation configs, or feature flags.
- All endpoints require authentication.
- All changes should be audited (who changed what, when).

---

## 4. Example Payloads

### Screen
```json
{
  "slug": "dashboard",
  "title": "Dashboard",
  "route": "/dashboard",
  "navigation": { "type": "tab", "icon": "home", "order": 1 },
  "roles": ["admin", "borrower"],
  "tenant_scope": ["global"],
  "components": [
    { "type": "text", "props": { "value": "Welcome!" } }
  ],
  "status": "draft",
  "version": 1
}
```

### NavigationConfig
```json
{
  "type": "drawer",
  "role": "admin",
  "items": [ { "screen_slug": "dashboard", "order": 1 } ]
}
```

### FeatureFlag
```json
{
  "key": "new_ui",
  "enabled": true,
  "roles": ["admin"],
  "min_app_version": "1.0.0"
}
```

### ComponentRegistryItem
```json
{
  "type": "button",
  "allowed_props": { "label": { "type": "string", "required": true } },
  "allowed_actions": ["navigate", "api_call"],
  "supports_actions": true,
  "status": "active"
}
```

---

For further details, see `lib/cms/types.ts` and the frontend integration guide.
