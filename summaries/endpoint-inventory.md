# Endpoint Inventory

Base prefix: `/api/v1` unless noted. Swagger UI: `/api-docs`; JSON: `/api-docs.json`; health: `/health`.

## Auth
- POST /auth/register – register user
- POST /auth/login – login and issue tokens
- POST /auth/refresh – exchange refresh for access token
- POST /auth/logout – revoke session (auth required)

## Loans
- GET /loans – list loans (scoped for borrower)
- POST /loans – create loan (roles: admin/LO/borrower/broker)
- GET /loans/:id – get loan
- PATCH /loans/:id/status – update status/milestones (roles: admin/LO)
- POST /loans/:id/preapproval – generate preapproval (roles: admin/LO/BM)

## Documents (metadata)
- GET /documents/:loanId – list loan documents
- POST /documents – upload metadata (deduplicates by hash)
- POST /documents/:id/synced – mark as synced

## Document Uploads (files)
Mounted at `/document-uploads`.
- POST /document-uploads/presign – create presigned upload (roles: admin/LO/broker/borrower)
- POST /document-uploads/upload – multipart upload (auth)
- GET /document-uploads/loan/:loanId – list docs for loan
- GET /document-uploads/:id – get doc details
- GET /document-uploads/:id/download – download file
- DELETE /document-uploads/:id – delete
- POST /document-uploads/:id/retry-sync – retry POS sync (roles: admin/LO)

## Notifications
- GET /notifications – list my notifications
- POST /notifications – create notification
- POST /notifications/:id/read – mark read

## Users
- POST /users/push-token – register Expo push token
- GET /users/me – current profile
- POST /users/profile-picture – upload profile picture

## POS Integration
- POST /pos/handoff – create handoff token
- POST /pos/initiate – initiate POS application (blend/big_pos)
- GET /pos/application/:applicationId/status – get status (requires query `posSystem`)
- POST /pos/application/:applicationId/sync-borrower – sync borrower data
- GET /pos/application/:applicationId/documents – list POS docs
- POST /pos/application/:applicationId/submit – submit application
- POST /pos/webhooks/blend – Blend webhook (public, signature verified)
- POST /pos/webhooks/big-pos – Big POS webhook (public, signature verified)

## POS Link
Mounted at `/pos-link`.
- POST /pos-link/generate – generate secure link
- POST /pos-link/activate/:sessionId – activate session (public)
- POST /pos-link/track/:sessionId – track event (public)
- POST /pos-link/callback/:sessionId – POS callback (public)
- GET /pos-link/session/:sessionId – get session
- GET /pos-link/analytics/:sessionId – get analytics
- GET /pos-link/my-sessions – list my sessions
- GET /pos-link/lo-sessions – list LO sessions (roles: LO/BM/admin)
- POST /pos-link/cancel/:sessionId – cancel session (auth)

## Calculator
- POST /calculator – payment/APR calc
- GET /calculator/rates – current rates (Optimal Blue) for calc
- POST /calculator/amortization – custom amortization schedule
- POST /calculator/apply – generate apply link from calculator data

## Encompass Integration
- POST /encompass/loans/:id/sync – sync loan
- GET /encompass/loans/:id/contacts – get contacts
- GET /encompass/loans/:id/messages – get messages
- POST /encompass/loans/:id/messages – send message
- POST /encompass/loans/:id/messages/:messageId/read – mark message read
- GET /encompass/loans/:id/sync-history – sync history (roles: admin/LO/BM)

## CRM (Total Expert)
- POST /crm/sync/contacts – sync contacts
- GET /crm/contacts – list contacts for user
- GET /crm/contacts/:contactId/engagement – contact engagement
- POST /crm/sync/journeys – sync journeys
- GET /crm/journeys – list journeys
- POST /crm/contacts/:contactId/journeys/:journeyId/enroll – enroll contact
- POST /crm/loans/:loanId/trigger-milestone-journey – trigger milestone journey
- POST /crm/contacts/:contactId/activities – log activity
- GET /crm/contacts/:contactId/activities – list activities
- GET /crm/sync/logs – sync logs

## Credit (Xactus)
- POST /credit/loans/:loanId/request – request tri-merge (roles: admin/LO)
- GET /credit/reports/:reportId – get credit report
- GET /credit/loans/:loanId/reports – list loan credit reports
- POST /credit/reports/:reportId/reissue – reissue report (roles: admin/LO)
- GET /credit/logs – credit pull logs (roles: admin/LO)
- POST /credit/expired/purge – purge expired reports (admin)

## Rates & Pricing
- GET /rates/current – current pricing
- GET /rates/history – rate history
- GET /rates/products – product pricing
- POST /rates/alerts – create rate alert
- GET /rates/alerts – list my rate alerts
- PUT /rates/alerts/:alertId – update alert
- DELETE /rates/alerts/:alertId – cancel alert
- POST /rates/alerts/check – check alerts (roles: admin/LO)
- POST /rates/locks – submit rate lock (roles: admin/LO/BM/borrower)
- GET /rates/locks/loan/:loanId – loan rate locks
- POST /rates/locks/:lockId/extend – extend lock (roles: admin/LO/BM)

## Dashboard (Power BI)
- GET /dashboard/reports – available reports
- GET /dashboard/reports/:reportId/embed – embed config
- POST /dashboard/reports/:reportId/refresh – refresh dataset (roles: admin/BM)
- GET /dashboard/metrics – metrics/KPIs
- GET /dashboard/my-kpis – my KPIs
- GET /dashboard/branch-performance – branch summary (roles: BM/admin)
- GET /dashboard/regional-performance – regional summary (admin)
- GET /dashboard/leaderboard – leaderboard

## Business Cards
- POST /business-cards – create/update my card
- GET /business-cards – list all (roles: admin/BM)
- GET /business-cards/me – my card
- DELETE /business-cards/me – delete my card
- GET /business-cards/me/analytics – my analytics
- POST /business-cards/me/regenerate-qr – regen QR
- GET /business-cards/slug/:slug – public card by slug
- POST /business-cards/slug/:slug/apply – track apply and get POS URL
- POST /business-cards/slug/:slug/share – track share

## Preapproval Letters
- POST /preapproval/generate – generate letter (roles: admin/LO/BM)
- GET /preapproval/loan/:loanId – letters for loan
- GET /preapproval/:id – get letter
- GET /preapproval/:id/download – download PDF
- POST /preapproval/:id/share – share letter
- POST /preapproval/:id/regenerate – regenerate (roles: admin/LO/BM)
- DELETE /preapproval/:id – delete (roles: admin/LO/BM)

## Consent Management
- POST /consent/request – request consent (roles: realtor/broker/LO)
- POST /consent/:id/grant – borrower grants
- POST /consent/:id/revoke – revoke
- GET /consent – list my consents
- GET /consent/:id – get consent
- GET /consent/check-access – check access for borrower/data scope
- POST /consent/:id/log-access – log access

## Persona Views
- GET /persona-views/me – get my view config
- PATCH /persona-views/me – update my view config
- POST /persona-views/me/reset – reset to default
- GET /persona-views/dashboard – persona-filtered dashboard data

## Referral Sources
- POST /referral-sources – create (roles: admin/LO/BM)
- GET /referral-sources – list with filters
- GET /referral-sources/top-performers – top performers (roles: BM/admin)
- GET /referral-sources/:id – get referral source
- PATCH /referral-sources/:id – update (roles: admin/LO/BM)
- DELETE /referral-sources/:id – delete (admin)
- GET /referral-sources/:id/analytics – analytics
- GET /referral-sources/:id/branding – public branding config
- PATCH /referral-sources/:id/branding – update branding (roles: admin/LO/BM)
- POST /referral-sources/:id/track – track activity (auth)

## SMS
- POST /sms/send – send SMS (auth)
- POST /sms/webhook/receive – inbound webhook (public)
- POST /sms/webhook/status – status webhook (public)
- GET /sms/conversation/:phone – conversation thread
- GET /sms/loan/:loanId – messages for loan
- GET /sms/my-messages – my messages
- PATCH /sms/:messageId/read – mark read
- GET /sms/stats – SMS stats (roles: admin/LO/BM)
- POST /sms/sync-to-encompass – force sync (admin)

## Rate Alerts (standalone)
Mounted at `/rate-alerts` (separate from /rates/alerts).
- POST /rate-alerts – create alert
- GET /rate-alerts – list alerts
- GET /rate-alerts/stats – alert stats
- GET /rate-alerts/:id – get alert
- PATCH /rate-alerts/:id – update alert
- DELETE /rate-alerts/:id – delete alert
- GET /rate-alerts/:id/check-rate – check rate
- POST /rate-alerts/:id/trigger-check – manual trigger
- POST /rate-alerts/:id/pause – pause alert
- POST /rate-alerts/:id/resume – resume alert

## Chatbot
- POST /chatbot/start – start session
- POST /chatbot/message – send message
- GET /chatbot/session/:sessionId – session history
- GET /chatbot/sessions – my sessions
- POST /chatbot/session/:sessionId/escalate – escalate session
- POST /chatbot/session/:sessionId/close – close session
- GET /chatbot/stats – chatbot stats (roles: admin/BM)
- GET /chatbot/escalated – escalated sessions (roles: admin/BM/LO)
- POST /chatbot/session/:sessionId/resolve – resolve escalation (roles: admin/LO)
