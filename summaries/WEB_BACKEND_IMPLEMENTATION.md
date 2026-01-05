# FAHM Web Backend (Node.js + MongoDB)

## Purpose
Backend implementation guide for the FAHM web app (Next.js App Router) mirroring mobile journeys and RBAC, using MongoDB, Redis, and integrations (Encompass, Total Expert, Optimal Blue, Blend/Big POS, Xactus).

## Architecture
- Runtime: Next.js 15 (App Router) on Node.js, TypeScript, React 19.
- Data: MongoDB Atlas (TLS, IP allowlist); Redis (Upstash) for counters, rate limits, and fan-out queues.
- APIs: Route Handlers for REST-style endpoints; Server Actions for low-latency mutations.
- Auth: NextAuth (OIDC/Azure B2C/SAML) with role claim mapping and middleware-based RBAC.
- Validation: Zod schemas shared client/server; React Hook Form on the client.
- Storage: S3/Azure Blob/GCS via presigned URLs; AV scan hook.
- Observability: OpenTelemetry to Datadog/New Relic; Sentry (frontend and backend); pino structured logs with request IDs and role metadata.

## Roles & RBAC
- Port `Role` union and `roleCapabilities` from mobile into `lib/auth/roles.ts`.
- Expose `hasCapability(role, capability)` for middleware, API handlers, and UI gates.
- NextAuth session token carries `role`; middleware redirects unauthenticated to `/(auth)/login` and unauthorized to `/(app)/dashboard`.

## Data Models (MongoDB)
Use strict schemas and indexes (Mongoose or drizzle-orm/mongodb). Key collections:
- users: email (unique, indexed), name, role, status, mfaEnabled, timestamps.
- loans: borrowerId, team (userId + role), status, milestones, contacts, products, alerts, timestamps; indexes on borrowerId, team.userId, status.
- documents: loanId, ownerId, type, status, storageKey, mimeType, size, versions, avStatus, timestamps; indexes on loanId, ownerId.
- messages: participants, lastMessageAt, unreadBy, messages array; indexes on participants, lastMessageAt.
- calculations: userId, type (affordability/refinance/general), input/output, timestamps; indexes on userId, type.
- auditLogs: actorId, actorRole, action, targetType/Id, metadata, createdAt; indexes on createdAt, actorId, targetId.

## API Surface
- Loans: GET/POST/PATCH `/api/loans`, GET `/api/loans/[id]`.
- Milestones: GET/POST `/api/loans/[id]/milestones`.
- Documents: GET/POST `/api/documents`, PATCH `/api/documents/[id]` (create + presign).
- Messages: GET/POST `/api/messages`, POST `/api/messages/[threadId]`, POST `/api/messages/[threadId]/read`.
- Rates: GET `/api/rates` (cache Optimal Blue), POST `/api/rates/lock`.
- Calculations: POST `/api/calculations`, POST `/api/calculations/sync`, GET `/api/calculations`.
- Alerts: GET/POST `/api/alerts`.
- Webhooks: `/api/webhooks/{encompass,blend,optimal-blue,xactus}` with signature verification and job enqueue.

## Integrations
- Encompass, Total Expert, Optimal Blue, Blend/Big POS, and Xactus via `lib/services/*.ts` fetch wrappers.
- Redis for throttling and idempotency where applicable.
- Rate data cached in Redis and refreshed on demand.

## Uploads & Documents
- Presigned URL flow: POST `/api/documents` validates type/size, creates record, returns presign.
- Client uploads directly; webhook/scan updates `avStatus` (`pending` → `clean`/`infected`) and status.
- Signed URLs required for access; enforce MIME/size limits server-side.

## Security & Compliance
- HTTPS-only cookies, SameSite=strict, CSRF on mutations.
- OAuth PKCE; step-up MFA for sensitive actions (rate lock, disclosures, user management).
- Signed URLs for documents; SSRF guards on webhooks; CSP and secure headers.
- PII protection (Mongo CSFLE or envelope keys for sensitive fields).
- Audit logging for privileged actions.

## Observability & Logging
- OpenTelemetry exporters; Sentry for frontend and backend.
- pino logs with request IDs, userId, role, and capability context; forward to log pipeline.

## Performance & Reliability
- Redis-backed rate limits and idempotency keys.
- ISR/`revalidateTag` for dashboards; stale-while-revalidate for rates.
- Paginated queries with indexes; background jobs for syncs and rate snapshots.
- Dynamic import heavy widgets; Suspense boundaries on frontend.

## Testing & QA
- Unit: Zod schemas, utilities, capability checks.
- Integration: API handlers with mocked Mongo/Redis; MSW for external services.
- E2E: Playwright role-based flows (borrower app, LO pipeline, broker submit, admin user management).
- Accessibility checks; security scans (Dependabot/Snyk, secret scan, basic DAST).

## Environment & Config
- Auth: `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `AUTH_ISSUER`, `AUTH_CLIENT_ID`, `AUTH_CLIENT_SECRET`.
- Mongo: `MONGODB_URI`, `MONGODB_DB`.
- Redis: `REDIS_URL`.
- Storage: `STORAGE_BUCKET`, `STORAGE_REGION`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET`.
- Integrations: `ENCOMPASS_BASE_URL`, `ENCOMPASS_CLIENT_ID`, `ENCOMPASS_CLIENT_SECRET`, `TOTAL_EXPERT_BASE_URL`, `TOTAL_EXPERT_API_KEY`, `OPTIMAL_BLUE_BASE_URL`, `OPTIMAL_BLUE_API_KEY`, `BLEND_BASE_URL`, `BLEND_CLIENT_ID`, `BLEND_CLIENT_SECRET`, `XACTUS_BASE_URL`, `XACTUS_API_KEY`, `XACTUS_CERT_PATH`.
- Observability: `SENTRY_DSN`, `OTEL_EXPORTER_OTLP_ENDPOINT`.

## Implementation Phases
1) Foundations: Auth + RBAC model, Mongo/Redis wiring, observability, layout shell.
2) Borrower core: Dashboard, My Loan, Documents (upload/view), Messages, Rates/Alerts, Calculators, Milestones.
3) LO/Broker: Pipeline, New Loan submit (POS handoff), Rate lock, Contacts, Reports.
4) Partners/Realtor: Refer/Submit, co-branded views, shared messaging.
5) Admin/Branch: Users, permissions, audit, team metrics.
6) Hardening: AV scan, MFA, audit exports, performance tuning, load tests.
