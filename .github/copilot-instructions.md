
# FAHM Server – AI Agent Coding Guide

## Quickstart
- Copy `.env.example` to `.env` and fill required values (`MONGO_URI`, `JWT_SECRET`, etc)
- Install dependencies: `npm install`
- Start dev server: `npm run dev` (nodemon, reloads on change)
- Run tests: `npm test` (Jest + Supertest; see [__tests__](__tests__))
- API docs: [http://localhost:4000/api-docs](http://localhost:4000/api-docs)

## Architecture & Patterns
- **REST API**: Node.js/Express, MongoDB (Mongoose). No SQL backends.
- **Entry**: [src/server.js](src/server.js) → [src/app.js](src/app.js) (middleware, logger, Swagger, mounts `/api/v1` via [src/routes/index.js](src/routes/index.js))
- **Feature structure**: Each domain (auth, loans, docs, POS, CRM, etc) has its own controller, service, and route file under `src/`
- **Controllers**: Thin; always validate input, check auth/roles, call services/helpers, and shape JSON output. Wrap async controllers with `asyncHandler` from [src/utils/asyncHandler.js](src/utils/asyncHandler.js) OR use try/catch with `next(error)`
- **Auth & RBAC**: JWT via [src/services/tokenService.js](src/services/tokenService.js), checked in [src/middleware/auth.js](src/middleware/auth.js). Use `authenticate` then `authorize({ roles, capabilities })` (see [src/config/roles.js](src/config/roles.js)). Borrower queries MUST scope by `req.user`
- **Validation**: Use `express-validator`. Export validators as arrays (e.g., `exports.validatePushToken = [body('userId').notEmpty(), ...]`) and check `validationResult(req)` in controller. Pass errors to `next(createError(400, { errors: errors.array() }))`
- **Error handling**: Use `http-errors` package: `createError(statusCode, message)` or `createError(statusCode, { errors: [...] })`. Pass to `next(error)`. Central handler in [src/middleware/error.js](src/middleware/error.js) logs 5xx errors, returns JSON with `{ message, errors?, stack? }`
- **Logging**: Use [src/utils/logger.js](src/utils/logger.js) (JSON logs, requestId/user context). Call `req.log.info()`, `req.log.error()`, etc. NEVER use `console.log/error/warn/info` (exception: internal logger implementation and env.js startup warnings)
- **Audit**: Persist with `audit({ action, entityType, entityId, status, metadata }, req)` from [src/utils/audit.js](src/utils/audit.js). NEVER throw on audit failure. Include loanId/posApplicationId where relevant
- **Uploads**: [src/controllers/documentUploadController.js](src/controllers/documentUploadController.js) → [src/services/azureBlobService.js](src/services/azureBlobService.js). Enforce MIME allowlist (`ALLOWED_MIME_TYPES`), 10MB limit, and borrower/officer access checks before generating presigned URLs
- **Integrations**: External systems (Encompass, POS, CRM, Optimal Blue, Twilio, etc) are isolated in `src/services` and `src/jobs`. See summaries in [summaries/](summaries/)
- **Schedulers**: [src/server.js](src/server.js) starts Mongo, then launches jobs in [src/jobs](src/jobs) and [src/schedulers](src/schedulers)

## Controller Pattern (complete example)
```javascript
const createError = require('http-errors');
const { body, validationResult } = require('express-validator');
const Model = require('../models/Model');
const logger = require('../utils/logger');
const { audit } = require('../utils/audit');

exports.validateCreate = [
  body('field').notEmpty().withMessage('field is required'),
];

exports.create = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, { errors: errors.array() }));
    }
    
    // Business logic
    const item = await Model.create({ ...req.body, user: req.user._id });
    
    // Audit (never throws)
    await audit({ action: 'model.create', entityType: 'Model', entityId: item._id }, req);
    
    req.log.info('Model created', { itemId: item._id });
    res.status(201).json({ item });
  } catch (error) {
    req.log.error('Error creating model', { error });
    next(error);
  }
};
```

## Key Endpoints (examples)
- `POST /api/v1/auth/login` – login, returns JWT
- `GET /api/v1/users/me` – current user profile
- `GET /api/v1/loans` – list loans (borrowers see their own)
- `POST /api/v1/documents` – upload doc metadata
- `GET /api/v1/notifications` – list notifications for user
- See [README.md](README.md) for more

## Contribution & Extension
- Register new routes in [src/routes/index.js](src/routes/index.js)
- Add `authenticate` and `authorize` guards to protected endpoints
- Align with validation/logging/audit patterns above
- For borrower-scoped resources, always filter by `req.user._id` and return minimal fields
- Document new env vars in README and add validation in [src/config/env.js](src/config/env.js)

## Testing & Build
- Run all tests: `npm test` (includes coverage)
- Unit only: `npm test:unit` | Integration only: `npm test:integration`
- Watch mode: `npm test:watch`
- Node >=18 required

---
For more, see [README.md](README.md), [summaries/](summaries/), and [src/config/env.js](src/config/env.js).

