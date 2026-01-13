# Dynamic Menu Management API – Backend Implementation Guide

## Overview
This document describes the backend API structure and data contracts for supporting dynamic menu management in the FAHM-Web application. The API enables admin users to configure menu assignments (by type), menu visibility, and role-based access for each menu item.

---

## 1. Data Model

### MenuItem
- `id` (string): Unique identifier for the menu (e.g., 'dashboard')
- `label` (string): Display name
- `icon` (string): Icon name or path
- `route` (string): Route path
- `type` ('drawer' | 'tab' | 'stack'): Menu assignment type
- `order` (number): Display order within its type
- `visible` (boolean): Whether the menu is visible
- `roles` (string[]): List of roles allowed to see this menu
- `parent` (string | null): Parent menu id (for nesting)

### Example
```json
{
  "id": "dashboard",
  "label": "Dashboard",
  "icon": "dashboard",
  "route": "/dashboard",
  "type": "drawer",
  "order": 0,
  "visible": true,
  "roles": ["admin", "borrower"],
  "parent": null
}
```

---

## 2. API Endpoints

### GET /menus
- Returns the full list of menu items and their assignments.
- Response: `MenuItem[]`

### PUT /menus
- Accepts a full list of menu items to update assignments, order, visibility, and roles.
- Request body: `MenuItem[]`
- Returns: updated `MenuItem[]`

### GET /menus/roles
- Returns all available roles for assignment.
- Response: `string[]`

---

## 3. Permissions & Security
- Only users with the `admin` role can access menu management endpoints.
- All changes should be audited (who changed what, when).

---

## 4. Implementation Notes
- Store menu configuration in a database (e.g., PostgreSQL, MongoDB) as a collection/table of `MenuItem` objects.
- Use transactions for bulk updates to ensure consistency.
- Validate that all referenced roles exist.
- Consider caching menu config for fast read access.
- Provide a default menu config for system restore/reset.

---

## 5. Example Database Schema (SQL)
```sql
CREATE TABLE menus (
  id VARCHAR PRIMARY KEY,
  label VARCHAR NOT NULL,
  icon VARCHAR,
  route VARCHAR,
  type VARCHAR CHECK (type IN ('drawer', 'tab', 'stack')),
  "order" INT,
  visible BOOLEAN,
  roles TEXT[],
  parent VARCHAR NULL
);
```

---

## 6. Example: Reset/Restore Endpoint
- POST `/menus/reset` – Restores menu config to system default.

---

## 7. Error Handling
- Return 400 for invalid data (e.g., unknown role, duplicate id).
- Return 403 for unauthorized access.
- Return 500 for server/database errors.

---

## 8. Versioning
- Consider versioning menu configs for audit/history and rollback.

---

## 9. References
- See also: [MENU_API_SERVER_DOC.md], [MENU_API_BACKEND_IMPLEMENTATION.md] (if present)

---

For questions or further requirements, contact the FAHM-Web backend team.
