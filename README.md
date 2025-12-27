# FAHM REST API (Node.js + Express + MongoDB)

Backend scaffold for the FAHM mobile app. Provides a REST-only API with a clean structure, JWT auth, role-based access, and Mongoose models aligned with the requirements document.

## Structure
- `src/server.js` – bootstrap server
- `src/app.js` – Express app, middleware, route mounting
- `src/db/mongoose.js` – Mongo connection
- `src/config` – env + role constants
- `src/middleware` – auth, error handling
- `src/models` – `User`, `LoanApplication`, `Document`, `Notification`
- `src/controllers` – auth, loans, documents, notifications, users
- `src/routes` – route definitions under `/api/v1`
- `src/services` – shared services (e.g., JWT)
- `src/utils` – helpers (logger, async handler)

## Setup
1) Copy `.env.example` to `.env` and fill values (Mongo URI, JWT secret, etc.). You can override refresh token lifetime via `REFRESH_TOKEN_EXPIRATION_DAYS` (defaults to 30).
2) Install deps:
```bash
npm install
```
3) Run in dev:
```bash
npm run dev
```

## API Documentation

**Interactive Swagger UI:** [http://localhost:4000/api-docs](http://localhost:4000/api-docs)  
**OpenAPI Spec (JSON):** [http://localhost:4000/api-docs.json](http://localhost:4000/api-docs.json)  
**Markdown Documentation:** See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)

The Swagger UI provides an interactive interface to explore and test all API endpoints. You can authenticate using the "Authorize" button with your JWT token.

## Key Endpoints (v1)
- `POST /api/v1/auth/register` – register user (borrower/LO/etc.)
- `POST /api/v1/auth/login` – login, returns JWT
- `POST /api/v1/auth/refresh` – exchange refresh token for new JWT
- `POST /api/v1/auth/logout` – revoke refresh token / end session
- `GET /api/v1/users/me` – current user profile
- `GET /api/v1/loans` – list loans (borrowers see their own)
- `POST /api/v1/loans` – create loan (role-protected)
- `GET /api/v1/loans/:id` – loan detail
- `PATCH /api/v1/loans/:id/status` – update status/milestones
- `GET /api/v1/documents/:loanId` – list docs for a loan
- `POST /api/v1/documents` – upload doc metadata (stub for POS/Encompass push)
- `POST /api/v1/documents/:id/synced` – mark doc synced to LOS/POS
- `GET /api/v1/notifications` – list notifications for user
- `POST /api/v1/notifications` – create notification (system/admin)
- `POST /api/v1/notifications/:id/read` – mark as read
- `GET /health` – health check

## Notes for future work
- Wire external integrations (Encompass, Total Expert, POS, Xactus, Optimal Blue, Twilio) in dedicated service modules.
- Add request validation library config and a real logger/metrics stack.
- Add automated tests and linting.

