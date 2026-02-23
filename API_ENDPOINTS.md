# FAHM Server API Endpoints

> Base URL: `/api/v1`

## Table of Contents

- [Authentication](#authentication)
- [Users](#users)
- [Loans](#loans)
- [Documents (Metadata)](#documents-metadata)
- [Document Uploads (File Storage)](#document-uploads-file-storage)
- [Notifications](#notifications)
- [POS Integration](#pos-integration)
- [POS Link](#pos-link)
- [Calculator](#calculator)
- [Loan Management (Encompass)](#loan-management-encompass)
- [CRM Integration](#crm-integration)
- [Credit Reporting](#credit-reporting)
- [Rate & Pricing](#rate--pricing)
- [Rate Alerts](#rate-alerts)
- [Performance Dashboard](#performance-dashboard)
- [Business Cards](#business-cards)
- [Preapproval Letters](#preapproval-letters)
- [Consent Management](#consent-management)
- [Persona Views](#persona-views)
- [Referral Sources](#referral-sources)
- [SMS](#sms)
- [Messages](#messages)
- [Chatbot](#chatbot)
- [Menus](#menus)
- [Menu Config](#menu-config)
- [CMS](#cms)
- [Roles](#roles)
- [Capabilities](#capabilities)
- [Audit Logs](#audit-logs)
- [Content Updates (WebSocket)](#content-updates-websocket)
- [Health](#health)

---

## Authentication

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `POST` | `/auth/register` | No | borrower only (self-register) | Register a new user (rate limited: 10/15min) |
| `POST` | `/auth/login` | No | — | Login with email/password (rate limited: 10/15min) |
| `POST` | `/auth/refresh` | No | — | Exchange refresh token for new access token (rate limited: 30/15min) |
| `POST` | `/auth/logout` | Bearer | Any | Logout and revoke refresh token |

---

## Users

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `POST` | `/users/push-token` | Bearer | Any | Register/update Expo push notification token |
| `GET` | `/users/me` | Bearer | Any | Get current user profile |
| `PATCH` | `/users/me` | Bearer | Any | Update current user profile |
| `POST` | `/users/profile-picture` | Bearer | Any | Upload profile picture (multipart/form-data) |
| `GET` | `/users` | Bearer | admin | List users with filtering and pagination |
| `POST` | `/users` | Bearer | admin | Create a new user |
| `GET` | `/users/:id` | Bearer | admin | Get user by ID |
| `PATCH` | `/users/:id` | Bearer | admin | Update user by ID |
| `DELETE` | `/users/:id` | Bearer | admin | Delete user by ID |

---

## Loans

All loan routes require Bearer authentication.

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `GET` | `/loans` | Bearer | Any (scoped) | List loans with filtering, pagination, sorting. Borrowers see own loans only |
| `POST` | `/loans` | Bearer | admin, LO_TPO, LO_RETAIL, broker, borrower | Create a new loan application |
| `GET` | `/loans/:id` | Bearer | Any | Get loan by ID |
| `PATCH` | `/loans/:id/status` | Bearer | admin, LO_TPO, LO_RETAIL | Update loan status and milestones |
| `POST` | `/loans/:id/preapproval` | Bearer | admin, LO_TPO, LO_RETAIL, branch_manager | Generate pre-approval for loan |

---

## Documents (Metadata)

All document routes require Bearer authentication.

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `GET` | `/documents/:loanId` | Bearer | Any | List all documents for a loan |
| `POST` | `/documents` | Bearer | Any | Upload document metadata (name, hash, url) |
| `POST` | `/documents/:id/synced` | Bearer | Any | Mark document as synced to external system |

---

## Document Uploads (File Storage)

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `POST` | `/document-uploads/presign` | Bearer | admin, LO_RETAIL, LO_TPO, broker, borrower | Create presigned upload URL |
| `POST` | `/document-uploads/upload` | Bearer | Any | Upload document files (max 5 files, 10MB each, multipart) |
| `GET` | `/document-uploads/loan/:loanId` | Bearer | Any | Get all documents for a loan |
| `GET` | `/document-uploads/:id` | Bearer | Any | Get document details |
| `GET` | `/document-uploads/:id/download` | Bearer | Any | Download document file |
| `DELETE` | `/document-uploads/:id` | Bearer | Any | Delete a document |
| `POST` | `/document-uploads/:id/retry-sync` | Bearer | LO_RETAIL, LO_TPO, admin | Retry POS sync for failed document |

---

## Notifications

All notification routes require Bearer authentication.

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `GET` | `/notifications` | Bearer | Any | List all notifications for current user |
| `POST` | `/notifications` | Bearer | Any | Create a new notification (respects quiet hours 10PM-7AM) |
| `POST` | `/notifications/:id/read` | Bearer | Any | Mark notification as read |

---

## POS Integration

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `POST` | `/pos/handoff` | Bearer | Any | Create POS handoff token and deep link |
| `POST` | `/pos/initiate` | Bearer | Any | Initiate POS application (Blend/Big POS) |
| `GET` | `/pos/application/:applicationId/status` | Bearer | Any | Get POS application status |
| `POST` | `/pos/application/:applicationId/sync-borrower` | Bearer | Any | Sync borrower data to POS |
| `GET` | `/pos/application/:applicationId/documents` | Bearer | Any | Get POS application documents |
| `POST` | `/pos/application/:applicationId/submit` | Bearer | Any | Submit POS application to underwriting |
| `POST` | `/pos/webhooks/blend` | None | — | Blend webhook (signature verified) |
| `POST` | `/pos/webhooks/big-pos` | None | — | Big POS webhook (signature verified) |

---

## POS Link

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `POST` | `/pos-link/generate` | Bearer | Any | Generate secure POS handoff link |
| `POST` | `/pos-link/activate/:sessionId` | None | — | Activate POS session (public for POS systems) |
| `POST` | `/pos-link/track/:sessionId` | None | — | Track session analytics event (public) |
| `POST` | `/pos-link/callback/:sessionId` | None | — | POS system callback for completion (public) |
| `GET` | `/pos-link/session/:sessionId` | Bearer | Any | Get session details |
| `GET` | `/pos-link/analytics/:sessionId` | Bearer | Any | Get session analytics |
| `GET` | `/pos-link/my-sessions` | Bearer | Any | Get current user's POS sessions |
| `GET` | `/pos-link/lo-sessions` | Bearer | LO_RETAIL, LO_TPO, branch_manager, admin | Get loan officer's POS sessions |
| `POST` | `/pos-link/cancel/:sessionId` | Bearer | Any | Cancel POS session |

---

## Calculator

All calculator routes require Bearer authentication.

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `POST` | `/calculator` | Bearer | Any | Calculate monthly mortgage payment with APR |
| `GET` | `/calculator/rates` | Bearer | Any | Get current mortgage rates for calculator |
| `POST` | `/calculator/amortization` | Bearer | Any | Generate detailed amortization schedule |
| `POST` | `/calculator/apply` | Bearer | Any | Generate "Apply Now" link with pre-filled data |

---

## Loan Management (Encompass)

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `POST` | `/encompass/webhook` | None | — | Webhook for external events (signature verified) |
| `GET` | `/encompass/test-connection` | Bearer | LO_TPO, LO_RETAIL, admin | Test database connection |
| `GET` | `/encompass/pipeline` | Bearer | LO_TPO, LO_RETAIL, branch_manager, admin | Query the loan pipeline |
| `GET` | `/encompass/pipeline/fields` | Bearer | LO_TPO, LO_RETAIL, branch_manager, admin | Get pipeline field definitions |
| `POST` | `/encompass/loans/:id/sync` | Bearer | Any | Get loan data with contacts |
| `GET` | `/encompass/loans/:id/contacts` | Bearer | Any | Get loan contacts |
| `GET` | `/encompass/loans/:id/messages` | Bearer | Any | Get loan messages |
| `POST` | `/encompass/loans/:id/messages` | Bearer | Any | Send message for a loan |
| `POST` | `/encompass/loans/:id/messages/:messageId/read` | Bearer | Any | Mark message as read |
| `GET` | `/encompass/loans/:id/sync-history` | Bearer | LO_TPO, LO_RETAIL, admin, branch_manager | Get sync history |
| `POST` | `/encompass/loans/:id/link` | Bearer | LO_TPO, LO_RETAIL, admin | Link loan to external reference |
| `POST` | `/encompass/loans/:id/unlink` | Bearer | admin | Unlink loan from external reference |
| `PATCH` | `/encompass/loans/:id/status` | Bearer | LO_TPO, LO_RETAIL, admin | Update loan status |
| `GET` | `/encompass/loans/:id/documents` | Bearer | Any | Get loan documents |
| `POST` | `/encompass/loans/:id/documents` | Bearer | Any | Upload document for a loan (base64) |
| `GET` | `/encompass/loans/:id/documents/:documentId/download` | Bearer | Any | Download a document |

---

## CRM Integration

All CRM routes require Bearer authentication.

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `POST` | `/crm/sync/contacts` | Bearer | Any | Sync contacts bidirectionally with CRM |
| `GET` | `/crm/contacts` | Bearer | Any | Get CRM contacts for current user |
| `GET` | `/crm/contacts/:contactId/engagement` | Bearer | Any | Get engagement metrics for a contact |
| `POST` | `/crm/sync/journeys` | Bearer | Any | Sync all marketing journeys from CRM |
| `GET` | `/crm/journeys` | Bearer | Any | Get all active marketing journeys |
| `POST` | `/crm/contacts/:contactId/journeys/:journeyId/enroll` | Bearer | Any | Enroll contact in marketing journey |
| `POST` | `/crm/loans/:loanId/trigger-milestone-journey` | Bearer | Any | Trigger journey based on loan milestone |
| `POST` | `/crm/contacts/:contactId/activities` | Bearer | Any | Log activity for a contact |
| `GET` | `/crm/contacts/:contactId/activities` | Bearer | Any | Get activity history for a contact |
| `GET` | `/crm/sync/logs` | Bearer | Any | Get CRM sync logs |

---

## Credit Reporting

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `POST` | `/credit/loans/:loanId/request` | Bearer | admin, LO_RETAIL, LO_TPO | Request tri-merge credit report |
| `GET` | `/credit/reports/:reportId` | Bearer | Any | Get credit report by ID |
| `GET` | `/credit/loans/:loanId/reports` | Bearer | Any | Get all credit reports for a loan |
| `POST` | `/credit/reports/:reportId/reissue` | Bearer | admin, LO_RETAIL, LO_TPO | Reissue/refresh credit report |
| `GET` | `/credit/logs` | Bearer | admin, LO_RETAIL, LO_TPO | Get credit pull logs (audit/compliance) |
| `POST` | `/credit/expired/purge` | Bearer | admin | Purge expired reports per FCRA policy |

---

## Rate & Pricing

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `GET` | `/rates/current` | Bearer | Any | Get current rates from database |
| `GET` | `/rates/history` | Bearer | Any | Get rate history for compliance/trending |
| `GET` | `/rates/products` | Bearer | Any | Get product pricing from database |
| `POST` | `/rates/alerts` | Bearer | Any | Create rate alert |
| `GET` | `/rates/alerts` | Bearer | Any | Get user's rate alerts |
| `PUT` | `/rates/alerts/:alertId` | Bearer | Any | Update rate alert |
| `DELETE` | `/rates/alerts/:alertId` | Bearer | Any | Cancel rate alert |
| `POST` | `/rates/alerts/check` | Bearer | admin, LO_RETAIL, LO_TPO | Check all active alerts (scheduler) |
| `POST` | `/rates/locks` | Bearer | admin, LO_TPO, LO_RETAIL, branch_manager, borrower | Submit rate lock request |
| `GET` | `/rates/locks/loan/:loanId` | Bearer | admin, LO_TPO, LO_RETAIL, branch_manager, borrower | Get rate locks for a loan |
| `POST` | `/rates/locks/:lockId/extend` | Bearer | LO_RETAIL, LO_TPO, branch_manager, admin | Extend rate lock period |

---

## Rate Alerts

All rate alert routes require Bearer authentication.

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `POST` | `/rate-alerts` | Bearer | Any | Create rate alert subscription |
| `GET` | `/rate-alerts` | Bearer | Any | Get user's rate alerts |
| `GET` | `/rate-alerts/stats` | Bearer | Any | Get alert statistics |
| `GET` | `/rate-alerts/:id` | Bearer | Any | Get single rate alert |
| `PATCH` | `/rate-alerts/:id` | Bearer | Any | Update rate alert |
| `DELETE` | `/rate-alerts/:id` | Bearer | Any | Delete rate alert |
| `GET` | `/rate-alerts/:id/check-rate` | Bearer | Any | Check current rate for alert |
| `POST` | `/rate-alerts/:id/trigger-check` | Bearer | Any | Manually trigger alert check |
| `POST` | `/rate-alerts/:id/pause` | Bearer | Any | Pause rate alert |
| `POST` | `/rate-alerts/:id/resume` | Bearer | Any | Resume paused rate alert |

---

## Performance Dashboard

| Method | Endpoint | Auth | Roles / Capabilities | Description |
|--------|----------|------|----------------------|-------------|
| `GET` | `/dashboard/reports` | Bearer | capability: `dashboard:view` | Get available dashboard reports |
| `GET` | `/dashboard/reports/:reportId/embed` | Bearer | Any | Get Power BI embed config for report |
| `POST` | `/dashboard/reports/:reportId/refresh` | Bearer | admin, branch_manager | Refresh Power BI dataset |
| `GET` | `/dashboard/metrics` | Bearer | capability: `dashboard:view` | Get dashboard metrics/KPIs |
| `GET` | `/dashboard/my-kpis` | Bearer | Any | Get current user's personal KPI summary |
| `GET` | `/dashboard/branch-performance` | Bearer | branch_manager, admin | Get branch performance summary |
| `GET` | `/dashboard/regional-performance` | Bearer | admin | Get regional performance summary |
| `GET` | `/dashboard/leaderboard` | Bearer | Any | Get top performing LOs leaderboard |

---

## Business Cards

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `POST` | `/business-cards` | Bearer | Any | Create or update business card |
| `GET` | `/business-cards` | Bearer | admin, branch_manager | List all business cards |
| `GET` | `/business-cards/me` | Bearer | Any | Get current user's business card |
| `DELETE` | `/business-cards/me` | Bearer | Any | Delete current user's business card |
| `GET` | `/business-cards/me/analytics` | Bearer | Any | Get analytics for user's card |
| `POST` | `/business-cards/me/regenerate-qr` | Bearer | Any | Regenerate QR code |
| `GET` | `/business-cards/slug/:slug` | None | — | Get business card by slug (public) |
| `POST` | `/business-cards/slug/:slug/apply` | None | — | Track Apply Now click (public) |
| `POST` | `/business-cards/slug/:slug/share` | None | — | Track share action (public) |

---

## Preapproval Letters

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `POST` | `/preapproval/generate` | Bearer | LO_RETAIL, LO_TPO, branch_manager, admin | Generate preapproval letter |
| `GET` | `/preapproval/loan/:loanId` | Bearer | Any | Get all preapproval letters for a loan |
| `GET` | `/preapproval/:id` | Bearer | Any | Get single preapproval letter |
| `GET` | `/preapproval/:id/download` | Bearer | Any | Download preapproval letter PDF |
| `POST` | `/preapproval/:id/share` | Bearer | Any | Share letter via email, SMS, or link |
| `POST` | `/preapproval/:id/regenerate` | Bearer | LO_RETAIL, LO_TPO, branch_manager, admin | Regenerate preapproval letter PDF |
| `DELETE` | `/preapproval/:id` | Bearer | LO_RETAIL, LO_TPO, branch_manager, admin | Delete preapproval letter |

---

## Consent Management

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `POST` | `/consent/request` | Bearer | realtor, broker, LO_RETAIL, LO_TPO | Request consent from borrower |
| `POST` | `/consent/:id/grant` | Bearer | borrower | Grant consent (borrower approves) |
| `POST` | `/consent/:id/revoke` | Bearer | Any | Revoke consent |
| `GET` | `/consent` | Bearer | Any | Get user's consents |
| `GET` | `/consent/:id` | Bearer | Any | Get single consent details |
| `GET` | `/consent/check-access` | Bearer | Any | Check if user has access to borrower data |
| `POST` | `/consent/:id/log-access` | Bearer | Any | Log consent access for audit trail |

---

## Persona Views

All persona view routes require Bearer authentication.

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `GET` | `/persona-views/me` | Bearer | Any | Get user's persona view configuration |
| `PATCH` | `/persona-views/me` | Bearer | Any | Update user's persona view |
| `POST` | `/persona-views/me/reset` | Bearer | Any | Reset persona view to default |
| `GET` | `/persona-views/dashboard` | Bearer | Any | Get dashboard data with persona filtering |

---

## Referral Sources

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `POST` | `/referral-sources` | Bearer | LO_RETAIL, LO_TPO, branch_manager, admin | Create referral source |
| `GET` | `/referral-sources` | Bearer | Any | List referral sources (paginated) |
| `GET` | `/referral-sources/top-performers` | Bearer | branch_manager, admin | Get top performing referral sources |
| `GET` | `/referral-sources/:id` | Bearer | Any | Get referral source by ID |
| `PATCH` | `/referral-sources/:id` | Bearer | LO_RETAIL, LO_TPO, branch_manager, admin | Update referral source |
| `DELETE` | `/referral-sources/:id` | Bearer | admin | Delete referral source |
| `GET` | `/referral-sources/:id/analytics` | Bearer | Any | Get analytics for referral source |
| `GET` | `/referral-sources/:id/branding` | None | — | Get branding configuration (public) |
| `PATCH` | `/referral-sources/:id/branding` | Bearer | LO_RETAIL, LO_TPO, branch_manager, admin | Update referral source branding |
| `POST` | `/referral-sources/:id/track` | Bearer | Any | Track referral source activity |

---

## SMS

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `POST` | `/sms/send` | Bearer | Any | Send SMS message (auto-logged to Encompass) |
| `POST` | `/sms/webhook/receive` | None | — | Twilio inbound message webhook |
| `POST` | `/sms/webhook/status` | None | — | Twilio delivery status webhook |
| `GET` | `/sms/conversation/:phone` | Bearer | Any | Get conversation thread by phone |
| `GET` | `/sms/loan/:loanId` | Bearer | Any | Get SMS messages for a loan |
| `GET` | `/sms/my-messages` | Bearer | Any | Get authenticated user's messages |
| `PATCH` | `/sms/:messageId/read` | Bearer | Any | Mark message as read |
| `GET` | `/sms/stats` | Bearer | LO_RETAIL, LO_TPO, branch_manager, admin | Get SMS usage statistics |
| `POST` | `/sms/sync-to-encompass` | Bearer | admin | Sync unsynced messages to Encompass |

---

## Messages

All message routes require Bearer authentication.

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `GET` | `/messages/my-messages` | Bearer | Any | Get all messages for authenticated user |
| `GET` | `/messages/loan/:loanId` | Bearer | Any | Get all messages for a loan |
| `GET` | `/messages/:id` | Bearer | Any | Get single message by ID |
| `POST` | `/messages` | Bearer | Any | Create a new message |
| `PATCH` | `/messages/:id/read` | Bearer | Any | Mark message as read |
| `DELETE` | `/messages/:id` | Bearer | Any | Delete a message |

---

## Chatbot

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `POST` | `/chatbot/start` | Bearer | Any | Start new chatbot conversation session |
| `POST` | `/chatbot/message` | Bearer | Any | Send message in existing session |
| `GET` | `/chatbot/session/:sessionId` | Bearer | Any | Get conversation history for session |
| `GET` | `/chatbot/sessions` | Bearer | Any | Get user's chat sessions |
| `POST` | `/chatbot/session/:sessionId/escalate` | Bearer | Any | Escalate session to human LO |
| `POST` | `/chatbot/session/:sessionId/close` | Bearer | Any | Close chatbot session |
| `GET` | `/chatbot/stats` | Bearer | admin, branch_manager | Get chatbot usage statistics |
| `GET` | `/chatbot/escalated` | Bearer | admin, branch_manager, LO_RETAIL, LO_TPO | Get escalated sessions |
| `POST` | `/chatbot/session/:sessionId/resolve` | Bearer | admin, LO_RETAIL, LO_TPO | Resolve escalated session |

---

## Menus

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `GET` | `/menus` | Bearer | Any | List all menus |
| `GET` | `/menus/roles` | Bearer | admin | Get menu roles |
| `GET` | `/menus/grouped` | Bearer | Any | Get grouped menus |
| `GET` | `/menus/versions` | Bearer | admin | Get menu versions |
| `GET` | `/menus/:id` | Bearer | Any | Get menu by ID |
| `GET` | `/menus/alias/:alias` | Bearer | Any | Get menu by alias |
| `POST` | `/menus` | Bearer | admin | Create a new menu |
| `PUT` | `/menus/:id` | Bearer | admin | Update a menu |
| `PATCH` | `/menus/:id/visibility` | Bearer | admin | Update menu visibility |
| `DELETE` | `/menus/:id` | Bearer | admin | Delete a menu |
| `POST` | `/menus/restore/:version` | Bearer | admin | Restore menu version |
| `POST` | `/menus/reset` | Bearer | admin | Reset menus |

---

## Menu Config

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `GET` | `/menu-config` | Bearer | Any | Get menu configuration |
| `PUT` | `/menu-config` | Bearer | admin | Update menu configuration |

---

## CMS

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `GET` | `/cms/screens/dashboard` | Bearer | Any | Get dashboard screen data |
| `GET` | `/cms/screens` | Bearer | Any | List all screens |
| `GET` | `/cms/screens/:slug` | Bearer | Any | Get screen by slug |
| `POST` | `/cms/screens` | Bearer | admin | Create a new screen |
| `PATCH` | `/cms/screens/:slug` | Bearer | admin | Update a screen |
| `POST` | `/cms/screens/:slug/publish` | Bearer | admin | Publish a screen |
| `GET` | `/cms/navigation-configs` | Bearer | Any | List all navigation configs |
| `PUT` | `/cms/navigation-configs` | Bearer | admin | Upsert navigation config |
| `GET` | `/cms/feature-flags` | Bearer | Any | List all feature flags |
| `PUT` | `/cms/feature-flags` | Bearer | admin | Upsert feature flag |
| `PATCH` | `/cms/feature-flags/:key` | Bearer | admin | Toggle feature flag |
| `GET` | `/cms/component-registry` | Bearer | Any | List registered components |

---

## Roles

All role routes require Bearer authentication + admin role.

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `GET` | `/roles` | Bearer | admin | List all roles |
| `POST` | `/roles` | Bearer | admin | Create a new role |
| `PUT` | `/roles/:id` | Bearer | admin | Update a role |
| `DELETE` | `/roles/:id` | Bearer | admin | Delete a role |

---

## Capabilities

All capability routes require Bearer authentication + admin role.

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `GET` | `/capabilities` | Bearer | admin | List all capabilities |
| `GET` | `/capabilities/:id` | Bearer | admin | Get single capability |
| `POST` | `/capabilities` | Bearer | admin | Create a capability |
| `PUT` | `/capabilities/:id` | Bearer | admin | Update a capability |
| `DELETE` | `/capabilities/:id` | Bearer | admin | Delete a capability |

---

## Audit Logs

All audit log routes require Bearer authentication + admin role + `audit:view` capability.

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `GET` | `/audit-logs/consent` | Bearer | admin | Get consent audit logs |
| `GET` | `/audit-logs/crm` | Bearer | admin | Get CRM audit logs |
| `GET` | `/audit-logs/credit` | Bearer | admin | Get credit audit logs |

---

## Content Updates (WebSocket)

All content update routes require Bearer authentication + admin role.

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `POST` | `/content-updates/notify` | Bearer | admin | Broadcast content update notification |
| `POST` | `/content-updates/screen-updated` | Bearer | admin | Broadcast screen update |
| `POST` | `/content-updates/menu-updated` | Bearer | admin | Broadcast menu update |
| `GET` | `/content-updates/status` | Bearer | admin | Get WebSocket connection status |

---

## Health

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `GET` | `/health` | None | — | Health check endpoint |

---

## Role Reference

| Slug | Description |
|------|-------------|
| `admin` | System administrator |
| `branch_manager` | Branch manager |
| `loan_officer_retail` (LO_RETAIL) | Retail loan officer |
| `loan_officer_tpo` (LO_TPO) | Third-party originator loan officer |
| `broker` | Mortgage broker |
| `realtor` | Real estate agent |
| `borrower` | Loan applicant / borrower |

---

## Authentication Notes

- **Bearer**: JWT access token in `Authorization: Bearer <token>` header
- **None**: Public endpoint (no authentication required)
- Webhook endpoints use HMAC-SHA256 signature verification instead of JWT
- Rate limiting is applied on auth endpoints (10 req/15min for login/register, 30 req/15min for refresh)
- Swagger docs available at `/api-docs` (non-production only)
