

# FAHM Server – AI Agent Guide

## Big Picture

FAHM Server is a modular Node.js/Express REST API for the FAHM mobile app, using MongoDB (Mongoose) and JWT-based auth. Each domain (auth, loans, documents, notifications, POS, CRM, credit, rates, chatbot, etc.) is split into controller, route, and service modules under `src/`. All endpoints are mounted under `/api/v1`. External integrations (Encompass, Total Expert, POS, Xactus, Optimal Blue, Twilio) are isolated in `src/services` and scheduled jobs. Swagger/OpenAPI docs are auto-generated and browsable at `/api-docs`.


## Quickstart
- Copy `.env.example` → `.env` and set `MONGO_URI`, `JWT_SECRET` (see [src/config/env.js](src/config/env.js) for required/recommended vars and warnings).
- Install deps: `npm install`; start dev: `npm run dev`.
- Run tests: `npm test`; API docs: http://localhost:4000/api-docs.
- Lint: `npm run lint`. Seed data: `npm run seed:users`, `npm run seed:roles`, `npm run seed:menus`.


## Architecture & Data Flow
- Entry: [src/server.js](src/server.js) → [src/app.js](src/app.js); mounts `/api/v1` via [src/routes/index.js](src/routes/index.js).
- Each feature = controller + route + service (see `src/`).
- MongoDB only (no SQL); models in `src/models/`.
- Swagger served at `/api-docs` using [src/config/swagger.js](src/config/swagger.js).
- Schedulers (Encompass, CRM, FCRA, Optimal Blue, metrics, rate alerts) start after Mongo connects (see [src/server.js](src/server.js)).
- Request tracing: every request gets a `X-Request-Id` (see [src/app.js](src/app.js)).
- All external integrations (Encompass, Total Expert, POS, Xactus, Optimal Blue, Twilio) are isolated in `src/services` and scheduled jobs. See [summaries/](summaries/) for integration details.


## Conventions & Patterns
- Controllers are thin: validate → auth/RBAC → service → JSON. Use `express-validator` and send errors with `http-errors` to central handler.
- Auth/RBAC: use `authenticate` then `authorize({ roles, capabilities })` from [src/middleware/auth.js](src/middleware/auth.js) with roles in [src/config/roles.js](src/config/roles.js). Borrower queries must filter by `req.user._id`.
- Logging: use [src/utils/logger.js](src/utils/logger.js). Access `req.log`; do not use `console.*` (except inside env warnings).
- Audit: call `audit({ action, entityType, entityId, status, metadata }, req)` from [src/utils/audit.js](src/utils/audit.js). Never throw on audit failures.
- Uploads: enforce MIME allowlist and 10MB limits; presign via [src/services/azureBlobService.js](src/services/azureBlobService.js) from [src/controllers/documentUploadController.js](src/controllers/documentUploadController.js).
- CORS: configured via `CORS_ORIGINS` in [src/config/env.js](src/config/env.js); request tracing sets `X-Request-Id` in [src/app.js](src/app.js).
- Schedulers: All major integrations (Encompass, CRM, FCRA, Optimal Blue) have jobs in `src/jobs/` and are started in [src/server.js](src/server.js).


## API & Integration Documentation
- **Swagger UI:** [http://localhost:4000/api-docs](http://localhost:4000/api-docs) (auto-generated, interactive)
- **Endpoint inventories & integration summaries:** see [summaries/](summaries/) and [README.md](README.md)
- **Route inventory:** see [src/routes/index.js](src/routes/index.js) for all mounted routers


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



## Developer Workflows
- Lint: `npm run lint`
- Test: `npm test`, `npm test:unit`, `npm test:integration`, `npm test:watch`
- Seed data: `npm run seed:users`, `npm run seed:roles`, `npm run seed:menus`
- Node >=18 required; all config/telemetry/security/integrations via [src/config/env.js](src/config/env.js)



## Integration Boundaries & Patterns
- All external systems are isolated in `src/services/` (see also `src/jobs/` for schedulers).
- Each integration (Encompass, Total Expert, POS, Xactus, Optimal Blue, Twilio) has a dedicated service, controller, and model(s). See [summaries/](summaries/) for details.
- Schedulers for integrations are started in [src/server.js](src/server.js) and run at defined intervals (see integration summaries for schedules).



## Example: Menu API Pattern
- Endpoints: see [src/routes/menu.js](src/routes/menu.js): admin `POST /menus/reset`, `GET /menus/versions`, `POST /menus/restore/:version`, `PUT /menus`; user `GET /menus`, `GET /menus/grouped`, admin `GET /menus/roles`
- Controller: [src/controllers/menuController.js](src/controllers/menuController.js) enforces `validateMenus`, uses `http-errors`, `audit`, and role validation against [src/config/roles.js](src/config/roles.js) plus `all`
- Models: [src/models/Menu.js](src/models/Menu.js) and versioning via [src/models/menuVersion.js](src/models/menuVersion.js)
- Service: [src/services/menuService.js](src/services/menuService.js) replaces all menus (`deleteMany` + `insertMany`) and sorts by `order` on reads
- Seeding: run `npm run seed:menus` to load defaults from [scripts/seedMenus.js](scripts/seedMenus.js). `resetMenus` reads the default `menus` export from that file and creates a new `MenuVersion`

---

## Integration Highlights (see [summaries/](summaries/))

### Encompass LOS
- Automated loan/milestone/contact sync every 15m via scheduler
- All in-app messages and uploads logged to Encompass for compliance
- [src/services/encompassService.js], [src/controllers/loanController.js], [src/models/LoanContact.js], [src/models/EncompassSyncLog.js]

### Total Expert CRM
- Bidirectional contact/journey/activity sync every 15m (offset from Encompass)
- All borrower/partner contacts, journeys, and activities logged
- [src/services/totalExpertService.js], [src/controllers/crmController.js], [src/models/CRMContact.js], [src/models/CRMJourney.js], [src/models/CRMActivityLog.js], [src/models/CRMSyncLog.js]

### Optimal Blue Rates
- Real-time rate/pricing, rate lock, and alert integration
- Scheduler fetches rates, checks alerts, and logs to CRM
- [src/services/optimalBlueService.js], [src/controllers/rateController.js], [src/models/RateSnapshot.js], [src/models/RateAlert.js], [src/models/ProductPricing.js], [src/models/RateLock.js], [src/jobs/rateSyncJob.js]

### Xactus Credit
- Tri-merge credit pulls, FCRA-compliant retention, consent tracking, encryption
- Daily cleanup and warning schedulers for FCRA compliance
- [src/services/xactusService.js], [src/controllers/creditController.js], [src/models/CreditReport.js], [src/models/CreditPullLog.js]

---

## Additional Notes
- All endpoints are under `/api/v1`.
- Swagger docs at `/api-docs` are always up to date.
- See [summaries/ENDPOINTS.md](summaries/ENDPOINTS.md) for a full endpoint list.
- For integration-specific environment variables, see `.env.example` and integration summaries.
- All code must follow the controller → service → model pattern, with validation and RBAC enforced in controllers.
- Never throw on audit/logging failures; always log errors for monitoring.

