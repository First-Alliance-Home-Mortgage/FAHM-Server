# FAHM API Reference

> Complete REST API reference for the FAHM-Server backend.
> Base URL: `http://localhost:4000/api/v1`

## Authentication

All authenticated endpoints require:
```
Authorization: Bearer <JWT_TOKEN>
```

---

## Auth Endpoints

### POST `/auth/login`
**Auth:** None

**Request:**
```json
{
  "email": "user@example.com",
  "password": "yourpassword"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "a1b2c3d4...",
  "user": {
    "_id": "64abc...",
    "name": "John Doe",
    "email": "john@fahm.com",
    "phone": "555-0100",
    "title": "Loan Officer",
    "nmls": "123456",
    "photo": "https://blob.azure.net/...",
    "role": {
      "_id": "64xyz...",
      "name": "Loan Officer (Retail)",
      "slug": "loan_officer_retail",
      "capabilities": [
        { "_id": "cap1", "name": "loan:create", "slug": "loan:create", "category": "loan" },
        { "_id": "cap2", "name": "loan:read", "slug": "loan:read", "category": "loan" }
      ]
    },
    "branch": {
      "name": "Main Branch",
      "address": "123 Main St",
      "city": "Phoenix",
      "state": "AZ",
      "zip": "85001",
      "phone": "602-555-0100"
    },
    "emailVerified": true,
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-06-01T00:00:00.000Z"
  }
}
```

### POST `/auth/register`
**Auth:** Admin Bearer token required

**Request:**
```json
{
  "name": "Jane Smith",
  "email": "jane@fahm.com",
  "password": "securepassword",
  "role": "loan_officer_retail"
}
```

**Response (201):** Same structure as login response.

### POST `/auth/refresh`
**Auth:** None

**Request:**
```json
{
  "refreshToken": "a1b2c3d4..."
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "e5f6g7h8..."
}
```

### POST `/auth/logout`
**Auth:** Bearer

**Request:**
```json
{
  "refreshToken": "a1b2c3d4..."
}
```

**Response (200):**
```json
{ "message": "Logged out successfully" }
```

---

## User Endpoints

### GET `/users/me`
**Auth:** Bearer

Returns current authenticated user profile.

### PATCH `/users/me`
**Auth:** Bearer

**Request:**
```json
{
  "name": "Updated Name",
  "phone": "555-0200",
  "title": "Senior Loan Officer"
}
```

### POST `/users/profile-picture`
**Auth:** Bearer
**Content-Type:** `multipart/form-data`

**Form field:** `photo` (single file, max 10MB, PNG/JPG/JPEG)

### GET `/users`
**Auth:** Admin

**Query params:**
| Param | Type | Description |
|---|---|---|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 10) |
| `role` | string | Filter by role slug |
| `active` | boolean | Filter by active status |
| `q` | string | Search by name or email |
| `sort` | string | Sort field (e.g., `name`, `-createdAt`) |

### POST `/users`
**Auth:** Admin

**Request:**
```json
{
  "name": "New User",
  "email": "newuser@fahm.com",
  "password": "password123",
  "role": "borrower",
  "phone": "555-0300",
  "title": "Customer",
  "branch": {
    "name": "West Branch",
    "address": "456 West Ave",
    "city": "Tempe",
    "state": "AZ",
    "zip": "85281",
    "phone": "480-555-0100"
  }
}
```

### GET `/users/:id`
**Auth:** Admin

### PATCH `/users/:id`
**Auth:** Admin

### DELETE `/users/:id`
**Auth:** Admin

### POST `/users/push-token`
**Auth:** None

**Request:**
```json
{
  "userId": "64abc...",
  "expoPushToken": "ExponentPushToken[xxx]"
}
```

---

## Loan Endpoints

### GET `/loans`
**Auth:** Bearer (borrowers see only their own)

**Query params:** `page`, `limit`, `status`

**Response:**
```json
{
  "data": [
    {
      "_id": "loan1",
      "borrower": { "_id": "u1", "name": "John Borrower", "email": "john@email.com" },
      "assignedOfficer": { "_id": "u2", "name": "Jane LO", "email": "jane@fahm.com" },
      "amount": 350000,
      "propertyAddress": {
        "street": "789 Home St",
        "city": "Scottsdale",
        "state": "AZ",
        "zip": "85251"
      },
      "status": "processing",
      "milestones": [
        { "name": "Application Submitted", "status": "completed" },
        { "name": "Documents Reviewed", "status": "in_progress" },
        { "name": "Underwriting", "status": "pending" }
      ],
      "source": "retail",
      "encompassLoanId": "ENC-001",
      "createdAt": "2024-03-15T00:00:00.000Z"
    }
  ],
  "total": 50,
  "page": 1,
  "limit": 10,
  "totalPages": 5
}
```

### POST `/loans`
**Auth:** Admin, LOs, Broker, Borrower

**Request:**
```json
{
  "borrower": "userId (optional if self)",
  "amount": 350000,
  "propertyAddress": {
    "street": "789 Home St",
    "city": "Scottsdale",
    "state": "AZ",
    "zip": "85251"
  }
}
```

### GET `/loans/:id`
**Auth:** Bearer

### PATCH `/loans/:id/status`
**Auth:** Admin, LOs

**Request:**
```json
{
  "status": "underwriting",
  "milestones": [
    { "name": "Underwriting", "status": "in_progress" }
  ]
}
```

### POST `/loans/:id/preapproval`
**Auth:** Admin, LOs, Branch Manager

---

## Document Upload Endpoints

### POST `/document-uploads/upload`
**Auth:** Bearer
**Content-Type:** `multipart/form-data`

**Form fields:**
| Field | Type | Required | Description |
|---|---|---|---|
| `files` | File[] | Yes | Up to 5 files, max 10MB each |
| `loanId` | string | Yes | Associated loan ID |
| `documentType` | string | Yes | One of: `paystub`, `w2`, `tax_return`, `bank_statement`, `id`, `proof_of_employment`, `appraisal`, `purchase_agreement`, `insurance`, `credit_report`, `other` |

### POST `/document-uploads/presign`
**Auth:** Bearer

**Request:**
```json
{
  "fileName": "paystub.pdf",
  "mimeType": "application/pdf",
  "loanId": "loan123"
}
```

**Response:**
```json
{
  "uploadUrl": "https://blob.azure.net/...",
  "expiresAt": "2024-01-01T00:30:00.000Z"
}
```

### GET `/document-uploads/loan/:loanId`
**Auth:** Bearer

### GET `/document-uploads/:id`
**Auth:** Bearer

### GET `/document-uploads/:id/download`
**Auth:** Bearer

Returns file as blob (set `responseType: 'blob'` on client).

### DELETE `/document-uploads/:id`
**Auth:** Bearer

### POST `/document-uploads/:id/retry-sync`
**Auth:** LOs, Admin

---

## Rate Endpoints

### GET `/rates/current`
**Auth:** Bearer

Returns current mortgage rates from Optimal Blue.

### GET `/rates/history`
**Auth:** Bearer

### GET `/rates/products`
**Auth:** Bearer

Returns product pricing details.

### POST `/rates/alerts`
**Auth:** Bearer

**Request:**
```json
{
  "productType": "conventional",
  "loanTerm": 30,
  "loanAmount": 350000,
  "creditScore": 750,
  "ltv": 80,
  "propertyType": "single_family",
  "targetRate": 6.5,
  "triggerType": "below",
  "notificationMethod": "push"
}
```

**Values:**
- `productType`: `conventional` | `fha` | `va` | `usda` | `jumbo`
- `triggerType`: `below` | `above` | `drops_by`
- `notificationMethod`: `push` | `sms` | `email` | `all`

### GET `/rates/alerts`
**Auth:** Bearer

### PUT `/rates/alerts/:alertId`
**Auth:** Bearer

### DELETE `/rates/alerts/:alertId`
**Auth:** Bearer

### POST `/rates/locks`
**Auth:** Bearer

**Request:**
```json
{
  "loanId": "loan123",
  "productType": "conventional",
  "rate": 6.5,
  "lockDays": 30
}
```

### GET `/rates/locks/loan/:loanId`
**Auth:** Bearer

### POST `/rates/locks/:lockId/extend`
**Auth:** LOs, Branch Manager, Admin

---

## Dashboard Endpoints

### GET `/dashboard/reports`
**Auth:** `dashboard:view` capability

### GET `/dashboard/reports/:reportId/embed`
**Auth:** Bearer

Returns Power BI embed configuration.

### POST `/dashboard/reports/:reportId/refresh`
**Auth:** Admin, Branch Manager

### GET `/dashboard/metrics`
**Auth:** `dashboard:view` capability

### GET `/dashboard/my-kpis`
**Auth:** Bearer

### GET `/dashboard/branch-performance`
**Auth:** Branch Manager, Admin

### GET `/dashboard/regional-performance`
**Auth:** Admin

### GET `/dashboard/leaderboard`
**Auth:** Bearer

---

## Credit Report Endpoints

### POST `/credit/loans/:loanId/request`
**Auth:** Admin, LOs

**Request:**
```json
{
  "reportType": "tri_merge"
}
```

**Values for `reportType`:** `tri_merge` | `single_bureau` | `soft_pull`

### GET `/credit/reports/:reportId`
**Auth:** Bearer

**Response:**
```json
{
  "_id": "report1",
  "loan": "loan123",
  "borrower": "user456",
  "reportType": "tri_merge",
  "status": "completed",
  "scores": [
    { "bureau": "equifax", "score": 750, "scoreModel": "FICO 5", "factors": [...] },
    { "bureau": "experian", "score": 745, "scoreModel": "FICO 2", "factors": [...] },
    { "bureau": "transunion", "score": 755, "scoreModel": "FICO 4", "factors": [...] }
  ],
  "midScore": 750,
  "summary": {
    "totalAccounts": 15,
    "openAccounts": 8,
    "totalDebt": 125000,
    "availableCredit": 50000,
    "creditUtilization": 0.28
  },
  "expiresAt": "2026-01-01T00:00:00.000Z"
}
```

### GET `/credit/loans/:loanId/reports`
**Auth:** Bearer

### POST `/credit/reports/:reportId/reissue`
**Auth:** Admin, LOs

### GET `/credit/logs`
**Auth:** Admin, LOs (FCRA audit trail)

### POST `/credit/expired/purge`
**Auth:** Admin

---

## Menu Endpoints

### GET `/menus`
**Auth:** Bearer

Returns all menus.

### GET `/menus/grouped`
**Auth:** Bearer

**Response:**
```json
{
  "drawer": [
    { "_id": "m1", "alias": "dashboard", "label": "Dashboard", "icon": "Home", "route": "/dashboard", "type": "drawer", "order": 1, "visible": true, "roles": [] }
  ],
  "tab": [...],
  "stack": [...]
}
```

### GET `/menus/:id`
**Auth:** Bearer

### GET `/menus/alias/:alias`
**Auth:** Bearer

### POST `/menus`
**Auth:** Admin

**Request:**
```json
{
  "alias": "new-page",
  "label": "New Page",
  "icon": "FileText",
  "route": "/new-page",
  "type": "drawer",
  "order": 10,
  "visible": true,
  "roles": ["admin", "loan_officer_retail"]
}
```

> Auto-broadcasts `menu_updated` WebSocket event on success.

### PUT `/menus/:id`
**Auth:** Admin

### PATCH `/menus/:id/visibility`
**Auth:** Admin

Toggles `visible` boolean. Broadcasts `menu_updated`.

### DELETE `/menus/:id`
**Auth:** Admin. Broadcasts `menu_updated`.

### GET `/menus/roles`
**Auth:** Admin

Returns all available role slugs.

### GET `/menus/versions`
**Auth:** Admin

Returns menu version history.

### POST `/menus/reset`
**Auth:** Admin

Resets menus to system defaults.

### POST `/menus/restore/:version`
**Auth:** Admin

Restores menus to a previous version snapshot.

---

## CMS Endpoints

### GET `/cms/screens/dashboard`
**Auth:** Bearer

### GET `/cms/screens`
**Auth:** Bearer

### GET `/cms/screens/:slug`
**Auth:** Bearer

### POST `/cms/screens`
**Auth:** Admin

### PATCH `/cms/screens/:slug`
**Auth:** Admin

### POST `/cms/screens/:slug/publish`
**Auth:** Admin

### GET `/cms/navigation-configs`
**Auth:** Bearer

### PUT `/cms/navigation-configs`
**Auth:** Admin

### GET `/cms/feature-flags`
**Auth:** Bearer

### PUT `/cms/feature-flags`
**Auth:** Admin

### PATCH `/cms/feature-flags/:key`
**Auth:** Admin

### GET `/cms/component-registry`
**Auth:** Bearer

---

## Business Card Endpoints

### POST `/business-cards`
**Auth:** Bearer

Create or update the current user's business card.

**Request:**
```json
{
  "nmls": "123456",
  "title": "Senior Loan Officer",
  "bio": "20 years experience in mortgage lending.",
  "phone": "555-0100",
  "email": "john@fahm.com",
  "branch": {
    "name": "Main Branch",
    "address": "123 Main St",
    "city": "Phoenix",
    "state": "AZ",
    "zip": "85001"
  },
  "socialLinks": {
    "linkedin": "https://linkedin.com/in/john",
    "facebook": "",
    "twitter": "",
    "instagram": ""
  },
  "branding": {
    "primaryColor": "#003B5C",
    "secondaryColor": "#FF6B35"
  },
  "applyNowUrl": "https://apply.fahm.com/john",
  "isPublic": true
}
```

### GET `/business-cards/me`
**Auth:** Bearer

### DELETE `/business-cards/me`
**Auth:** Bearer

### GET `/business-cards/me/analytics`
**Auth:** Bearer

### POST `/business-cards/me/regenerate-qr`
**Auth:** Bearer

### GET `/business-cards/slug/:slug`
**Auth:** Public (no auth)

### POST `/business-cards/slug/:slug/apply`
**Auth:** Public — Tracks "Apply Now" click.

### POST `/business-cards/slug/:slug/share`
**Auth:** Public — Tracks share action.

### GET `/business-cards`
**Auth:** Admin, Branch Manager

---

## Preapproval Letter Endpoints

### POST `/preapproval/generate`
**Auth:** LOs, Branch Manager, Admin

### GET `/preapproval/loan/:loanId`
**Auth:** Bearer

### GET `/preapproval/:id`
**Auth:** Bearer

### GET `/preapproval/:id/download`
**Auth:** Bearer — Returns PDF blob.

### POST `/preapproval/:id/share`
**Auth:** Bearer

**Request:**
```json
{
  "method": "email",
  "recipient": "borrower@email.com"
}
```

**Values for `method`:** `email` | `sms` | `link`

### POST `/preapproval/:id/regenerate`
**Auth:** LOs, Branch Manager, Admin

### DELETE `/preapproval/:id`
**Auth:** LOs, Branch Manager, Admin

---

## SMS Endpoints

### POST `/sms/send`
**Auth:** Bearer

**Request:**
```json
{
  "to": "+15551234567",
  "body": "Your loan update is ready.",
  "loanId": "loan123"
}
```

### GET `/sms/conversation/:phone`
**Auth:** Bearer

### GET `/sms/loan/:loanId`
**Auth:** Bearer

### GET `/sms/my-messages`
**Auth:** Bearer

### PATCH `/sms/:messageId/read`
**Auth:** Bearer

### GET `/sms/stats`
**Auth:** LOs, Branch Manager, Admin

---

## Chatbot Endpoints

### POST `/chatbot/start`
**Auth:** Bearer

### POST `/chatbot/message`
**Auth:** Bearer

**Request:**
```json
{
  "sessionId": "session123",
  "message": "What documents do I need for a conventional loan?"
}
```

### GET `/chatbot/session/:sessionId`
**Auth:** Bearer

### GET `/chatbot/sessions`
**Auth:** Bearer

### POST `/chatbot/session/:sessionId/escalate`
**Auth:** Bearer

### POST `/chatbot/session/:sessionId/close`
**Auth:** Bearer

**Request:**
```json
{
  "rating": 5
}
```

### GET `/chatbot/stats`
**Auth:** Admin, Branch Manager

### GET `/chatbot/escalated`
**Auth:** Admin, Branch Manager, LOs

### POST `/chatbot/session/:sessionId/resolve`
**Auth:** Admin, LOs

---

## Encompass Endpoints

### GET `/encompass/test-connection`
**Auth:** LOs, Admin

### POST `/encompass/loans/:id/sync`
**Auth:** Bearer

### GET `/encompass/loans/:id/contacts`
**Auth:** Bearer

### GET `/encompass/loans/:id/messages`
**Auth:** Bearer

### POST `/encompass/loans/:id/messages`
**Auth:** Bearer

### POST `/encompass/loans/:id/messages/:messageId/read`
**Auth:** Bearer

### GET `/encompass/loans/:id/sync-history`
**Auth:** LOs, Admin, Branch Manager

### POST `/encompass/loans/:id/link`
**Auth:** LOs, Admin

**Request:**
```json
{
  "encompassLoanId": "ENC-GUID-HERE"
}
```

### POST `/encompass/loans/:id/unlink`
**Auth:** Admin

### PATCH `/encompass/loans/:id/status`
**Auth:** LOs, Admin

### GET `/encompass/loans/:id/documents`
**Auth:** Bearer

### POST `/encompass/loans/:id/documents`
**Auth:** Bearer — `multipart/form-data`

### GET `/encompass/loans/:id/documents/:attachmentId/download`
**Auth:** Bearer — Returns blob.

---

## CRM (Total Expert) Endpoints

### POST `/crm/sync/contacts`
**Auth:** Bearer

### GET `/crm/contacts`
**Auth:** Bearer

### GET `/crm/contacts/:contactId/engagement`
**Auth:** Bearer

### POST `/crm/sync/journeys`
**Auth:** Bearer

### GET `/crm/journeys`
**Auth:** Bearer

### POST `/crm/contacts/:contactId/journeys/:journeyId/enroll`
**Auth:** Bearer

### POST `/crm/loans/:loanId/trigger-milestone-journey`
**Auth:** Bearer

### POST `/crm/contacts/:contactId/activities`
**Auth:** Bearer

### GET `/crm/contacts/:contactId/activities`
**Auth:** Bearer

### GET `/crm/sync/logs`
**Auth:** Bearer

---

## Consent Management Endpoints

### POST `/consent/request`
**Auth:** Realtor, Broker, LOs

**Request:**
```json
{
  "borrower": "userId",
  "dataTypes": ["credit_report", "income_verification"],
  "purpose": "Loan pre-qualification"
}
```

### POST `/consent/:id/grant`
**Auth:** Borrower

### POST `/consent/:id/revoke`
**Auth:** Bearer

### GET `/consent`
**Auth:** Bearer

### GET `/consent/:id`
**Auth:** Bearer

### GET `/consent/check-access`
**Auth:** Bearer

**Query params:** `borrowerId`, `dataType`

### POST `/consent/:id/log-access`
**Auth:** Bearer

---

## Referral Source Endpoints

### POST `/referral-sources`
**Auth:** LOs, Branch Manager, Admin

### GET `/referral-sources`
**Auth:** Bearer

**Query params:** `page`, `limit`, `type`, `q`, `sort`

### GET `/referral-sources/top-performers`
**Auth:** Branch Manager, Admin

### GET `/referral-sources/:id`
**Auth:** Bearer

### PATCH `/referral-sources/:id`
**Auth:** LOs, Branch Manager, Admin

### DELETE `/referral-sources/:id`
**Auth:** Admin

### GET `/referral-sources/:id/analytics`
**Auth:** Bearer

**Query params:** `startDate`, `endDate`

### GET `/referral-sources/:id/branding`
**Auth:** Public

### PATCH `/referral-sources/:id/branding`
**Auth:** LOs, Branch Manager, Admin

### POST `/referral-sources/:id/track`
**Auth:** Bearer

**Request:**
```json
{
  "type": "lead"
}
```

**Values for `type`:** `lead` | `application` | `funded`

---

## POS Link Endpoints

### POST `/pos-link/generate`
**Auth:** Bearer

**Request:**
```json
{
  "loanId": "loan123",
  "posSystem": "blend"
}
```

**Values for `posSystem`:** `blend` | `big_pos`

### POST `/pos-link/activate/:sessionId`
**Auth:** Public

### POST `/pos-link/track/:sessionId`
**Auth:** Public

### POST `/pos-link/callback/:sessionId`
**Auth:** Public

### GET `/pos-link/session/:sessionId`
**Auth:** Bearer

### GET `/pos-link/analytics/:sessionId`
**Auth:** Bearer

### GET `/pos-link/my-sessions`
**Auth:** Bearer

### GET `/pos-link/lo-sessions`
**Auth:** LOs, Branch Manager, Admin

### POST `/pos-link/cancel/:sessionId`
**Auth:** Bearer

---

## Message Endpoints

### GET `/messages/my-messages`
**Auth:** Bearer

### GET `/messages/loan/:loanId`
**Auth:** Bearer

### GET `/messages/:id`
**Auth:** Bearer

### POST `/messages`
**Auth:** Bearer

**Request:**
```json
{
  "loan": "loanId",
  "recipient": "userId",
  "content": "Your documents have been received.",
  "messageType": "text"
}
```

**Values for `messageType`:** `text` | `system` | `document` | `milestone`

### PATCH `/messages/:id/read`
**Auth:** Bearer

### DELETE `/messages/:id`
**Auth:** Bearer

---

## Notification Endpoints

### GET `/notifications`
**Auth:** Bearer

**Query params:** `page`, `limit`, `read`

### PATCH `/notifications/:id/read`
**Auth:** Bearer

### POST `/notifications/read-all`
**Auth:** Bearer

---

## Admin: Role Endpoints

### GET `/roles`
**Auth:** Admin

### POST `/roles`
**Auth:** Admin

**Request:**
```json
{
  "name": "Custom Role",
  "slug": "custom_role",
  "capabilities": ["capabilityId1", "capabilityId2"]
}
```

### PUT `/roles/:id`
**Auth:** Admin

### DELETE `/roles/:id`
**Auth:** Admin

---

## Admin: Capability Endpoints

### GET `/capabilities`
**Auth:** Admin

### GET `/capabilities/:id`
**Auth:** Admin

### POST `/capabilities`
**Auth:** Admin

**Request:**
```json
{
  "name": "loan:archive",
  "slug": "loan:archive",
  "category": "loan",
  "description": "Ability to archive loan applications"
}
```

**Categories:** `loan` | `document` | `rates` | `alerts` | `messages` | `dashboard` | `webhooks` | `users` | `audit` | `log` | `other`

### PUT `/capabilities/:id`
**Auth:** Admin

### DELETE `/capabilities/:id`
**Auth:** Admin

---

## Admin: Audit Log Endpoints

### GET `/audit-logs/consent`
**Auth:** `audit:view` capability

### GET `/audit-logs/crm`
**Auth:** `audit:view` capability

### GET `/audit-logs/credit`
**Auth:** `audit:view` capability

---

## Content Update Endpoints (WebSocket REST Triggers)

### POST `/content-updates/notify`
**Auth:** Admin

Manually broadcast a content update event.

### POST `/content-updates/screen-updated`
**Auth:** Admin

### POST `/content-updates/menu-updated`
**Auth:** Admin

### GET `/content-updates/status`
**Auth:** Admin

Returns connected WebSocket client count.

---

## Health Check

### GET `/health`
**Auth:** None

**Response (200):**
```json
{ "status": "ok" }
```

---

## Common Response Patterns

### Paginated List
```json
{
  "data": [...],
  "total": 100,
  "page": 1,
  "limit": 10,
  "totalPages": 10
}
```

### Error Response
```json
{
  "message": "Human-readable error message",
  "errors": {
    "fieldName": ["Validation error message"]
  }
}
```

### HTTP Status Codes

| Code | Meaning |
|---|---|
| 200 | Success |
| 201 | Created |
| 400 | Bad request / Validation error |
| 401 | Unauthorized (invalid/missing token) |
| 403 | Forbidden (insufficient role/capability or inactive user) |
| 404 | Resource not found |
| 409 | Conflict (duplicate entry) |
| 429 | Too many requests |
| 500 | Internal server error |
