# FAHM Server – AI Assistant Brief

## System Map
- Pure Node.js/Express REST API; server.js boots app.js, which wires middleware and mounts /api/v1 routers from src/routes.
- Controllers in src/controllers stay thin: parse/validate input, call services/helpers, shape JSON.
- Data access uses Mongoose models in src/models via src/db/mongoose.js. No raw Mongo queries.
- Shared utilities live under src/services (external systems) and src/utils (logger, async wrappers, token helpers).

## Auth & RBAC
- JWT auth only; tokens issued by services/tokenService.js, verified in middleware/auth.js which attaches req.user.
- Role constants defined in config/roles.js; authorization middleware expects explicit allow-lists per route.
- Borrower-facing queries must scope by req.user.id (see loanController.list for expected filtering pattern).

## Coding Conventions
- CommonJS everywhere (require/module.exports). Mixing ESM triggers lint issues.
- Wrap async handlers with utils/asyncHandler; bubble errors via next(err) and let middleware/error.js format responses.
- Validation lives alongside routes using express-validator; controllers must check validationResult before running logic.
- Use logger.info/error from utils/logger.js instead of console.*; prefix intentionally unused vars with _ to satisfy lint rules.

## Core Domains
- Loans & pipeline: loanController, dashboardController, rateController manage borrower lifecycle, milestones, pipeline KPIs.
- Calculator & rate shopping: calculatorController, rateAlertController, services/optimalBlueService.js provide payments, APR, alerts.
- Documents & uploads: legacy documentController plus new Azure/POS flow in documentUploadController + services/azureBlobService.js / posUploadService.js.
- Engagement: business cards, preapproval letters, consent/persona views, referral sources, chatbot, SMS texting each have dedicated controller + model per README/docs.
- POS connectivity: posController (Blend/Big POS SSO) and posLinkController (sessionized handoff) share OAuth helpers and audit logging.

## External Integrations
- Encompass LOS, Total Expert CRM, Optimal Blue rates, Xactus credit, Azure AD B2C, Twilio SMS, Power BI, Azure Blob all have service modules with cached OAuth tokens and retry-friendly helpers.
- Services return plain JS objects; controllers handle serialization. Extend existing helpers when adding endpoints so refresh/expiry logic stays centralized.

## Jobs & Async Work
- Recurring work (rate sync, CRM sync, Encompass sync, metrics aggregation, retention cleanup) lives under src/jobs and is scheduled from src/schedulers bootstrap files. Follow that pattern for new cron tasks.

## Environment & Config
- Required vars validated in config/env.js (MONGO_URI, JWT_SECRET, per-integration creds, etc.). Add new env requirements there so boot fails fast when misconfigured.
- No .env committed; document newly introduced settings in README when adding dependencies.

## Development Workflow
- npm install → npm run dev (nodemon) for local work, npm start for production profile.
- Tests use Jest + Supertest (npm test); suites live under __tests__/unit and __tests__/integration.
- Swagger/OpenAPI served from src/config/swagger.js and exposed at /api-docs for quick manual verification of new endpoints.

## Contribution Tips
- Keep router registration centralized in src/routes/index.js; every controller addition needs an entry there plus auth/permission guards.
- Prefer feature-focused helpers/services over bloating controllers; most integrations already expose service shells you can extend.
- When touching long-running flows (uploads, POS sessions, chatbot, alerts), ensure analytics counters and audit logs stay consistent—they drive dashboards and compliance reporting.

