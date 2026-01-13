# Users & Roles API – Frontend Integration Guide

Base URL: `/api/v1`
Auth: Bearer JWT required for protected endpoints

## Source
- Routes: `src/routes/users.js`, `src/routes/role.js`
- Controllers: `src/controllers/userController.js`, `src/controllers/roleController.js`
- Roles config: `src/config/roles.js`

---

## Users API

### GET /users/me
- Auth: required
- Returns current user profile
- Response: `{ user }`

Example:
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/v1/users/me
```

### PATCH /users/me
- Auth: required
- Update current user profile
- Body (any subset): `name?`, `phone?`, `title?`, `photo?`, `branch?`
- Response: `{ user }`

Example:
```bash
curl -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Jane Doe","phone":"5551234567"}' \
  http://localhost:4000/api/v1/users/me
```

### POST /users/push-token
- Register or update Expo push token
- Body: `userId`, `expoPushToken`
- Response: `{ success }`

Example:
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"userId":"<id>","expoPushToken":"ExponentPushToken[...]"}' \
  http://localhost:4000/api/v1/users/push-token
```

### POST /users/profile-picture
- Auth: required
- Upload profile picture (multipart)
- Body: `file` (image)
- Response: `{ success, photoUrl, user }`

Example:
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/photo.jpg" \
  http://localhost:4000/api/v1/users/profile-picture
```

### GET /users (admin)
- Auth: admin only
- List users with filters/pagination
- Query params:
  - `role?` (string)
  - `active?` (boolean)
  - `q?` (string; search name/email)
  - `page?` (integer; default 1)
  - `limit?` (integer; default 20, max 100)
  - `sort?` (string; e.g., `-createdAt`)
- Response: `{ users, page, pageSize, total }`

Example:
```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:4000/api/v1/users?role=borrower&active=true&q=jane&page=1&limit=20&sort=-createdAt"
```

### POST /users (admin)
- Auth: admin only
- Create user
- Body: `name`, `email`, `password`; optional `phone`, `role`, `title`, `branch`
- Validates `role` against configured roles
- Response: `{ user }` (201)

Example:
```bash
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"John","email":"john@example.com","password":"secret123","role":"borrower"}' \
  http://localhost:4000/api/v1/users
```

### GET /users/{id} (admin)
- Auth: admin only
- Get user by id
- Response: `{ user }`

Example:
```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:4000/api/v1/users/USER_ID
```

### PATCH /users/{id} (admin)
- Auth: admin only
- Update user fields (excluding `password`)
- Validates `role` if provided
- Response: `{ user }`

Example:
```bash
curl -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Jane"}' \
  http://localhost:4000/api/v1/users/USER_ID
```

### DELETE /users/{id} (admin)
- Auth: admin only
- Soft delete: sets `isActive=false`
- Response: `{ success: true }`

Example:
```bash
curl -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:4000/api/v1/users/USER_ID
```

---

## Roles API (admin)

### GET /roles
- List roles
- Response: `[ { _id, name } ]`

Example:
```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:4000/api/v1/roles
```

### POST /roles
- Create a role
- Body: `name`
- Response: `{ _id, name }` (201)

Example:
```bash
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"analyst"}' \
  http://localhost:4000/api/v1/roles
```

### DELETE /roles/{id}
- Delete a role
- Response: `{ message: 'Role deleted', id }`

Example:
```bash
curl -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:4000/api/v1/roles/ROLE_ID
```

---

## Notes
- Use `Authorization: Bearer <JWT>` for all protected endpoints.
- Admin-only endpoints enforce RBAC via middleware.
- `role` values must be one of configured roles in `src/config/roles.js`.
