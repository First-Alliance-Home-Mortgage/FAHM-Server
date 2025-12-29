# API Endpoints

_All routes are prefixed with `/api/v1` and require JWT auth unless noted._

## Auth
- POST /auth/register
- POST /auth/login
- POST /auth/refresh

## Loans
- GET /loans
- POST /loans
- GET /loans/{id}
- PATCH /loans/{id}/status
- POST /loans/{id}/preapproval

## Documents (metadata)
- GET /documents/{loanId}
- POST /documents
- POST /documents/{id}/synced

## Document Uploads
- POST /documents/presign
- POST /documents/upload
- GET /documents/loan/{loanId}
- GET /documents/{id}
- GET /documents/{id}/download
- DELETE /documents/{id}
- POST /documents/{id}/restore

## Notifications
- GET /notifications
- POST /notifications
- POST /notifications/{id}/read

## Users
- GET /users/me

## POS
- POST /pos/handoff
- POST /pos/initiate
- GET /pos/application/{applicationId}/status
- POST /pos/application/{applicationId}/complete
- POST /pos/application/{applicationId}/refresh
- POST /pos/application/{applicationId}/documents
- POST /pos/application/{applicationId}/milestones
- POST /pos/application/{applicationId}/contacts
- POST /pos/application/{applicationId}/encompass-link
- POST /pos/application/{applicationId}/assign
- POST /pos/application/{applicationId}/cancel
- POST /pos/application/{applicationId}/resume
- POST /pos/application/{applicationId}/duplicate
- POST /pos/application/{applicationId}/audit
- POST /pos/application/{applicationId}/invite
- POST /pos/application/{applicationId}/ssn-token

## POS Links
- POST /pos-link/generate
- POST /pos-link/activate/{sessionId}
- POST /pos-link/track/{sessionId}
- POST /pos-link/callback/{sessionId}
- GET /pos-link/session/{sessionId}
- GET /pos-link/session/{sessionId}/status
- POST /pos-link/session/{sessionId}/expire
- GET /pos-link/sessions
- DELETE /pos-link/session/{sessionId}

## Calculator
- POST /calculator
- GET /calculator/rates

## Encompass
- POST /encompass/loans/{id}/sync
- GET /encompass/loans/{id}/contacts
- GET /encompass/loans/{id}/messages
- POST /encompass/loans/{id}/messages
- POST /encompass/loans/{id}/messages/{messageId}/read
- POST /encompass/loans/{id}/milestones/sync
- GET /encompass/loans/{id}/disclosures
- POST /encompass/loans/{id}/disclosures/acknowledge
- POST /encompass/loans/{id}/assign

## CRM
- POST /crm/sync/contacts
- GET /crm/contacts
- GET /crm/contacts/{contactId}/engagement
- POST /crm/sync/journeys
- GET /crm/journeys
- POST /crm/journeys/{journeyId}/enroll
- POST /crm/journeys/{journeyId}/unenroll
- POST /crm/webhooks/total-expert

## Credit
- POST /credit/loans/{loanId}/request
- GET /credit/reports/{reportId}
- GET /credit/loans/{loanId}/reports
- POST /credit/reports/{reportId}/refresh
- POST /credit/reports/{reportId}/dispute
- GET /credit/loans/{loanId}/monitoring

## Rates
- GET /rates/current
- GET /rates/history
- GET /rates/products
- POST /rates/alerts
- GET /rates/alerts
- GET /rates/alerts/{id}
- DELETE /rates/alerts/{id}
- POST /rates/locks
- GET /rates/locks/{id}
- POST /rates/locks/{id}/cancel
- POST /rates/locks/{id}/extend
- POST /rates/price

## Dashboard
- GET /dashboard/reports
- GET /dashboard/reports/{reportId}/embed
- POST /dashboard/reports/{reportId}/refresh
- GET /dashboard/metrics
- GET /dashboard/my-kpis
- GET /dashboard/branch-performance
- GET /dashboard/regional-performance

## Business Cards
- POST /business-cards
- GET /business-cards
- GET /business-cards/me
- DELETE /business-cards/me
- GET /business-cards/me/analytics
- POST /business-cards/me/regenerate-qr
- POST /business-cards/me/share
- GET /business-cards/{userId}/public
- GET /business-cards/{userId}/qr

## Preapproval Letters
- POST /preapproval/generate
- GET /preapproval/loan/{loanId}
- GET /preapproval/{id}
- GET /preapproval/{id}/download
- POST /preapproval/{id}/share
- POST /preapproval/{id}/regenerate

## Consent
- POST /consent/request
- POST /consent/{id}/grant
- POST /consent/{id}/revoke
- GET /consent
- GET /consent/{id}
- GET /consent/check-access

## Persona Views
- GET /persona-views/me
- PATCH /persona-views/me
- POST /persona-views/me/reset
- GET /persona-views/dashboard

## Referral Sources
- POST /referral-sources
- GET /referral-sources
- GET /referral-sources/top-performers
- GET /referral-sources/{id}
- PATCH /referral-sources/{id}
- DELETE /referral-sources/{id}
- GET /referral-sources/{id}/analytics
- POST /referral-sources/{id}/share
- POST /referral-sources/{id}/status
- POST /referral-sources/{id}/assign

## SMS
- POST /sms/send
- POST /sms/webhook/receive (no auth)
- POST /sms/webhook/status (no auth)
- GET /sms/conversation/{phone}
- GET /sms/loan/{loanId}
- GET /sms/my-messages

## Rate Alerts (module)
- POST /rate-alerts
- GET /rate-alerts
- GET /rate-alerts/stats
- GET /rate-alerts/{id}
- PATCH /rate-alerts/{id}
- DELETE /rate-alerts/{id}

## Chatbot
- POST /chatbot/start
- POST /chatbot/message
- GET /chatbot/session/{sessionId}
- GET /chatbot/sessions
- POST /chatbot/session/{sessionId}/escalate
- POST /chatbot/session/{sessionId}/close
- GET /chatbot/faq
- POST /chatbot/feedback
