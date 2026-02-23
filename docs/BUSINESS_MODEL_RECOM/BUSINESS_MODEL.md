# FAHM Platform — Business Model & Pricing Strategy

> Comprehensive business model documentation for the FAHM mortgage lending platform.
> This document defines the recommended monetization strategy, pricing tiers, revenue streams, and competitive positioning.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Recommended Business Model](#recommended-business-model)
3. [Pricing Tiers](#pricing-tiers)
4. [Per-Seat Pricing](#per-seat-pricing)
5. [Revenue Streams](#revenue-streams)
6. [Pricing Justification](#pricing-justification)
7. [Competitive Positioning](#competitive-positioning)
8. [Unit Economics](#unit-economics)
9. [Discount & Incentive Policies](#discount--incentive-policies)
10. [Pricing FAQ](#pricing-faq)

---

## Executive Summary

FAHM is a **B2B SaaS mortgage lending platform** that enables lenders, brokers, and loan officers to manage the entire mortgage lifecycle — from borrower application to funding — through a mobile-first experience with real-time WebSocket updates, dynamic screen management, and deep integrations with industry-standard systems (Encompass, Optimal Blue, Xactus, Total Expert, Blend).

**Recommended model:** Tiered subscription + per-seat pricing, with integration add-ons and usage-based metering for high-volume features.

**Target customers:** Mortgage lenders, wholesale lenders (TPO), mortgage brokerages, and independent loan officers operating in the United States.

---

## Recommended Business Model

### Model: B2B SaaS — Tiered Subscription + Per-Seat Hybrid

This model is recommended because:

1. **Predictable recurring revenue** — Monthly/annual subscriptions provide revenue stability
2. **Natural expansion** — Per-seat pricing grows with the customer's team
3. **Low friction entry** — Starter tier is affordable for small brokerages
4. **Enterprise scalability** — Custom tier captures large multi-branch lenders
5. **Built-in infrastructure** — FAHM's existing Feature Flags, RBAC (7 roles, 16 capabilities), and dynamic CMS already support tier-gating

### Billing Cadence

| Option | Pricing | Notes |
|--------|---------|-------|
| Monthly | List price | No commitment, cancel anytime |
| Annual | 15% discount | Paid upfront, improves cash flow |
| Multi-year (Enterprise) | 20-25% discount | 2-3 year commitment, custom negotiation |

---

## Pricing Tiers

### Starter — $499/month

**Target:** Small brokerages and independent loan officers (1-5 LOs)

| Feature | Included |
|---------|----------|
| User seats | 5 included (Loan Officers) |
| Borrower accounts | Unlimited |
| Loan pipeline management | Yes |
| Document upload (Azure Blob) | 10 GB storage |
| Borrower mobile portal | Yes |
| In-app messaging | Yes |
| Mortgage calculators | Yes (P&I, amortization, affordability) |
| Notifications (push + in-app) | Yes |
| Dynamic menus & screens | Yes (read-only, FAHM-managed templates) |
| API access | No |
| Integrations | None (manual data entry) |
| Support | Email support (48hr SLA) |

**Ideal for:** Small shops that want a branded mobile borrower experience without complex integrations.

---

### Professional — $1,499/month

**Target:** Mid-size lenders and brokerages (6-25 LOs)

| Feature | Included |
|---------|----------|
| User seats | 25 included (mixed roles) |
| Borrower accounts | Unlimited |
| Everything in Starter | Yes |
| Encompass LOS sync | Yes (auto-sync every 15 min) |
| Optimal Blue rate engine | Yes (daily rate sync, 10 product scenarios) |
| Rate lock management | Yes |
| Rate alerts (push, SMS, email) | Yes |
| Credit report requests (Xactus) | Yes (50 pulls/month included) |
| Total Expert CRM sync | Yes |
| AI chatbot (Azure OpenAI) | Yes (5,000 messages/month) |
| SMS messaging (Twilio) | 500 messages/month included |
| Pre-approval letter generation | Yes (PDF with co-branding) |
| Business cards & QR codes | Yes |
| Custom CMS screen management | Yes (admin panel) |
| WebSocket real-time updates | Yes |
| Feature flags management | Yes |
| Consent management | Yes |
| Audit logging | Yes |
| API access | Read-only |
| Support | Email + chat (24hr SLA) |

**Ideal for:** Growing lenders who need Encompass integration, automated rate monitoring, and borrower engagement tools.

---

### Enterprise — Custom Pricing (starting ~$3,500/month)

**Target:** Large lenders, multi-branch operations, wholesale lenders (25+ LOs)

| Feature | Included |
|---------|----------|
| User seats | Unlimited |
| Borrower accounts | Unlimited |
| Everything in Professional | Yes |
| Power BI embedded dashboards | Yes |
| Branch performance analytics | Yes |
| POS handoff (Blend, BigPOS) | Yes |
| White-label / co-branding | Yes (custom domains, colors, logos) |
| Referral source management | Yes (with analytics) |
| Persona-based views | Yes (per-role dashboard customization) |
| Multi-branch management | Yes |
| FCRA retention compliance | Yes (automated) |
| Unlimited credit pulls | Yes |
| Unlimited AI chatbot | Yes |
| Unlimited SMS | Yes |
| Full API access | Read + Write |
| Custom integrations | Available |
| Dedicated account manager | Yes |
| Support | Phone + email + chat (4hr SLA) |
| Uptime SLA | 99.9% |
| SOC 2 compliance report | Available |
| Custom onboarding | Included |

**Ideal for:** Multi-branch lenders, wholesale/TPO channels, and enterprises needing white-label deployment with advanced analytics.

---

## Per-Seat Pricing

Seats beyond the tier's included allocation are billed per-seat:

| Role | Per Seat/Month | Notes |
|------|---------------|-------|
| Loan Officer (Retail) | $49 | Full pipeline, rate locks, document management |
| Loan Officer (TPO) | $49 | Same capabilities as retail LO |
| Branch Manager | $79 | Dashboard access, team management, performance reports |
| Broker (external) | $19 | Pipeline view, rate alerts, document upload |
| Realtor (external) | $19 | Shared loan view, messaging, rate access |
| Borrower | Free | Always free — borrower adoption drives platform value |
| Admin | Included | 1 admin per tier, additional at $99/seat |

### Seat Counting Rules

- **Active seats only** — Deactivated users (`isActive: false`) do not count toward seat limits
- **Monthly true-up** — Seats added mid-cycle are prorated; removed seats credited on next invoice
- **Borrower exclusion** — Borrower accounts are always free and unlimited

---

## Revenue Streams

### Primary Revenue (Recurring)

| Stream | Model | Expected % of Revenue |
|--------|-------|-----------------------|
| Subscription fees | Monthly/annual per tier | 55-65% |
| Per-seat fees | Per active user above tier limit | 20-25% |

### Secondary Revenue (Usage & Add-ons)

| Stream | Model | Price |
|--------|-------|-------|
| Credit pulls (Xactus) | Per pull above tier quota | $3.50/pull |
| SMS messages (Twilio) | Per message above tier quota | $0.05/message |
| AI chatbot tokens | Per 1,000 messages above tier quota | $8/1,000 messages |
| Document storage | Per GB above tier quota | $0.50/GB/month |

### Add-on Integrations (Professional/Enterprise)

| Integration | Monthly Add-on | Notes |
|-------------|---------------|-------|
| Encompass LOS | Included in Professional+ | Core integration |
| Optimal Blue | Included in Professional+ | Rate engine |
| Total Expert CRM | Included in Professional+ | CRM sync |
| Xactus Credit | Included in Professional+ | Credit reports |
| Blend POS | $299/month | Enterprise or add-on |
| BigPOS | $199/month | Enterprise or add-on |
| Power BI Dashboards | $399/month | Enterprise or add-on |
| Custom POS Handoff | Custom | Enterprise only |

### Premium Feature Add-ons

| Feature | Monthly Price | Available From |
|---------|--------------|----------------|
| Co-branding per referral partner | $99/partner/month | Professional+ |
| Custom domain for business cards | $49/domain/month | Professional+ |
| White-label deployment | $999/month | Enterprise only |
| Advanced audit & compliance pack | $199/month | Professional+ |
| API write access | $299/month | Professional+ |

---

## Pricing Justification

### Cost to Serve (Estimated per Customer/Month)

| Cost Category | Starter | Professional | Enterprise |
|---------------|---------|-------------|------------|
| Infrastructure (Azure/AWS) | $50 | $150 | $400 |
| Encompass API fees | $0 | $75 | $200 |
| Optimal Blue fees | $0 | $50 | $100 |
| Xactus fees (50 pulls) | $0 | $100 | $250 |
| Twilio (500 SMS) | $0 | $25 | $75 |
| Azure OpenAI | $0 | $30 | $100 |
| Support labor | $25 | $100 | $300 |
| **Total COGS** | **$75** | **$530** | **$1,425** |
| **Gross margin** | **85%** | **65%** | **60%+** |

### Value Comparison for Customers

| Alternative | Annual Cost | What's Missing vs. FAHM |
|------------|------------|-------------------------|
| Build in-house | $200K-500K+ | 12-18 month timeline, ongoing maintenance |
| Blend (POS only) | $30K-100K | No LOS sync, no CRM, no dynamic screens |
| Maxwell | $24K-60K | No real-time WebSocket, no AI chatbot, no CMS |
| Custom Encompass portal | $50K-150K | No mobile app, no rate engine, limited scope |

**FAHM Starter annual cost: $5,988 — 10-50x cheaper than alternatives.**

---

## Competitive Positioning

### Competitive Landscape

| Competitor | Model | Strength | FAHM Advantage |
|-----------|-------|----------|----------------|
| **Blend** | Per-loan transaction | Market leader in POS | FAHM covers full lifecycle, not just POS. Lower cost. |
| **Maxwell** | Per-seat SaaS | LO productivity tools | FAHM has real-time WebSocket, dynamic CMS, AI chatbot |
| **SimpleNexus (nCino)** | Enterprise SaaS | Deep Encompass integration | FAHM is mobile-first with admin-managed screens, more affordable |
| **Roostify** | Enterprise SaaS | Digital lending platform | FAHM deploys faster, better for small/mid lenders |
| **LenderLogix** | SaaS | Pre-approval + POS tools | FAHM has broader feature set (CRM, dashboards, calculators) |
| **In-house dev** | CapEx | Full control | FAHM is 10-50x cheaper, deployed in days not months |

### Unique Selling Proposition

> **"The only mortgage platform where you manage every mobile screen, menu, and feature from a web dashboard in real-time — no app store updates required."**

### Key Differentiators

1. **Real-time mobile management** — WebSocket-powered dynamic screens and menus; admin changes appear on mobile devices instantly
2. **Full lifecycle coverage** — Application to funding in one platform (not just POS or just LOS)
3. **7-role ecosystem** — Borrowers, LOs, brokers, realtors, branch managers, TPO, and admins all have tailored experiences
4. **AI-powered borrower engagement** — GPT-4 chatbot for borrower questions, available 24/7
5. **Deep integrations out of the box** — Encompass, Optimal Blue, Total Expert, Xactus, Blend, Power BI
6. **Co-branding engine** — Referral partners get branded experiences with analytics tracking

---

## Unit Economics

### Target Metrics (Year 1-3)

| Metric | Year 1 Target | Year 2 Target | Year 3 Target |
|--------|---------------|---------------|---------------|
| Total customers | 20-30 | 80-120 | 200-300 |
| Average Revenue Per Account (ARPA) | $800/mo | $1,200/mo | $1,600/mo |
| Monthly Recurring Revenue (MRR) | $16K-24K | $96K-144K | $320K-480K |
| Annual Recurring Revenue (ARR) | $192K-288K | $1.15M-1.73M | $3.84M-5.76M |
| Gross Margin | 75% | 70% | 72% |
| Net Revenue Retention | 110%+ | 120%+ | 125%+ |
| Logo Churn (monthly) | <3% | <2% | <1.5% |
| CAC (Customer Acquisition Cost) | $3,000-5,000 | $4,000-6,000 | $5,000-8,000 |
| CAC Payback (months) | 4-6 | 3-5 | 3-5 |
| LTV:CAC Ratio | 8:1+ | 10:1+ | 12:1+ |

### Expansion Revenue Levers

1. **Seat expansion** — As lender hires more LOs, per-seat revenue grows automatically
2. **Tier upgrades** — Starter → Professional as they need Encompass integration
3. **Integration add-ons** — Blend, Power BI, co-branding partners
4. **Usage growth** — Credit pulls, SMS, AI chatbot usage scales with loan volume

---

## Discount & Incentive Policies

### Standard Discounts

| Discount Type | Amount | Conditions |
|---------------|--------|------------|
| Annual commitment | 15% off monthly price | Paid annually upfront |
| 2-year commitment | 20% off monthly price | Enterprise only |
| Non-profit / CDFI lenders | 25% off | Verified non-profit status |
| Startup lender (< 1 year) | 30% off first year | Starter or Professional only |

### Pilot Program

| Parameter | Terms |
|-----------|-------|
| Duration | 60 days |
| Tier access | Professional (full features) |
| Seats | Up to 10 |
| Cost | Free |
| Conversion offer | 20% off first 6 months if signed during pilot |
| Availability | First 10 customers per quarter |

### Referral Program

| Referrer Type | Reward |
|---------------|--------|
| Existing customer | 1 month free per successful referral |
| Technology partner | 15% recurring revenue share |
| Industry consultant | $500 per signed customer |

---

## Pricing FAQ

**Q: Is there a setup fee?**
A: Starter and Professional: No setup fee. Enterprise: Custom onboarding fee ($2,500-10,000) depending on integration complexity and data migration scope.

**Q: Can we switch tiers mid-contract?**
A: Yes. Upgrades take effect immediately with prorated billing. Downgrades take effect at the next billing cycle.

**Q: What happens if we exceed our seat limit?**
A: Additional seats are automatically added at the per-seat rate. You will see the charges on your next invoice.

**Q: Are borrower accounts really free?**
A: Yes, always. Borrower adoption is critical to platform value. We never charge for borrower accounts.

**Q: Can we get a custom integration not listed?**
A: Yes, on the Enterprise tier. Custom integration development is scoped and quoted separately.

**Q: What is your uptime guarantee?**
A: Enterprise tier includes a 99.9% uptime SLA. Professional tier targets 99.5% (best-effort, no contractual SLA).

**Q: Do you support multi-tenancy / white-label?**
A: Yes, on the Enterprise tier. Each tenant gets isolated data, custom branding, and optional custom domain.

---

## Related Documents

- [SALES_PLAYBOOK.md](./SALES_PLAYBOOK.md) — Go-to-market strategy and sales process
- [FEATURE_TIER_MATRIX.md](./FEATURE_TIER_MATRIX.md) — Detailed feature-to-tier mapping
- [IMPLEMENTATION_GUIDE_SUBSCRIPTIONS.md](./IMPLEMENTATION_GUIDE_SUBSCRIPTIONS.md) — Technical guide for building the subscription system
- [PLATFORM_CAPABILITIES_OVERVIEW.md](./PLATFORM_CAPABILITIES_OVERVIEW.md) — Investor and client-facing platform summary
