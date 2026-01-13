
# FAHM Server – AI Agent Guide

## Quickstart
- Copy `.env.example` → `.env` and set `MONGO_URI`, `JWT_SECRET`.
- Install deps: `npm install`; start dev: `npm run dev`.
- Run tests: `npm test`; API docs: http://localhost:4000/api-docs.

## Architecture
- Entry: [src/server.js](src/server.js) → [src/app.js](src/app.js); mounts `/api/v1` via [src/routes/index.js](src/routes/index.js).
- Domains live under `src/` as controller + route + service modules (auth, loans, documents, POS, CRM, credit, rates, notifications, menu, chatbot).
- Mongo via Mongoose; no SQL. Swagger served at `/api-docs` using [src/config/swagger.js](src/config/swagger.js).
- Schedulers start after Mongo: see [src/server.js](src/server.js) and jobs/schedulers for Encompass, CRM, FCRA retention, Optimal Blue rate sync, metrics, rate alerts.

## Conventions
- Controllers are thin: validate → auth/RBAC → service → JSON. Use `express-validator` and send errors with `http-errors` to central handler.
- Auth/RBAC: use `authenticate` then `authorize({ roles, capabilities })` from [src/middleware/auth.js](src/middleware/auth.js) with roles in [src/config/roles.js](src/config/roles.js). Borrower queries must filter by `req.user._id`.
- Logging: use [src/utils/logger.js](src/utils/logger.js). Access `req.log`; do not use `console.*` (ok only inside env warnings).
- Audit: call `audit({ action, entityType, entityId, status, metadata }, req)` from [src/utils/audit.js](src/utils/audit.js). Never throw on audit failures.
- Uploads: enforce MIME allowlist and 10MB limits; presign via [src/services/azureBlobService.js](src/services/azureBlobService.js) from [src/controllers/documentUploadController.js](src/controllers/documentUploadController.js).
- CORS: configured via `CORS_ORIGINS` in [src/config/env.js](src/config/env.js); request tracing sets `X-Request-Id` in [src/app.js](src/app.js).

## Minimal Controller Flow (example)
```js
const { validationResult } = require('express-validator');
const createError = require('http-errors');
exports.create = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(createError(400, { errors: errors.array() }));
    const item = await Service.create({ ...req.body, user: req.user._id });
    await audit({ action: 'item.create', entityType: 'Item', entityId: item._id }, req);
    res.status(201).json({ item });
  } catch (err) { next(err); }
};
```

## Workflows
- Lint/tests: `npm run lint`, `npm test`, `npm test:unit`, `npm test:integration`, `npm test:watch`.
- Seeds: `npm run seed:users`, `npm run seed:roles`, `npm run seed:menus`.
- Node >=18 required; config/telemetry/security/integrations via [src/config/env.js](src/config/env.js).

## Integration Boundaries
- External systems isolated in `src/services`, schedulers in `src/jobs`/`src/schedulers`.
- Route inventory: see [src/routes/index.js](src/routes/index.js) for mounted feature routers.

See [README.md](README.md) and [summaries/](summaries/) for endpoint lists and integration summaries.

## Feature Example: Menu API
- Endpoints: see [src/routes/menu.js](src/routes/menu.js): admin `POST /menus/reset`, `GET /menus/versions`, `POST /menus/restore/:version`, `PUT /menus`; user `GET /menus`, `GET /menus/grouped`, admin `GET /menus/roles`.
- Controller: [src/controllers/menuController.js](src/controllers/menuController.js) enforces `validateMenus`, uses `http-errors`, `audit`, and role validation against [src/config/roles.js](src/config/roles.js) plus `all`.
- Models: [src/models/Menu.js](src/models/Menu.js) and versioning via [src/models/menuVersion.js](src/models/menuVersion.js).
- Service: [src/services/menuService.js](src/services/menuService.js) replaces all menus (`deleteMany` + `insertMany`) and sorts by `order` on reads.
- Seeding: run `npm run seed:menus` to load defaults from [scripts/seedMenus.js](scripts/seedMenus.js). `resetMenus` reads the default `menus` export from that file and creates a new `MenuVersion`.

