# FAHM Platform — Feature Tier Matrix

> Complete feature-to-tier mapping for the FAHM platform. Use this document to determine which features are available at each subscription tier and how they map to the existing codebase.

---

## How to Read This Matrix

- **Starter** = Entry-level tier ($499/mo)
- **Professional** = Mid-market tier ($1,499/mo)
- **Enterprise** = Custom pricing (starting ~$3,500/mo)
- **Add-on** = Available as a paid add-on to the listed tier
- Checkmark = Included in tier at no extra cost
- Dash = Not available at this tier

---

## 1. Authentication & User Management

| Feature | Starter | Professional | Enterprise | Codebase Reference |
|---------|---------|-------------|------------|-------------------|
| Email/password login | Yes | Yes | Yes | `src/routes/auth.js`, `src/controllers/authController.js` |
| JWT + refresh token rotation | Yes | Yes | Yes | `src/middleware/auth.js`, `src/models/RefreshToken.js` |
| User registration | Yes | Yes | Yes | `POST /auth/register` |
| Profile management | Yes | Yes | Yes | `src/controllers/userController.js` |
| Profile photo upload | Yes | Yes | Yes | `PATCH /users/me/profile-picture` |
| Push notification tokens (Expo) | Yes | Yes | Yes | `POST /users/:id/push-token` |
| User CRUD (admin) | Yes | Yes | Yes | `src/routes/users.js` |
| Azure AD B2C SSO | — | — | Yes | `src/models/User.js` (azureAdB2cId field) |
| Role management (admin) | Yes | Yes | Yes | `src/routes/roles.js` |
| Capability management (admin) | Yes | Yes | Yes | `src/routes/capabilities.js` |

---

## 2. Loan Pipeline & Management

| Feature | Starter | Professional | Enterprise | Codebase Reference |
|---------|---------|-------------|------------|-------------------|
| Loan application CRUD | Yes | Yes | Yes | `src/routes/loans.js`, `src/controllers/loanController.js` |
| Pipeline view (filter, sort, paginate) | Yes | Yes | Yes | `GET /encompass/pipeline` |
| Pipeline canonical fields | Yes | Yes | Yes | `GET /encompass/pipeline/fields` |
| Loan status management | Yes | Yes | Yes | `PATCH /encompass/:id/status` |
| Milestone tracking | Yes | Yes | Yes | `src/models/LoanApplication.js` (milestones array) |
| Loan contacts | Yes | Yes | Yes | `GET /encompass/:id/contacts` |
| Loan messaging (in-app) | Yes | Yes | Yes | `src/routes/messages.js` |
| Source tracking (retail/TPO) | Yes | Yes | Yes | `src/models/LoanApplication.js` (source field) |
| Encompass LOS auto-sync (15 min) | — | Yes | Yes | `src/jobs/encompassSyncJob.js` |
| Encompass link/unlink | — | Yes | Yes | `POST /encompass/:id/link` |
| Encompass sync history | — | Yes | Yes | `GET /encompass/:id/sync-history` |
| Encompass webhook ingestion | — | Yes | Yes | `POST /encompass/webhook` |

---

## 3. Document Management

| Feature | Starter | Professional | Enterprise | Codebase Reference |
|---------|---------|-------------|------------|-------------------|
| Document metadata CRUD | Yes | Yes | Yes | `src/routes/documents.js` |
| Azure Blob pre-signed upload | Yes | Yes | Yes | `POST /document-uploads/presign` |
| Upload confirmation | Yes | Yes | Yes | `POST /document-uploads/confirm` |
| Document download (SAS proxy) | Yes | Yes | Yes | `GET /document-uploads/:id/download` |
| Loan document listing | Yes | Yes | Yes | `GET /document-uploads/loan/:loanId` |
| Document sync to LOS/POS | — | Yes | Yes | `POST /documents/:id/synced` |
| Encompass document upload | — | Yes | Yes | `POST /encompass/:id/documents` |
| Encompass document download | — | Yes | Yes | `GET /encompass/:id/documents/:documentId/download` |
| Storage quota | 10 GB | 50 GB | Unlimited | Tenant config |

---

## 4. Rates & Pricing Engine

| Feature | Starter | Professional | Enterprise | Codebase Reference |
|---------|---------|-------------|------------|-------------------|
| Current rate snapshots (local) | Yes | Yes | Yes | `GET /rates/current` |
| Rate history | Yes | Yes | Yes | `GET /rates/history` |
| Optimal Blue daily sync | — | Yes | Yes | `src/jobs/rateSyncJob.js` |
| Product pricing (investor-level) | — | Yes | Yes | `GET /rates/products` |
| Rate lock submission | — | Yes | Yes | `POST /rates/locks` |
| Rate lock extension | — | Yes | Yes | `POST /rates/locks/:lockId/extend` |
| Rate alerts (push/SMS/email) | — | Yes | Yes | `src/routes/rateAlerts.js` |
| Alert scheduler (auto-check) | — | Yes | Yes | `src/schedulers/rateAlertScheduler.js` |

---

## 5. Mortgage Calculators

| Feature | Starter | Professional | Enterprise | Codebase Reference |
|---------|---------|-------------|------------|-------------------|
| Monthly payment (P&I) | Yes | Yes | Yes | `src/controllers/calculatorController.js` |
| APR calculation | Yes | Yes | Yes | Newton-Raphson solver |
| Amortization schedule | Yes | Yes | Yes | Full schedule generation |
| Affordability calculator | Yes | Yes | Yes | Max loan from income/DTI |
| Refinance break-even analysis | Yes | Yes | Yes | Break-even months calculation |
| Saved calculations | Yes | Yes | Yes | Per-user saved calculations |
| Optimal Blue live rate scenarios | — | Yes | Yes | Integration with OB rate engine |

---

## 6. Credit Bureau Integration

| Feature | Starter | Professional | Enterprise | Codebase Reference |
|---------|---------|-------------|------------|-------------------|
| Credit report request (Xactus) | — | Yes (50/mo) | Yes (unlimited) | `POST /credit/:loanId/request` |
| Credit report retrieval | — | Yes | Yes | `GET /credit/:loanId` |
| Consent tracking (FCRA) | — | Yes | Yes | `src/models/CreditPullLog.js` |
| FCRA retention automation | — | Yes | Yes | `src/jobs/fcraRetentionJob.js` |
| Additional credit pulls | — | $3.50/pull | Included | Usage metering |

---

## 7. CRM Integration (Total Expert)

| Feature | Starter | Professional | Enterprise | Codebase Reference |
|---------|---------|-------------|------------|-------------------|
| CRM contact sync | — | Yes | Yes | `src/routes/crm.js` |
| Contact CRUD | — | Yes | Yes | `src/models/CRMContact.js` |
| Journey tracking | — | Yes | Yes | `src/models/CRMJourney.js` |
| Activity logging | — | Yes | Yes | `src/models/CRMActivityLog.js` |
| Sync audit trail | — | Yes | Yes | `src/models/CRMSyncLog.js` |
| Bidirectional sync job | — | Yes | Yes | `src/jobs/crmSyncJob.js` |

---

## 8. Point of Sale (POS) Handoff

| Feature | Starter | Professional | Enterprise | Codebase Reference |
|---------|---------|-------------|------------|-------------------|
| POS session link generation | — | — | Yes | `src/routes/posLink.js` |
| Blend POS handoff | — | Add-on ($299/mo) | Yes | `src/services/blendService.js` |
| BigPOS handoff | — | Add-on ($199/mo) | Yes | `src/services/bigPosService.js` |
| Encompass Consumer Connect | — | — | Yes | `src/controllers/posLinkController.js` |
| JWT deep-link token | — | — | Yes | `POST /pos/handoff` |
| Co-branded POS sessions | — | — | Yes | `src/models/POSSession.js` |
| Rate limiting on token minting | — | — | Yes | `mintWindow` Map in controller |

---

## 9. Pre-Approval Letters

| Feature | Starter | Professional | Enterprise | Codebase Reference |
|---------|---------|-------------|------------|-------------------|
| PDF letter generation | — | Yes | Yes | `src/controllers/preapprovalController.js` |
| Co-branded letters | — | Yes | Yes | PDFKit with branding |
| Share via SMS (Twilio) | — | Yes | Yes | `POST /preapproval/:id/share-sms` |
| Share via email | — | Yes | Yes | `POST /preapproval/:id/share-email` |
| Letter revocation | — | Yes | Yes | `POST /preapproval/:id/revoke` |
| Loan letter history | — | Yes | Yes | `GET /preapproval/loan/:loanId` |

---

## 10. Communication

| Feature | Starter | Professional | Enterprise | Codebase Reference |
|---------|---------|-------------|------------|-------------------|
| In-app messaging | Yes | Yes | Yes | `src/routes/messages.js` |
| Push notifications (Expo) | Yes | Yes | Yes | `src/routes/notifications.js` |
| SMS messaging (Twilio) | — | Yes (500/mo) | Yes (unlimited) | `src/routes/sms.js` |
| SMS milestone updates | — | Yes | Yes | `POST /sms/send-milestone-update` |
| Twilio inbound webhook | — | Yes | Yes | `POST /sms/webhook` |
| Email notifications | — | Yes | Yes | Nodemailer SMTP |
| Additional SMS | — | $0.05/msg | Included | Usage metering |

---

## 11. AI Chatbot

| Feature | Starter | Professional | Enterprise | Codebase Reference |
|---------|---------|-------------|------------|-------------------|
| Azure OpenAI chatbot | — | Yes (5K msg/mo) | Yes (unlimited) | `src/routes/chatbot.js` |
| Session management | — | Yes | Yes | `src/models/ChatbotSession.js` |
| Function calling (structured) | — | Yes | Yes | `src/services/chatbotFunctionService.js` |
| Knowledge base | — | Yes | Yes | `src/services/chatbotKnowledgeService.js` |
| Voice-enabled mode | — | Yes | Yes | Voice mode support |
| Conversation history | — | Yes | Yes | `GET /chatbot/sessions/:id/history` |
| Additional messages | — | $8/1K msgs | Included | Usage metering |

---

## 12. Dynamic Menu & Screen Management (CMS)

| Feature | Starter | Professional | Enterprise | Codebase Reference |
|---------|---------|-------------|------------|-------------------|
| Role-based menu rendering | Yes | Yes | Yes | `src/routes/menus.js` |
| View menus (grouped by type) | Yes | Yes | Yes | `GET /menus/grouped` |
| Menu by alias lookup | Yes | Yes | Yes | `GET /menus/alias/:alias` |
| Admin menu CRUD | — | Yes | Yes | `POST/PUT/DELETE /menus` |
| Menu visibility toggle | — | Yes | Yes | `PATCH /menus/:id/visibility` |
| Menu version history | — | Yes | Yes | `GET /menus/versions` |
| Menu version restore | — | Yes | Yes | `POST /menus/restore/:version` |
| Menu reset to defaults | — | Yes | Yes | `POST /menus/reset` |
| CMS screen listing | Yes | Yes | Yes | `GET /cms/screens` |
| CMS screen by slug | Yes | Yes | Yes | `GET /cms/screens/:slug` |
| Admin screen CRUD | — | Yes | Yes | `POST/PATCH /cms/screens` |
| Screen publish workflow | — | Yes | Yes | `POST /cms/screens/:slug/publish` |
| Navigation config by role | Yes | Yes | Yes | `GET /cms/navigation-configs` |
| Admin navigation config | — | Yes | Yes | `PUT /cms/navigation-configs` |
| Component registry | Yes | Yes | Yes | `GET /cms/component-registry` |
| Menu config JSON blob | Yes | Yes | Yes | `src/routes/menuConfig.js` |

---

## 13. Feature Flags

| Feature | Starter | Professional | Enterprise | Codebase Reference |
|---------|---------|-------------|------------|-------------------|
| Feature flag listing | Yes | Yes | Yes | `GET /cms/feature-flags` |
| Feature flag toggle (admin) | — | Yes | Yes | `PATCH /cms/feature-flags/:key` |
| Feature flag upsert (admin) | — | Yes | Yes | `PUT /cms/feature-flags` |
| Role-based flag targeting | — | Yes | Yes | `roles` array in FeatureFlag model |
| Min app version gating | — | Yes | Yes | `min_app_version` field |

---

## 14. WebSocket Real-Time Updates

| Feature | Starter | Professional | Enterprise | Codebase Reference |
|---------|---------|-------------|------------|-------------------|
| WebSocket connection (`/ws/content`) | Yes | Yes | Yes | `src/socket/ContentUpdateBroadcaster.js` |
| JWT authentication on connect | Yes | Yes | Yes | Token verification on upgrade |
| `menu_updated` events | Yes | Yes | Yes | `broadcastOnMenuSave` middleware |
| `screen_updated` events | Yes | Yes | Yes | `broadcastOnScreenSave` middleware |
| `content_updated` events | Yes | Yes | Yes | Generic broadcast |
| Role-targeted broadcasts | — | Yes | Yes | `broadcastToRoles()` method |
| Custom content update triggers | — | Yes | Yes | `POST /content-updates/notify` |
| Connection status monitoring | — | Yes | Yes | `GET /content-updates/status` |
| 30-second heartbeat/ping-pong | Yes | Yes | Yes | Built-in health check |

---

## 15. Analytics & Dashboards

| Feature | Starter | Professional | Enterprise | Codebase Reference |
|---------|---------|-------------|------------|-------------------|
| Basic dashboard metrics | Yes | Yes | Yes | `GET /dashboard/metrics` |
| Persona-based dashboard | Yes | Yes | Yes | `src/routes/personaViews.js` |
| Power BI embedded reports | — | Add-on ($399/mo) | Yes | `src/routes/dashboard.js` |
| Branch performance analytics | — | — | Yes | `GET /dashboard/branch-performance` |
| Referral source analytics | — | — | Yes | `src/models/ReferralSourceAnalytics.js` |
| Menu analytics (views, unique users) | — | Yes | Yes | `analytics` field in Menu model |

---

## 16. Compliance & Security

| Feature | Starter | Professional | Enterprise | Codebase Reference |
|---------|---------|-------------|------------|-------------------|
| JWT authentication | Yes | Yes | Yes | `src/middleware/auth.js` |
| RBAC (7 roles, 16 capabilities) | Yes | Yes | Yes | `src/config/roles.js` |
| Helmet security headers | Yes | Yes | Yes | `src/app.js` |
| CORS protection | Yes | Yes | Yes | Configurable origins |
| SSRF protection | Yes | Yes | Yes | `src/utils/ssrf.js` |
| Request UUID tracing | Yes | Yes | Yes | `x-request-id` middleware |
| Audit logging | — | Yes | Yes | `src/routes/auditLogs.js` |
| Audit log query (admin) | — | Yes | Yes | `GET /audit-logs` |
| Consent management | — | Yes | Yes | `src/routes/consent.js` |
| FCRA retention automation | — | Yes | Yes | `src/jobs/fcraRetentionJob.js` |
| Twilio webhook signature verification | — | Yes | Yes | Twilio HMAC validation |
| Inactive user blocking | Yes | Yes | Yes | Auth middleware check |

---

## 17. Co-Branding & Referral Partners

| Feature | Starter | Professional | Enterprise | Codebase Reference |
|---------|---------|-------------|------------|-------------------|
| Referral source CRUD | — | Yes | Yes | `src/routes/referralSources.js` |
| Co-branding config (colors, logos) | — | Add-on ($99/partner) | Yes | `src/models/ReferralSource.js` |
| Custom domain support | — | Add-on ($49/domain) | Yes | `customDomain` field |
| Feature-level co-branding toggle | — | Add-on | Yes | `isCoBrandingEnabled(feature)` |
| Partner analytics | — | — | Yes | `src/models/ReferralSourceAnalytics.js` |

---

## 18. Business Cards

| Feature | Starter | Professional | Enterprise | Codebase Reference |
|---------|---------|-------------|------------|-------------------|
| Digital business card | Yes | Yes | Yes | `src/routes/businessCards.js` |
| NMLS, photo, bio, branch info | Yes | Yes | Yes | `src/models/BusinessCard.js` |
| QR code generation | Yes | Yes | Yes | `qrcode` library |
| Social links | Yes | Yes | Yes | `socialLinks` field |
| Custom domain support | — | Add-on ($49/domain) | Yes | `customDomain` field |
| Public/private visibility | Yes | Yes | Yes | `isPublic` toggle |
| Search by name/email | Yes | Yes | Yes | `GET /business-cards` |

---

## 19. Background Jobs & Schedulers

| Feature | Starter | Professional | Enterprise | Codebase Reference |
|---------|---------|-------------|------------|-------------------|
| Rate alert scheduler | — | Yes | Yes | `src/schedulers/rateAlertScheduler.js` |
| Encompass auto-sync (15 min) | — | Yes | Yes | `src/jobs/encompassSyncJob.js` |
| CRM sync job | — | Yes | Yes | `src/jobs/crmSyncJob.js` |
| FCRA retention job | — | Yes | Yes | `src/jobs/fcraRetentionJob.js` |
| Daily rate sync (Optimal Blue) | — | Yes | Yes | `src/jobs/rateSyncJob.js` |
| Metrics aggregation | — | — | Yes | `src/jobs/metricsAggregationJob.js` |

---

## Tier Gating Implementation

The FAHM codebase already has the infrastructure to support tier-gating:

### Existing Infrastructure

| Component | How It Supports Tier Gating |
|-----------|----------------------------|
| **FeatureFlag model** | `key`, `enabled`, `roles[]`, `min_app_version` — toggle features per role |
| **Role + Capability system** | 7 roles with 16 capabilities — assign capabilities per tier |
| **Dynamic menus** | `roles[]` field on each menu — show/hide menu items by role |
| **CMS screens** | `roles[]` field — restrict screen access by role |
| **WebSocket `broadcastToRoles()`** | Send updates only to specific role groups |

### What Needs to Be Built

| Component | Purpose |
|-----------|---------|
| **Tenant model** | Multi-tenancy: `subscriptionTier`, `seatLimits`, `enabledIntegrations`, `billingInfo` |
| **`requireTier()` middleware** | Route-level tier gating (checks tenant subscription before allowing access) |
| **Usage metering middleware** | Track per-tenant usage of credit pulls, SMS, AI chatbot, storage |
| **Stripe integration** | Subscription billing, seat management, usage-based invoicing |
| **Tenant admin dashboard** | Self-service billing portal, usage monitoring, seat management |

See [IMPLEMENTATION_GUIDE_SUBSCRIPTIONS.md](./IMPLEMENTATION_GUIDE_SUBSCRIPTIONS.md) for technical implementation details.

---

## Related Documents

- [BUSINESS_MODEL.md](./BUSINESS_MODEL.md) — Pricing tiers and revenue model
- [SALES_PLAYBOOK.md](./SALES_PLAYBOOK.md) — Go-to-market strategy and sales process
- [IMPLEMENTATION_GUIDE_SUBSCRIPTIONS.md](./IMPLEMENTATION_GUIDE_SUBSCRIPTIONS.md) — Technical guide for building the subscription system
- [PLATFORM_CAPABILITIES_OVERVIEW.md](./PLATFORM_CAPABILITIES_OVERVIEW.md) — Client-facing platform summary
