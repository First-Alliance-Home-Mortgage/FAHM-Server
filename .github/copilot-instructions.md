
# FAHM Server – AI Agent Coding Guide

## Quickstart
- Copy `.env.example` to `.env` and fill required values (`MONGO_URI`, `JWT_SECRET`, etc).
- Install dependencies: `npm install`
- Start dev server: `npm run dev` (nodemon, reloads on change)
- Run tests: `npm test` (Jest + Supertest; see [__tests__](../../__tests__))
- API docs: [http://localhost:4000/api-docs](http://localhost:4000/api-docs)

## Architecture & Patterns
- **REST API**: Node.js/Express, MongoDB (Mongoose). No SQL backends.
- **Entry**: [src/server.js](../../src/server.js) → [src/app.js](../../src/app.js) (middleware, logger, Swagger, mounts `/api/v1` via [src/routes/index.js](../../src/routes/index.js)).
- **Feature structure**: Each domain (auth, loans, docs, POS, CRM, etc) has its own controller, service, and route file under `src/`.
- **Controllers**: Thin; always validate input, check auth/roles, call services/helpers, and shape JSON output. Use [src/utils/asyncHandler.js](../../src/utils/asyncHandler.js) for async controllers.
- **Auth & RBAC**: JWT via [src/services/tokenService.js](../../src/services/tokenService.js), checked in [src/middleware/auth.js](../../src/middleware/auth.js). Use `authorize({ roles, capabilities })` (see [src/config/roles.js](../../src/config/roles.js)). Borrower queries must scope by `req.user`.
- **Validation**: Use `express-validator` and check `validationResult` before business logic (see [src/controllers/documentUploadController.js](../../src/controllers/documentUploadController.js)).
- **Logging**: Use [src/utils/logger.js](../../src/utils/logger.js) (JSON logs, requestId/user context via `req.log`). No `console.*`.
- **Audit**: Persist with [src/utils/audit.js](../../src/utils/audit.js); never throw on audit failure. Include loanId/posApplicationId where relevant.
- **Uploads**: [src/controllers/documentUploadController.js](../../src/controllers/documentUploadController.js) → [src/services/azureBlobService.js](../../src/services/azureBlobService.js). Enforce MIME allowlist, 10MB limit, and access checks.
- **Integrations**: External systems (Encompass, POS, CRM, Optimal Blue, Twilio, etc) are isolated in `src/services` and `src/jobs`. See summaries in [summaries/](../../summaries/).
- **Schedulers**: [src/server.js](../../src/server.js) starts Mongo, then launches jobs in [src/jobs](../../src/jobs) and [src/schedulers](../../src/schedulers).

## Key Endpoints (examples)
- `POST /api/v1/auth/login` – login, returns JWT
- `GET /api/v1/users/me` – current user profile
- `GET /api/v1/loans` – list loans (borrowers see their own)
- `POST /api/v1/documents` – upload doc metadata
- `GET /api/v1/notifications` – list notifications for user
- See [README.md](../../README.md) for more

## Contribution & Extension
- Register new routes in [src/routes/index.js](../../src/routes/index.js)
- Add auth/authorize guards to new endpoints
- Align with audit/logging/validation patterns above
- For borrower-scoped resources, always filter by `req.user` and return minimal fields
- Document new env vars in README and add validation in [src/config/env.js](../../src/config/env.js)

## Testing & Build
- Run all tests: `npm test`
- Unit only: `npm test:unit` | Integration only: `npm test:integration`
- Node >=18 required

---
For more, see [README.md](../../README.md), [summaries/](../../summaries/), and [src/config/env.js](../../src/config/env.js).

