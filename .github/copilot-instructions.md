# FAHM Server - AI Coding Assistant Instructions

## Project Overview
Node.js REST API backend for FAHM mobile app using Express, MongoDB (Mongoose), JWT auth with role-based access control. No frontend - API-only server for loan application management.

## Architecture & Core Patterns

### Request Flow
`server.js` bootstraps → `app.js` mounts middleware & routes → `/api/v1/*` routes → `authenticate` middleware → `authorize` middleware → controller → model → response

### Role-Based Access Control
Seven distinct roles in `config/roles.js`: `borrower`, `loan_officer_tpo`, `loan_officer_retail`, `broker`, `branch_manager`, `realtor`, `admin`. Apply roles in routes using `authorize(roles.ADMIN, roles.LO_RETAIL)` after `authenticate` middleware. Borrowers see only their own loans (filtered in `loanController.list`).

### Error Handling Pattern
All async route handlers use `asyncHandler` wrapper (see `utils/asyncHandler.js`) or try-catch with `next(err)`. Use `http-errors` package: `createError(404, 'Loan not found')`. Central error middleware in `middleware/error.js` logs and formats responses.

### Controllers & Validation
Controllers live in `controllers/`, handle business logic only. Use `express-validator` in routes (see `routes/loans.js` for examples). Always call `validationResult(req)` in controllers and return `createError(400, { errors: errors.array() })` on validation failure.

### Authentication Flow
JWT tokens via `tokenService.sign(user)` return 12h expiring tokens with `{ sub: userId, role, email }` payload. `authenticate` middleware extracts Bearer token, verifies, attaches `req.user` (without password field). Password hashing handled automatically in User model pre-save hook using bcryptjs.

## Models & Data Patterns

### User Model (`models/User.js`)
- Password field has `select: false` by default - must explicitly `.select('+password')` when comparing passwords
- Pre-save hook auto-hashes passwords only when modified
- Instance method `comparePassword(candidate)` returns Promise<boolean>

### LoanApplication Model (`models/LoanApplication.js`)
- Uses embedded `milestones` array (not separate collection) with schema `{ name, status, updatedAt }`
- References User docs via `borrower` and `assignedOfficer` ObjectIds
- Always `.populate('borrower', 'name email')` when returning loan data
- Encompass integration fields: `encompassLoanId`, `lastEncompassSync`, `encompassData`

### LoanContact Model (`models/LoanContact.js`)
- Stores assigned contacts for loans (Loan Officer, Processor, Underwriter, Closer)
- Links to both loan and user, includes Encompass ID for sync
- Indexed by loan and role for efficient queries

### Message Model (`models/Message.js`)
- In-app secure messaging between borrowers and loan team
- Auto-synced to Encompass via `encompassSynced` flag
- Supports text, system, document, and milestone message types

### Document Model (`models/Document.js`)
- References both `loan` (LoanApplication) and `uploadedBy` (User)
- `status` tracks sync state: `pending` → `synced` (for external system integration)
- `url` field stores document location (implementation stub - no actual file storage yet)

## Development Commands

```bash
npm run dev        # Run with nodemon (auto-restart)
npm start          # Production mode
npm run lint       # ESLint check
```

## Encompass Integration

### Auto-Sync Scheduler
- Runs every 15 minutes automatically (started in `server.js`)
- Syncs active loans (not 'funded') with Encompass LOS
- Updates milestones, contacts, and loan status
- Logs all sync operations in `EncompassSyncLog` model

### Manual Sync
- `POST /api/v1/encompass/loans/:id/sync` - Trigger immediate sync
- Returns updated loan data, contacts, and sync duration

### Messaging
- All in-app messages auto-logged to Encompass for compliance
- `encompassSynced` flag tracks sync status
- Bidirectional: app → Encompass (future: Encompass → app via webhooks)

### Service Layer (`services/encompassService.js`)
- OAuth 2.0 token management with automatic refresh
- Methods: `getLoanDetails`, `getLoanMilestones`, `getLoanContacts`, `updateLoanStatus`, `uploadDocument`, `sendMessage`
- Transforms Encompass data formats to FAHM schemas

## Total Expert CRM Integration

### Auto-Sync Scheduler
- Runs every 15 minutes automatically (started in `server.js`)
- Bidirectional sync: contacts, journeys, and activities
- Syncs FAHM users to CRM as contacts, imports marketing journeys
- Logs all sync operations in `CRMSyncLog` model

### CRM Models
- **CRMContact**: Stores borrower/partner contacts with engagement scores and journey enrollments
- **CRMJourney**: Marketing journey definitions with trigger types and steps
- **CRMActivityLog**: All in-app communications logged for CRM sync
- **CRMSyncLog**: Audit trail for sync operations

### Marketing Journeys
- Trigger journeys on milestone updates: `POST /api/v1/crm/loans/:id/trigger-milestone-journey`
- Manual enrollment: `POST /api/v1/crm/contacts/:contactId/journeys/:journeyId/enroll`
- Journey types: milestone_update, new_lead, application_submit, manual, scheduled

### Engagement Tracking
- `GET /api/v1/crm/contacts/:contactId/engagement` - Real-time engagement metrics
- Tracks email opens, clicks, SMS replies, and overall engagement score
- Displays active journeys and completion status in LO dashboards

### Activity Logging
- All in-app messages, notifications, and communications auto-logged to CRM
- `POST /api/v1/crm/contacts/:contactId/activities` - Manual activity logging
- Activity types: message, push_notification, email, sms, call, journey_step, milestone_update

### Service Layer (`services/totalExpertService.js`)
- OAuth 2.0 token management with automatic refresh
- Methods: `syncContact`, `getContactEngagement`, `enrollInJourney`, `triggerMilestoneJourney`, `logActivity`
- Transforms Total Expert data formats to FAHM schemas

## Environment & Configuration
Required env vars checked at startup in `config/env.js`: `MONGO_URI`, `JWT_SECRET`. Optional: `PORT` (default 4000), `LOG_LEVEL`, integration URLs for Encompass/TotalExpert/POS/Xactus/OptimalBlue. No `.env` in repo - developers must create locally.

## Key Conventions

- **No TypeScript**: Pure CommonJS Node.js (require/module.exports)
- **Mongoose over raw MongoDB**: All DB access through Mongoose models with schemas
- **No file uploads implemented**: Document endpoints accept metadata only, external sync is stubbed
- **Logging**: Use `logger.info()` / `logger.error()` from `utils/logger.js`, never `console.log`
- **Unused vars**: Prefix with `_` to avoid lint warnings (e.g., `_next`, `_err`)
- **Route nesting**: All routes under `/api/v1` prefix, mounted in `routes/index.js`

## Testing & Future Work
Tests not yet implemented (`npm test` is placeholder). External integrations (Encompass, Twilio, etc.) referenced in `config/env.js` but not wired up - add service modules when needed.

## Postman Collection
`Postman_Collection_v1.json` contains all API endpoint examples for manual testing.
