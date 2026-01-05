# Backend Implementation Guide: Dynamic Menus API

This document describes how to implement the backend for dynamic menu management, as required by the FAHM Web Admin and Mobile App.

---

## Endpoints

### 1. GET `/menus`
- **Purpose:** Fetch the current menu configuration for all clients (web/mobile).
- **Response:**
  - `200 OK` with an array of menu objects (see schema below).

### 2. PUT `/menus`
- **Purpose:** Update the menu configuration (order, visibility, metadata, etc.).
- **Request Body:**
  - JSON array of menu objects (same schema as below).
- **Response:**
  - `200 OK` with the updated menu config.
- **Security:**
  - Only authenticated admin users can update menus.

---

## Menu Schema
```ts
interface MenuConfig {
  id: string;
  label: string;
  icon: string;
  route: string;
  type: 'drawer' | 'tab' | 'stack';
  parent: string | null;
  order: number;
  visible: boolean;
  roles: string[];
}
```

---

## Implementation Steps

1. **Data Storage**
   - Use a database (e.g., MongoDB, PostgreSQL) or a JSON file for prototyping.
   - Table/collection: `menus`
   - Each document/row represents a menu item.

2. **GET /menus**
   - Fetch all menu items, ordered by `order` and grouped by `parent` if needed.
   - Return as an array of menu objects.

3. **PUT /menus**
   - Accept an array of menu objects.
   - Validate:
     - All required fields are present.
     - `id` is unique for each menu.
     - `roles` are valid role strings.
   - Overwrite the existing menu config (replace all, or upsert by `id`).
   - Optionally, keep a backup/version history for rollback.

4. **Authentication & Authorization**
   - Require authentication for all endpoints.
   - Only allow users with the `admin` role to use PUT.

5. **Error Handling**
   - Return `400 Bad Request` for invalid input.
   - Return `401/403` for unauthorized access.
   - Return `500` for server errors.

---

## Example (Express.js, JSON file storage)
```js
const express = require('express');
const fs = require('fs');
const router = express.Router();
const MENUS_FILE = './menus.json';

// Middleware: require admin
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  next();
}

// GET /menus
router.get('/menus', (req, res) => {
  const menus = JSON.parse(fs.readFileSync(MENUS_FILE, 'utf8'));
  res.json(menus);
});

// PUT /menus
router.put('/menus', requireAdmin, (req, res) => {
  const menus = req.body;
  // Validate here...
  fs.writeFileSync(MENUS_FILE, JSON.stringify(menus, null, 2));
  res.json(menus);
});

module.exports = router;
```

---

## Future Enhancements
- Per-role or per-user menu configs
- Versioning and rollback endpoints
- Analytics on menu usage

---

For questions or support, contact the web platform leads.
