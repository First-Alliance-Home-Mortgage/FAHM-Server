# FAHM Platform — Capabilities Overview

> Client-facing and investor-ready overview of the FAHM mortgage lending platform. Use this document for sales presentations, investor decks, and partnership discussions.

---

## What is FAHM?

FAHM is a **mobile-first mortgage lending platform** that gives lenders, brokers, and loan officers a fully customizable mobile experience for their borrowers — managed entirely from a web-based admin dashboard. Every screen, menu, and feature on the mobile app can be updated in real-time without app store deployments.

---

## Platform at a Glance

| Attribute | Detail |
|-----------|--------|
| **Platform type** | B2B SaaS — mortgage lending technology |
| **Delivery** | Cloud-hosted (Azure), mobile app (iOS/Android), web admin dashboard |
| **Target market** | US mortgage lenders, brokerages, wholesale lenders (TPO) |
| **User roles** | Borrower, Loan Officer (Retail), Loan Officer (TPO), Broker, Realtor, Branch Manager, Admin |
| **Core technology** | Node.js, MongoDB, WebSocket, Azure OpenAI, Azure Blob Storage |
| **Key integrations** | Encompass (LOS), Optimal Blue (rates), Total Expert (CRM), Xactus (credit), Blend/BigPOS (POS), Power BI (analytics), Twilio (SMS) |

---

## Core Capabilities

### 1. Real-Time Mobile Screen Management

The platform's defining capability. Administrators manage the entire mobile app experience from a web dashboard:

- **Dynamic Menus** — Add, remove, reorder, and configure tab navigation, drawer menus, and stack screens per user role. Changes appear on mobile devices within seconds via WebSocket.
- **CMS Screen Builder** — Create and publish screens with configurable component layouts. Each screen can target specific roles and is versioned with rollback support.
- **Feature Flags** — Toggle features on/off per role or minimum app version, enabling A/B testing and staged rollouts without code changes.
- **Zero App Store Dependency** — No app store review or update required. Admin changes propagate instantly via WebSocket connection.

**Technical foundation:** WebSocket server at `/ws/content` with JWT authentication, 30-second heartbeat monitoring, role-targeted broadcasts, and graceful shutdown handling.

---

### 2. Full Mortgage Lifecycle Management

FAHM covers every stage from application to funding:

| Stage | Capabilities |
|-------|-------------|
| **Application** | Borrower self-service application, document upload (camera capture to cloud), AI chatbot for guidance |
| **Processing** | Encompass LOS auto-sync (every 15 minutes), loan contact management, milestone tracking |
| **Underwriting** | Credit report requests (Xactus tri-merge), document management, consent tracking |
| **Rate Lock** | Optimal Blue rate engine, lock submission, extension management, rate alerts |
| **Pre-Approval** | PDF letter generation with co-branding, share via SMS/email, revocation |
| **Closing** | Real-time milestone notifications, borrower status updates, team communication |
| **Funded** | Completed loan archival, CRM sync, analytics |

---

### 3. Multi-Role Ecosystem

Seven distinct user roles, each with a tailored mobile experience:

| Role | Key Experience |
|------|---------------|
| **Borrower** | Loan status tracker, document upload, AI chatbot, rate calculators, milestone notifications |
| **Loan Officer (Retail)** | Full pipeline management, rate locks, document review, borrower messaging, pre-approval letters |
| **Loan Officer (TPO)** | Same as retail LO, optimized for third-party origination channel |
| **Broker** | Pipeline view, rate alerts, document upload, referral partner portal |
| **Realtor** | Shared loan view, messaging with LO, rate information, referral tracking |
| **Branch Manager** | Team pipeline dashboard, branch performance analytics, user management |
| **Admin** | Full CMS control, menu management, feature flags, user/role management, audit logs |

Each role has granular capability-based access control (16 capabilities) stored in MongoDB with full CRUD management.

---

### 4. Intelligent Borrower Engagement

| Feature | Description |
|---------|-------------|
| **AI Chatbot** | Azure OpenAI GPT-4 powered chatbot with mortgage knowledge base, function calling for structured data retrieval, session management, and voice mode support |
| **Real-Time Notifications** | Push notifications (Expo), in-app notifications, SMS (Twilio), and email for milestone updates, rate alerts, and messages |
| **Rate Alerts** | Configurable alerts — trigger when rates drop below a target, rise above a threshold, or drop by a fixed amount. Delivered via push, SMS, email, or all channels |
| **Mortgage Calculators** | Monthly payment (P&I), APR (Newton-Raphson solver), full amortization schedule, affordability calculator, refinance break-even analysis, saved calculations |
| **Pre-Approval Letters** | Server-generated PDF letters with borrower/loan/officer data, co-branded with referral partner branding, shareable via SMS and email |

---

### 5. Deep Industry Integrations

| Integration | Type | What It Does |
|-------------|------|-------------|
| **Encompass (ICE Mortgage Technology)** | Loan Origination System | Bi-directional loan sync every 15 minutes — milestones, contacts, documents, status. Webhook support for real-time events. Pipeline query with filtering and sorting. |
| **Optimal Blue (Black Knight)** | Rate & Pricing Engine | Daily automated sync of rate sheets across 10 scenarios (conventional, FHA, VA, USDA, jumbo — 15/20/30yr). Product-level pricing with investor details, LTV/credit-score adjustment matrices. |
| **Total Expert** | CRM | Bi-directional contact sync, marketing journey tracking, activity logging. Keeps CRM in sync with loan pipeline automatically. |
| **Xactus** | Credit Bureau | Tri-merge credit report requests with borrower consent tracking. Full FCRA compliance with automated data retention policies. |
| **Blend** | Point of Sale | Secure POS handoff with JWT deep-link tokens, session management, co-branded application flow. |
| **BigPOS** | Point of Sale | Alternative POS integration with OAuth-based session management. |
| **Microsoft Power BI** | Analytics | Embedded report dashboards with user-scoped tokens. Role-filtered analytics — branch managers see branch data, LOs see their pipeline. |
| **Twilio** | SMS/Voice | Outbound SMS messaging, inbound webhook with signature verification, milestone update notifications, conversation threading. |
| **Azure Blob Storage** | Document Storage | Pre-signed SAS URL uploads for direct-to-cloud document storage. Proxy downloads with time-limited access tokens. |
| **Azure OpenAI** | AI/ML | GPT-4 chatbot with function calling, knowledge base integration, session persistence. |

---

### 6. Co-Branding & Referral Partner Network

| Feature | Description |
|---------|-------------|
| **Referral Source Management** | Full CRUD for referral partners (realtors, builders, financial planners, CPAs, attorneys) |
| **Co-Branding Engine** | Per-partner branding configuration — primary/secondary colors, logos, custom domains |
| **Feature-Level Toggle** | Enable/disable co-branding per feature (pre-approval letters, business cards, POS sessions) |
| **Partner Analytics** | Track leads, conversions, and revenue per referral source |
| **Digital Business Cards** | Loan officer business cards with NMLS, photo, bio, branch info, social links, QR code generation, custom domain support |

---

### 7. Compliance & Security

| Capability | Implementation |
|-----------|---------------|
| **Authentication** | JWT with refresh token rotation, device metadata tracking (IP, user-agent) |
| **Authorization** | 7 roles with 16 granular capabilities, all database-stored and admin-configurable |
| **FCRA Compliance** | Automated credit report data retention policy, borrower consent tracking per credit pull |
| **Borrower Consent Management** | Granular consent tracking — personal info, financial info, loan details, documents, milestones — per data-sharing recipient role |
| **Audit Logging** | Every sensitive action logged with user ID, IP, user-agent, and metadata. Queryable audit log for compliance reviews. |
| **Security Headers** | Helmet HTTP headers, CORS with configurable origins |
| **SSRF Protection** | URL validation on all external requests |
| **Webhook Verification** | Twilio HMAC signature validation, Encompass webhook secret verification |
| **Request Tracing** | UUID-based request ID (`x-request-id`) on every request for distributed tracing |
| **Rate Limiting** | In-memory rate limiting on sensitive endpoints (POS token minting) |

---

## Technical Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FAHM Platform                                │
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │  Mobile App   │    │  Web Admin    │    │  External Systems    │  │
│  │  (iOS/Android)│    │  Dashboard    │    │                      │  │
│  └──────┬───────┘    └──────┬───────┘    │  Encompass LOS       │  │
│         │                   │             │  Optimal Blue         │  │
│         │ WebSocket         │ REST API    │  Total Expert CRM     │  │
│         │ (/ws/content)     │ (/api/v1)   │  Xactus Credit        │  │
│         │                   │             │  Blend / BigPOS       │  │
│         ▼                   ▼             │  Power BI             │  │
│  ┌─────────────────────────────────────┐ │  Twilio               │  │
│  │         FAHM-Server (Node.js)       │ │  Azure OpenAI         │  │
│  │                                     │ │  Azure Blob           │  │
│  │  ┌─────────┐  ┌──────────────────┐  │ └──────────┬───────────┘  │
│  │  │  Auth    │  │  Content Update  │  │            │              │
│  │  │  (JWT)   │  │  Broadcaster     │  │◄───────────┘              │
│  │  └─────────┘  │  (WebSocket)      │  │                          │
│  │               └──────────────────┘  │                          │
│  │  ┌─────────┐  ┌──────────────────┐  │                          │
│  │  │  RBAC   │  │  Dynamic CMS     │  │                          │
│  │  │  7 roles│  │  Menus/Screens   │  │                          │
│  │  │  16 caps│  │  Feature Flags   │  │                          │
│  │  └─────────┘  └──────────────────┘  │                          │
│  │  ┌─────────┐  ┌──────────────────┐  │                          │
│  │  │  Cron   │  │  31 Route Files  │  │                          │
│  │  │  Jobs   │  │  34 Controllers  │  │                          │
│  │  │  (sync) │  │  40+ Models      │  │                          │
│  │  └─────────┘  └──────────────────┘  │                          │
│  └──────────────────┬──────────────────┘                          │
│                     │                                              │
│                     ▼                                              │
│            ┌─────────────────┐                                     │
│            │    MongoDB       │                                     │
│            │  (All Data)      │                                     │
│            └─────────────────┘                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Key Metrics & Scale

| Metric | Detail |
|--------|--------|
| **API endpoints** | 100+ REST endpoints across 31 route files |
| **Data models** | 40+ Mongoose models |
| **User roles** | 7 configurable roles |
| **Capabilities** | 16 granular permissions |
| **Menu items** | 57 seeded dynamic menu/screen items |
| **Integrations** | 10 external service integrations |
| **Background jobs** | 6 automated sync/maintenance jobs |
| **WebSocket events** | 3 broadcast types with role-targeted delivery |
| **Calculator engines** | 5 mortgage calculation types |
| **Loan products** | 10 rate scenarios (conventional, FHA, VA, USDA, jumbo) |

---

## Why FAHM?

### For Lenders
- **Compete on technology** — Give borrowers a modern mobile experience that rivals the biggest lenders
- **Reduce manual work** — Automated Encompass sync, milestone notifications, and document management eliminate repetitive tasks
- **Control without code** — Manage every screen and feature from a web dashboard, no developers needed
- **Engage borrowers** — AI chatbot, rate alerts, and real-time updates keep borrowers informed and reduce status-check calls

### For Brokers & Realtors
- **Stay in the loop** — Real-time loan status visibility and direct messaging with loan officers
- **Co-branded experience** — Professional presence with customized branding on pre-approval letters and business cards
- **Rate intelligence** — Automated rate monitoring with configurable alerts

### For Borrowers
- **Transparency** — Real-time loan status with milestone notifications, no more wondering "where is my loan?"
- **Self-service** — Upload documents from phone camera, use calculators to understand payments, chat with AI for instant answers
- **Communication** — Direct messaging with loan team, SMS updates, push notifications

---

## Subscription Plans

| Plan | Starting Price | Best For |
|------|---------------|----------|
| **Starter** | $499/month | Small brokerages (1-5 LOs) wanting a branded mobile borrower portal |
| **Professional** | $1,499/month | Mid-size lenders (6-25 LOs) needing Encompass integration, rate engine, and borrower engagement tools |
| **Enterprise** | Custom | Large lenders and multi-branch operations needing white-label, advanced analytics, and custom integrations |

All plans include unlimited borrower accounts and a free pilot program.

See [BUSINESS_MODEL.md](./BUSINESS_MODEL.md) for full pricing details.

---

## Related Documents

| Document | Description |
|----------|-------------|
| [BUSINESS_MODEL.md](./BUSINESS_MODEL.md) | Pricing tiers, revenue streams, unit economics |
| [SALES_PLAYBOOK.md](./SALES_PLAYBOOK.md) | Go-to-market strategy, sales process, objection handling |
| [FEATURE_TIER_MATRIX.md](./FEATURE_TIER_MATRIX.md) | Complete feature-to-tier mapping with codebase references |
| [IMPLEMENTATION_GUIDE_SUBSCRIPTIONS.md](./IMPLEMENTATION_GUIDE_SUBSCRIPTIONS.md) | Technical guide for building the subscription system |
| [API_REFERENCE.md](./API_REFERENCE.md) | Full REST API documentation |
| [WEBSOCKET_CONTENT_UPDATE_GUIDE.md](./WEBSOCKET_CONTENT_UPDATE_GUIDE.md) | WebSocket integration guide |
| [FRONTEND_ROLES_CAPABILITIES.md](./FRONTEND_ROLES_CAPABILITIES.md) | Role and capability system documentation |
