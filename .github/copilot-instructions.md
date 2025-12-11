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
