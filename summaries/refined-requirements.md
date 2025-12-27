# FAHM Mobile App – Refined Requirements & Acceptance Criteria (v2.2, Nov 2025)

Purpose: testable checklist derived from `requirements-extracted.txt` to drive delivery, QA, and compliance sign-off.

## Phase 1 (0–90 days) – MVP
- Encompass status / contacts / milestones  
  - AC: Milestones sync every 15m or via webhook; borrower sees current stage and assigned contacts; sync errors surface with retry/backoff.  
  - AC: Doc upload to Encompass/POS supports PDF/PNG/JPG/JPEG up to 20 MB per file, virus scan before push, encryption in transit/at rest, progress indicator, and clear success/fail messaging; temp blob storage purged within 24h if not synced.
- POS handoff (Blend/Big POS)  
  - AC: OAuth SSO with 15m token; deep link opens POS via universal/app link; POS-down shows fallback guidance; session timeout handled gracefully.
- Mortgage calculator + “Apply Now” CTA  
  - AC: Inputs (amount, rate, term, taxes, insurance, HOA); outputs payment & APR; CTA deep-links to POS with borrower context.
- Preapproval letter generation  
  - AC: Pulls borrower/program data from Encompass; branded PDF; optional co-brand; share via email/SMS/in-app download; immutable issuance log (who/when/version).
- Document upload to POS  
  - AC: File-type validation, progress, retry/backoff; temp blob storage then push to POS; LO/processor notified on success; duplicate detection by file hash to prevent double uploads.
- Authentication & RBAC (Azure AD B2C)  
  - AC: MFA enforced; roles: Borrower, LO (Retail/TPO), Broker, BM, Realtor, Admin; least-privilege scopes; session lifetime 60m, refresh 7d, idle timeout 30m.
- Basic notifications (push/SMS)  
  - AC: Triggers for milestones and doc requests; quiet hours default 9p–8a local (configurable); per-event throttle 5 per user per 24h; logs to CRM; SMS STOP/HELP honored; retries (3x, exponential backoff) logged.
- Compliance baseline  
  - AC: TLS 1.2+; AES-256 at rest; consent capture for messaging; audit log for auth, uploads, letters, notifications (with user/time/outcome); audit retention minimum 12 months.

### Phase 1 – Default Config (assumed unless overridden)
- Uploads: max 20 MB/file; types pdf/png/jpg/jpeg; duplicate detection via SHA-256 hash; temp blob retention 24h.  
- POS: access token TTL 15m; deep links via universal/app links; no more than 3 token mints per minute per user.  
- Sessions: access token 60m; refresh 7d; idle timeout 30m; MFA required for non-borrower roles, optional/available for borrowers.  
- Notifications: quiet hours 9p–8a local (configurable); throttle 5 per event/user/24h; retries 3x exponential; STOP/HELP/START enforced.  
- Audit: retention ≥12 months for auth, uploads, letters, notifications; includes user/time/outcome and error context.

## Phase 2 (90–180 days)
- Total Expert CRM integration  
  - AC: Two-way sync of borrower/partner; journeys fire on milestone change/new lead; in-app comms logged; retries with backoff and alerting.  
- Xactus credit  
  - AC: Tri-merge pull; display score/summary; retention window enforced; LO notified; audit logged; deletion per FCRA.  
- Optimal Blue pricing + rate alerts  
  - AC: Daily rate ingest with cache TTL; pricing shown in calculator/rate module; alerts fire on configured thresholds; unsubscribe honored; fallback if API down.  
- AI assistant (chat/voice)  
  - AC: Grounded on Encompass/CRM/POS data; PII guardrails; prompt/response logging; defined latency targets; graceful fallback on upstream errors.  
- Encompass texting (Twilio SMS)  
  - AC: Two-way SMS in-app; auto-log to Encompass/CRM; A2P 10DLC compliant; STOP/HELP; delivery status surfaced.

## Phase 3 (180–270 days)
- Co-branding (partners)  
  - AC: Partner logo/info in borrower view; co-branded preapproval letters and digital cards; referral analytics recorded.  
- Performance dashboards (Power BI Embedded)  
  - AC: KPIs (apps, preapprovals, funding, cycle time); filters by user/date/product; row-level security per persona; refresh/error states handled.  
- Offline/low-bandwidth optimization  
  - AC: Defined offline dataset; cached views; conflict resolution on re-sync; clear offline/online UX.  
- Compliance/audit hardening  
  - AC: Retention matrix enforced (credit, docs, chat, notifications); DSAR/consent flows; pen-test cadence; key rotation policy.  
- Post-close engagement (feature set to finalize)  
  - AC: At least one retention driver live (e.g., rate-drop watch, servicing view, home value tracking, refi nudges); measurable engagement goal defined.

## Notification Matrix (starter)
- Events: milestone change, doc requested, doc received, credit pulled, preapproval issued/updated, rate-alert trigger, POS session expiring.  
- Channels: push default; SMS for critical/consented; email optional for letters.  
- Controls: quiet hours, per-event throttling, retries with backoff, failure logged.  
- Logging: all notifications recorded in CRM with delivery status.  
- SMS compliance: STOP/HELP/START handled; opt-in recorded; A2P 10DLC registered.

## Open Clarifications (needed to finalize AC)
1) Post-close value: choose MVP retention features (servicing view, rate-drop watch, home value, refi nudges, insurance/loyalty).  
2) Twilio consent/A2P: confirm in-app opt-in/out UX and auto-sync of SMS logs to CRM.  
3) Power BI embedding: auth model and row-level security rules per persona.  
4) AI guardrails: grounding priority, hallucination checks, PII redaction, acceptable latency (chat/voice), offline/timeout behavior.  
5) Offline scope: allowed offline actions, cache TTL/size, conflict resolution rules.  
6) Pricing/locks: whether lock/extend/change-of-circ flows are in Phase 2; how to log to LOS/CRM.  
7) Preapproval letters: template source, signing method, co-brand asset rules, versioning/watermark.  
8) Compliance retention: durations for credit data, docs, chat, notifications; DSAR flow; key management/rotation.

