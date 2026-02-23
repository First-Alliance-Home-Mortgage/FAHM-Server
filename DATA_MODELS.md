# FAHM-Server Data Models (Mongoose Schemas)

> Auto-generated reference for all MongoDB collections used by the FAHM-Server backend.

---

## Table of Contents

1. [Authentication & Users](#1-authentication--users)
   - [User](#user)
   - [Role](#role)
   - [Capability](#capability)
   - [RefreshToken](#refreshtoken)
   - [AuditLog](#auditlog)
2. [Loan Management](#2-loan-management)
   - [LoanApplication](#loanapplication)
   - [LoanContact](#loancontact)
   - [EncompassSyncLog](#encompasssynclog)
3. [Documents](#3-documents)
   - [Document](#document)
   - [DocumentUpload](#documentupload)
4. [Rates & Pricing](#4-rates--pricing)
   - [RateSnapshot](#ratesnapshot)
   - [ProductPricing](#productpricing)
   - [RateAlert](#ratealert)
   - [RateLock](#ratelock)
5. [Credit](#5-credit)
   - [CreditReport](#creditreport)
   - [CreditPullLog](#creditpulllog)
6. [Messaging & Notifications](#6-messaging--notifications)
   - [Message](#message)
   - [SMSMessage](#smsmessage)
   - [Notification](#notification)
7. [CRM](#7-crm)
   - [CRMContact](#crmcontact)
   - [CRMJourney](#crmjourney)
   - [CRMSyncLog](#crmsynclog)
   - [CRMActivityLog](#crmactivitylog)
8. [POS Integration](#8-pos-integration)
   - [POSSession](#possession)
9. [Dashboard & Analytics](#9-dashboard--analytics)
   - [DashboardReport](#dashboardreport)
   - [DashboardMetric](#dashboardmetric)
   - [BranchPerformance](#branchperformance)
10. [Referral Sources](#10-referral-sources)
    - [ReferralSource](#referralsource)
    - [ReferralSourceAnalytics](#referralsourceanalytics)
11. [Business Cards & Preapproval](#11-business-cards--preapproval)
    - [BusinessCard](#businesscard)
    - [PreapprovalLetter](#preapprovalletter)
12. [Consent & Privacy](#12-consent--privacy)
    - [ConsentManagement](#consentmanagement)
13. [Chatbot](#13-chatbot)
    - [ChatbotSession](#chatbotsession)
14. [Persona & Views](#14-persona--views)
    - [PersonaView](#personaview)
15. [Menu & Navigation](#15-menu--navigation)
    - [Menu](#menu)
    - [MenuConfig](#menuconfig)
    - [MenuVersion](#menuversion)
    - [Screen](#screen)
    - [NavigationConfig](#navigationconfig)
16. [CMS & Feature Management](#16-cms--feature-management)
    - [FeatureFlag](#featureflag)
    - [ComponentRegistryItem](#componentregistryitem)

---

## 1. Authentication & Users

### User

**Collection:** `users`
**File:** `src/models/User.js`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | `String` | Yes | - | Full name |
| `email` | `String` | Yes (unique) | - | Email address (lowercase, trimmed) |
| `phone` | `String` | No | - | Phone number |
| `role` | `ObjectId` → Role | Yes | - | Reference to Role model |
| `password` | `String` | Yes | - | Bcrypt hashed (minlength: 8) |
| `azureAdB2CId` | `String` | No | - | Azure AD B2C identity ID |
| `emailVerified` | `Boolean` | No | `false` | Email verification status |
| `isActive` | `Boolean` | No | `true` | Account active flag |
| `nmls` | `String` | No | - | NMLS license number |
| `title` | `String` | No | - | Job title |
| `photo` | `String` | No | - | Profile photo URL |
| `branch.name` | `String` | No | - | Branch name |
| `branch.code` | `String` | No | - | Branch code |
| `branch.region` | `String` | No | - | Branch region |
| `expoPushToken` | `String` | No | - | Expo push notification token |

**Hooks:** Pre-save bcrypt password hashing (salt rounds: 10)
**Methods:** `comparePassword(candidatePassword)` — bcrypt compare
**Timestamps:** Yes (`createdAt`, `updatedAt`)

---

### Role

**Collection:** `roles`
**File:** `src/models/Role.js`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | `String` | Yes (unique) | - | Role name (lowercase, trimmed) |
| `slug` | `String` | Yes (unique) | - | URL-safe identifier (lowercase) |
| `capabilities` | `[ObjectId]` → Capability | No | `[]` | Assigned capabilities |

**Timestamps:** Yes

---

### Capability

**Collection:** `capabilities`
**File:** `src/models/Capability.js`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | `String` | Yes (unique) | - | Capability name (trimmed) |
| `slug` | `String` | Yes (unique) | - | URL-safe identifier (lowercase) |
| `description` | `String` | No | - | Description of what this capability grants |
| `category` | `String` | No | `'other'` | Category grouping |

**Category Enum:** `loan`, `document`, `rates`, `alerts`, `messages`, `dashboard`, `webhooks`, `users`, `audit`, `cms`, `credit`, `preapproval`, `sms`, `chatbot`, `pos`, `referral`, `businesscard`, `consent`, `calculator`, `notification`, `crm`, `integration`, `tenant`, `billing`, `log`, `other`

**Timestamps:** Yes

---

### RefreshToken

**Collection:** `refreshtokens`
**File:** `src/models/RefreshToken.js`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `user` | `ObjectId` → User | Yes | - | Token owner |
| `tokenHash` | `String` | Yes (unique) | - | SHA-256 hash of token |
| `expiresAt` | `Date` | Yes | - | Expiration time (TTL index) |
| `revokedAt` | `Date` | No | - | When token was revoked |
| `revokedReason` | `String` | No | - | Reason for revocation |
| `replacedBy` | `String` | No | - | Hash of replacement token |
| `metadata.ip` | `String` | No | - | Client IP address |
| `metadata.userAgent` | `String` | No | - | Client user agent |

**TTL:** Auto-deletes expired tokens via `expiresAt` index
**Statics:** `hashToken(token)` — SHA-256 hashing
**Timestamps:** Yes

---

### AuditLog

**Collection:** `auditlogs`
**File:** `src/models/AuditLog.js`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `user` | `ObjectId` → User | No | - | User who performed the action |
| `action` | `String` | Yes | - | Action identifier (e.g., `login`, `update_loan`) |
| `entityType` | `String` | No | - | Type of entity affected |
| `entityId` | `String` | No | - | ID of entity affected |
| `status` | `String` | No | `'success'` | Outcome of the action |
| `ip` | `String` | No | - | Client IP address |
| `userAgent` | `String` | No | - | Client user agent |
| `metadata` | `Object` | No | - | Additional context data |

**Status Enum:** `success`, `error`
**Indexes:** `{user, createdAt}`, `{entityType, entityId}`, `{action, status, createdAt}`
**Timestamps:** Yes

---

## 2. Loan Management

### LoanApplication

**Collection:** `loanapplications`
**File:** `src/models/LoanApplication.js`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `borrower` | `ObjectId` → User | Yes | - | Borrower reference |
| `assignedOfficer` | `ObjectId` → User | No | - | Assigned loan officer |
| `amount` | `Number` | Yes | - | Loan amount |
| `propertyAddress.street` | `String` | No | - | Street address |
| `propertyAddress.city` | `String` | No | - | City |
| `propertyAddress.state` | `String` | No | - | State |
| `propertyAddress.zip` | `String` | No | - | ZIP code |
| `status` | `String` | No | `'draft'` | Loan status |
| `milestones` | `[milestoneSchema]` | No | `[]` | Milestone tracking array |
| `source` | `String` | No | - | Lead source |
| `referralSource` | `ObjectId` → ReferralSource | No | - | Referral source reference |
| `encompassLoanId` | `String` | No | - | Encompass loan GUID |
| `posSystem` | `String` | No | - | POS system identifier |
| `posApplicationId` | `String` | No | - | POS application ID |

**Status Enum:** `draft`, `submitted`, `in_review`, `approved`, `denied`

**Embedded: milestoneSchema**

| Field | Type | Description |
|-------|------|-------------|
| `name` | `String` | Milestone name |
| `status` | `String` | Milestone status |
| `completedAt` | `Date` | Completion date |

**Timestamps:** Yes

---

### LoanContact

**Collection:** `loancontacts`
**File:** `src/models/LoanContact.js`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `loan` | `ObjectId` → LoanApplication | Yes | - | Associated loan |
| `role` | `String` | Yes | - | Contact role |
| `user` | `ObjectId` → User | No | - | User reference (if applicable) |
| `name` | `String` | Yes | - | Contact name |
| `email` | `String` | No | - | Contact email |
| `phone` | `String` | No | - | Contact phone |
| `encompassId` | `String` | No | - | Encompass contact ID |
| `isPrimary` | `Boolean` | No | `false` | Primary contact flag |

**Role Enum:** `borrower`, `co_borrower`, `realtor`, `title_agent`, `insurance_agent`
**Timestamps:** Yes

---

### EncompassSyncLog

**Collection:** `encompasssynclogs`
**File:** `src/models/EncompassSyncLog.js`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `loan` | `ObjectId` → LoanApplication | Yes | - | Associated loan |
| `syncType` | `String` | Yes | - | Type of sync operation |
| `direction` | `String` | Yes | - | Sync direction |
| `status` | `String` | No | `'pending'` | Sync status |
| `encompassLoanId` | `String` | No | - | Encompass GUID |
| `dataSnapshot` | `Object` | No | - | Data at time of sync |
| `errorMessage` | `String` | No | - | Error details if failed |
| `syncDuration` | `Number` | No | - | Duration in ms |

**syncType Enum:** `loan_create`, `loan_update`, `document_upload`, `milestone_update`, `contact_sync`, `status_change`, `field_update`, `full_sync`
**Direction Enum:** `outbound`, `inbound`
**Status Enum:** `pending`, `in_progress`, `completed`, `failed`
**Timestamps:** Yes

---

## 3. Documents

### Document

**Collection:** `documents`
**File:** `src/models/Document.js`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `loan` | `ObjectId` → LoanApplication | Yes | - | Associated loan |
| `uploadedBy` | `ObjectId` → User | Yes | - | Uploader reference |
| `owner` | `ObjectId` → User | No | - | Document owner |
| `name` | `String` | Yes | - | Document name |
| `type` | `String` | Yes | - | File type |
| `size` | `Number` | No | - | File size in bytes |
| `hash` | `String` | No | - | File content hash |
| `url` | `String` | No | - | Download URL |
| `storageKey` | `String` | No | - | Azure Blob storage key |
| `status` | `String` | No | `'pending'` | Review status |
| `avStatus` | `String` | No | - | Antivirus scan status |
| `scanned` | `Boolean` | No | `false` | Whether scanned |
| `versions` | `[Object]` | No | `[]` | Version history |
| `tempBlobExpiresAt` | `Date` | No | - | TTL for temporary blobs |

**Type Enum:** `pdf`, `png`, `jpg`, `jpeg`
**Status Enum:** `pending`, `approved`, `rejected`, `archived`, `deleted`
**Timestamps:** Yes

---

### DocumentUpload

**Collection:** `documentuploads`
**File:** `src/models/DocumentUpload.js`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `loan` | `ObjectId` → LoanApplication | No | - | Associated loan |
| `uploadedBy` | `ObjectId` → User | Yes | - | Uploader |
| `fileName` | `String` | Yes | - | Stored file name |
| `originalFileName` | `String` | Yes | - | Original file name |
| `fileSize` | `Number` | Yes | - | File size in bytes |
| `mimeType` | `String` | Yes | - | MIME type |
| `documentType` | `String` | No | `'other'` | Document category |
| `blobUrl` | `String` | Yes | - | Azure Blob URL |
| `blobContainer` | `String` | Yes | - | Azure container name |
| `blobName` | `String` | Yes | - | Azure blob name |
| `status` | `String` | No | `'uploaded'` | Upload status |
| `posSystem` | `String` | No | - | POS system origin |
| `metadata` | `Object` | No | `{}` | Additional metadata |
| `notifications.borrowerNotified` | `Boolean` | No | `false` | Borrower notification sent |
| `notifications.officerNotified` | `Boolean` | No | `false` | Officer notification sent |
| `expiresAt` | `Date` | No | - | Document expiration |

**documentType Enum:** `pay_stub`, `w2`, `tax_return`, `bank_statement`, `id_verification`, `property_appraisal`, `title_report`, `insurance`, `employment_verification`, `credit_authorization`, `other`
**Timestamps:** Yes

---

## 4. Rates & Pricing

### RateSnapshot

**Collection:** `ratesnapshots`
**File:** `src/models/RateSnapshot.js`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `productType` | `String` | Yes | - | Mortgage product type |
| `loanTerm` | `Number` | Yes | - | Term in years |
| `loanPurpose` | `String` | No | - | Purpose of loan |
| `rate` | `Number` | Yes | - | Interest rate |
| `apr` | `Number` | No | - | Annual percentage rate |
| `points` | `Number` | No | `0` | Discount points |
| `lockPeriod` | `Number` | No | `30` | Lock period in days |
| `adjustments` | `Object` | No | `{}` | Rate adjustments applied |
| `source` | `String` | No | - | Rate data source |
| `isActive` | `Boolean` | No | `true` | Currently active rate |
| `effectiveDate` | `Date` | No | `Date.now` | When rate takes effect |
| `expiresAt` | `Date` | No | - | Rate expiration |

**productType Enum:** `conventional`, `fha`, `va`, `usda`, `jumbo`
**Timestamps:** Yes

---

### ProductPricing

**Collection:** `productpricings`
**File:** `src/models/ProductPricing.js`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `productName` | `String` | Yes | - | Product display name |
| `productType` | `String` | Yes | - | Mortgage product type |
| `loanTerm` | `Number` | Yes | - | Term in years |
| `investorName` | `String` | No | - | Investor name |
| `baseRate` | `Number` | Yes | - | Base interest rate |
| `basePrice` | `Number` | No | - | Base price (par) |
| `minLoanAmount` | `Number` | No | `0` | Minimum loan amount |
| `maxLoanAmount` | `Number` | No | - | Maximum loan amount |
| `minLTV` | `Number` | No | `0` | Minimum LTV |
| `maxLTV` | `Number` | No | `100` | Maximum LTV |
| `minCreditScore` | `Number` | No | `620` | Minimum credit score |
| `allowedPropertyTypes` | `[String]` | No | `[]` | Allowed property types |
| `allowedOccupancy` | `[String]` | No | `[]` | Allowed occupancy types |
| `features` | `Object` | No | `{}` | Product features (MI, escrow, etc.) |
| `adjustments` | `Object` | No | - | Pricing adjustments |
| `isActive` | `Boolean` | No | `true` | Active product flag |

**productType Enum:** `conventional`, `fha`, `va`, `usda`, `jumbo`
**Timestamps:** Yes

---

### RateAlert

**Collection:** `ratealerts`
**File:** `src/models/RateAlert.js`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `user` | `ObjectId` → User | Yes | - | Alert subscriber |
| `productType` | `String` | Yes | - | Target product type |
| `loanTerm` | `Number` | Yes | - | Target loan term |
| `loanAmount` | `Number` | No | `300000` | Loan amount for quoting |
| `creditScore` | `Number` | No | `740` | Credit score for quoting |
| `ltv` | `Number` | No | `80` | LTV for quoting |
| `propertyType` | `String` | No | `'single_family'` | Property type |
| `targetRate` | `Number` | No | - | Target rate threshold |
| `triggerType` | `String` | Yes | - | Alert trigger condition |
| `dropAmount` | `Number` | No | - | Required rate drop (for `drops_by`) |
| `baselineRate` | `Number` | No | - | Baseline rate (for `drops_by`) |
| `notificationMethod` | `String` | No | `'push'` | How to notify |
| `status` | `String` | No | `'active'` | Alert status |
| `loan` | `ObjectId` → LoanApplication | No | - | Associated loan |
| `triggerHistory` | `[Object]` | No | `[]` | History of trigger events |
| `crmActivityId` | `String` | No | - | CRM activity reference |
| `expiresAt` | `Date` | No | - | Auto-expiry (TTL: 90 days) |

**triggerType Enum:** `below`, `above`, `drops_by`
**Status Enum:** `active`, `paused`, `triggered`, `expired`, `cancelled`
**notificationMethod Enum:** `push`, `sms`, `email`, `all`
**Timestamps:** Yes

---

### RateLock

**Collection:** `ratelocks`
**File:** `src/models/RateLock.js`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `loan` | `ObjectId` → LoanApplication | Yes | - | Associated loan |
| `borrower` | `ObjectId` → User | Yes | - | Borrower |
| `lockedBy` | `ObjectId` → User | Yes | - | Who locked the rate |
| `rateSnapshot` | `ObjectId` → RateSnapshot | No | - | Source rate snapshot |
| `lockedRate` | `Number` | Yes | - | Locked interest rate |
| `lockedAPR` | `Number` | No | - | Locked APR |
| `points` | `Number` | No | `0` | Discount points |
| `lockPeriod` | `Number` | Yes | - | Lock period in days |
| `lockExpiresAt` | `Date` | Yes | - | Lock expiration date |
| `status` | `String` | No | `'active'` | Lock status |
| `extensionHistory` | `[Object]` | No | `[]` | Extension records |
| `loanAmount` | `Number` | No | - | Loan amount at lock |
| `productType` | `String` | No | - | Product type |
| `pricing` | `Object` | No | `{}` | Pricing details at lock |
| `investorName` | `String` | No | - | Investor name |

**Status Enum:** `active`, `expired`, `extended`, `cancelled`, `exercised`, `floating`
**Timestamps:** Yes

---

## 5. Credit

### CreditReport

**Collection:** `creditreports`
**File:** `src/models/CreditReport.js`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `loan` | `ObjectId` → LoanApplication | Yes | - | Associated loan |
| `borrower` | `ObjectId` → User | Yes | - | Borrower |
| `requestedBy` | `ObjectId` → User | Yes | - | Requesting officer |
| `xactusReportId` | `String` | No | - | Xactus report identifier |
| `reportType` | `String` | No | `'full'` | Report type |
| `status` | `String` | No | `'pending'` | Report status |
| `scores` | `[creditScoreSchema]` | No | `[]` | Credit scores by bureau |
| `midScore` | `Number` | No | - | Middle credit score |
| `tradelines` | `[tradelineSchema]` | No | `[]` | Tradeline accounts |
| `publicRecords` | `[Object]` | No | `[]` | Public records |
| `inquiries` | `[Object]` | No | `[]` | Credit inquiries |
| `summary` | `Object` | No | `{}` | Report summary statistics |
| `encryptedData` | `String` | No | - | AES-256-CBC encrypted raw data |
| `expiresAt` | `Date` | No | - | FCRA retention (730 days TTL) |

**Embedded: creditScoreSchema**

| Field | Type | Description |
|-------|------|-------------|
| `bureau` | `String` | Bureau name: `equifax`, `experian`, `transunion` |
| `score` | `Number` | Credit score value |
| `factors` | `[String]` | Score factors |

**Embedded: tradelineSchema**

| Field | Type | Description |
|-------|------|-------------|
| `creditorName` | `String` | Creditor name |
| `accountType` | `String` | Account type |
| `balance` | `Number` | Current balance |
| `creditLimit` | `Number` | Credit limit |
| `monthlyPayment` | `Number` | Monthly payment |
| `status` | `String` | Account status |
| `dateOpened` | `Date` | Date opened |
| `paymentHistory` | `String` | Payment pattern |

**Encryption:** AES-256-CBC for `encryptedData` field
**Methods:** `encryptData()`, `decryptData()`
**Timestamps:** Yes

---

### CreditPullLog

**Collection:** `creditpulllogs`
**File:** `src/models/CreditPullLog.js`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `loan` | `ObjectId` → LoanApplication | Yes | - | Associated loan |
| `borrower` | `ObjectId` → User | Yes | - | Borrower |
| `requestedBy` | `ObjectId` → User | Yes | - | Requester |
| `creditReport` | `ObjectId` → CreditReport | No | - | Generated report |
| `pullType` | `String` | Yes | - | Type of pull |
| `purpose` | `String` | No | - | Pull purpose |
| `status` | `String` | No | `'pending'` | Pull status |
| `xactusTransactionId` | `String` | No | - | Xactus transaction ID |
| `cost` | `Number` | No | - | Cost of credit pull |
| `borrowerConsent.consented` | `Boolean` | No | `false` | Consent given |
| `borrowerConsent.consentedAt` | `Date` | No | - | Consent timestamp |
| `borrowerConsent.consentMethod` | `String` | No | - | How consent was obtained |

**pullType Enum:** `soft`, `hard`
**Timestamps:** Yes

---

## 6. Messaging & Notifications

### Message

**Collection:** `messages`
**File:** `src/models/Message.js`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `loan` | `ObjectId` → LoanApplication | No | - | Associated loan |
| `sender` | `ObjectId` → User | Yes | - | Message sender |
| `recipient` | `ObjectId` → User | Yes | - | Message recipient |
| `messageType` | `String` | No | `'text'` | Message type |
| `content` | `String` | Yes | - | Message body |
| `read` | `Boolean` | No | `false` | Read status |
| `readAt` | `Date` | No | - | When read |
| `metadata` | `Object` | No | `{}` | Additional metadata |
| `encompassSynced` | `Boolean` | No | `false` | Synced to Encompass |

**messageType Enum:** `text`, `system`, `document`, `milestone`
**Timestamps:** Yes

---

### SMSMessage

**Collection:** `smsmessages`
**File:** `src/models/SMSMessage.js`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `messageId` | `String` | Yes (unique) | - | Internal message ID |
| `twilioMessageSid` | `String` | No | - | Twilio message SID |
| `from` | `String` | Yes | - | Sender phone number |
| `to` | `String` | Yes | - | Recipient phone number |
| `sender` | `ObjectId` → User | No | - | Sender user reference |
| `recipient` | `ObjectId` → User | No | - | Recipient user reference |
| `loan` | `ObjectId` → LoanApplication | No | - | Associated loan |
| `body` | `String` | Yes | - | Message body |
| `direction` | `String` | Yes | - | Message direction |
| `messageType` | `String` | No | `'manual'` | Message type |
| `status` | `String` | No | `'queued'` | Delivery status |
| `threadId` | `String` | No | - | Conversation thread ID |
| `encompassSync.synced` | `Boolean` | No | `false` | Synced to Encompass |
| `encompassSync.syncedAt` | `Date` | No | - | Sync timestamp |
| `encompassSync.conversationLogId` | `String` | No | - | Encompass log ID |
| `compliance.purpose` | `String` | No | - | SMS purpose for compliance |
| `compliance.tcpa.consentGiven` | `Boolean` | No | `false` | TCPA consent flag |
| `compliance.tcpa.consentDate` | `Date` | No | - | Consent date |
| `compliance.retentionExpiresAt` | `Date` | No | - | Data retention expiry (TTL: 7 years) |
| `media` | `[Object]` | No | `[]` | Media attachments |
| `deliveryDetails` | `Object` | No | `{}` | Delivery metadata |

**Direction Enum:** `inbound`, `outbound`
**messageType Enum:** `manual`, `automated`, `notification`, `reminder`, `alert`, `milestone_update`
**Status Enum:** `queued`, `sent`, `delivered`, `failed`, `undelivered`, `received`, `read`
**Timestamps:** Yes

---

### Notification

**Collection:** `notifications`
**File:** `src/models/Notification.js`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `user` | `ObjectId` → User | Yes | - | Notification recipient |
| `type` | `String` | No | `'info'` | Notification type |
| `title` | `String` | Yes | - | Notification title |
| `body` | `String` | Yes | - | Notification body |
| `read` | `Boolean` | No | `false` | Read status |
| `metadata` | `Object` | No | `{}` | Additional data |

**Type Enum:** `info`, `status`, `rate_alert`, `message`
**Timestamps:** Yes

---

## 7. CRM

### CRMContact

**Collection:** `crmcontacts`
**File:** `src/models/CRMContact.js`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `user` | `ObjectId` → User | No | - | Linked user account |
| `crmContactId` | `String` | No (unique if set) | - | External CRM contact ID |
| `contactType` | `String` | Yes | - | Contact type |
| `firstName` | `String` | Yes | - | First name |
| `lastName` | `String` | Yes | - | Last name |
| `email` | `String` | No | - | Email address |
| `phone` | `String` | No | - | Phone number |
| `assignedTo` | `ObjectId` → User | No | - | Assigned loan officer |
| `tags` | `[String]` | No | `[]` | Contact tags |
| `status` | `String` | No | `'active'` | Contact status |
| `engagementScore` | `Number` | No | `0` | Engagement score (0-100) |
| `journeys` | `[Object]` | No | `[]` | Active CRM journeys |
| `customFields` | `Object` | No | `{}` | Custom CRM fields |

**contactType Enum:** `lead`, `prospect`, `borrower`, `past_client`, `referral_partner`
**Status Enum:** `active`, `inactive`, `do_not_contact`
**Timestamps:** Yes

---

### CRMJourney

**Collection:** `crmjourneys`
**File:** `src/models/CRMJourney.js`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `crmJourneyId` | `String` | No (unique if set) | - | External CRM journey ID |
| `name` | `String` | Yes | - | Journey name |
| `description` | `String` | No | - | Journey description |
| `triggerType` | `String` | Yes | - | What triggers enrollment |
| `status` | `String` | No | `'draft'` | Journey status |
| `steps` | `[Object]` | No | `[]` | Journey steps/actions |
| `targetAudience` | `Object` | No | `{}` | Audience targeting criteria |
| `metrics` | `Object` | No | `{}` | Journey performance metrics |

**triggerType Enum:** `manual`, `event`, `schedule`, `milestone`, `score_change`
**Status Enum:** `draft`, `active`, `paused`, `completed`, `archived`
**Timestamps:** Yes

---

### CRMSyncLog

**Collection:** `crmsynclogs`
**File:** `src/models/CRMSyncLog.js`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `syncType` | `String` | Yes | - | Type of CRM sync |
| `direction` | `String` | Yes | - | Sync direction |
| `status` | `String` | No | `'pending'` | Sync status |
| `recordsProcessed` | `Number` | No | `0` | Total records processed |
| `recordsSucceeded` | `Number` | No | `0` | Successful records |
| `recordsFailed` | `Number` | No | `0` | Failed records |
| `errorMessage` | `String` | No | - | Error details |
| `dataSnapshot` | `Object` | No | - | Data at time of sync |
| `syncDuration` | `Number` | No | - | Duration in ms |

**Timestamps:** Yes

---

### CRMActivityLog

**Collection:** `crmactivitylogs`
**File:** `src/models/CRMActivityLog.js`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `crmContact` | `ObjectId` → CRMContact | Yes | - | Associated CRM contact |
| `activityType` | `String` | Yes | - | Type of activity |
| `direction` | `String` | No | - | Activity direction |
| `subject` | `String` | No | - | Activity subject |
| `content` | `String` | No | - | Activity content |
| `metadata` | `Object` | No | `{}` | Additional data |
| `performedBy` | `ObjectId` → User | No | - | User who performed activity |
| `crmSynced` | `Boolean` | No | `false` | Synced to external CRM |
| `crmActivityId` | `String` | No | - | External CRM activity ID |

**activityType Enum:** `email`, `call`, `sms`, `meeting`, `note`, `task`, `document`, `milestone`
**Direction Enum:** `inbound`, `outbound`
**Timestamps:** Yes

---

## 8. POS Integration

### POSSession

**Collection:** `possessions`
**File:** `src/models/POSSession.js`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `sessionToken` | `String` | Yes (unique) | - | Encrypted session token |
| `sessionId` | `String` | Yes (unique) | - | Public session identifier |
| `user` | `ObjectId` → User | No | - | Borrower (if authenticated) |
| `loan` | `ObjectId` → LoanApplication | No | - | Associated loan |
| `loanOfficer` | `ObjectId` → User | No | - | Originating loan officer |
| `referralSource` | `ObjectId` → ReferralSource | No | - | Referral source |
| `posSystem` | `String` | No | `'internal'` | POS system name |
| `encryptedData` | `String` | No | - | AES-256-CBC encrypted session data |
| `purpose` | `String` | No | `'application'` | Session purpose |
| `source` | `String` | No | `'direct'` | Session origin |
| `status` | `String` | No | `'pending'` | Session status |
| `handoffUrl` | `String` | No | - | POS redirect URL |
| `returnUrl` | `String` | No | - | Return URL after completion |
| `analytics.startedAt` | `Date` | No | - | Session start time |
| `analytics.completedAt` | `Date` | No | - | Session completion time |
| `analytics.timeSpent` | `Number` | No | - | Time in seconds |
| `analytics.stepsCompleted` | `Number` | No | `0` | Steps completed |
| `analytics.deviceType` | `String` | No | - | Device type |
| `branding` | `Object` | No | `{}` | Co-branding settings |
| `completionData` | `Object` | No | `{}` | Data returned on completion |
| `errors` | `[Object]` | No | `[]` | Error log |
| `auditLog` | `[Object]` | No | `[]` | Session audit trail |

**Status Enum:** `pending`, `active`, `completed`, `expired`, `failed`, `abandoned`
**Purpose Enum:** `application`, `preapproval`, `refinance`, `document_upload`
**Encryption:** AES-256-CBC for `encryptedData`
**Methods:** `encryptSessionData()`, `decryptSessionData()`
**Timestamps:** Yes

---

## 9. Dashboard & Analytics

### DashboardReport

**Collection:** `dashboardreports`
**File:** `src/models/DashboardReport.js`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `reportName` | `String` | Yes | - | Report display name |
| `reportType` | `String` | Yes | - | Report category |
| `powerBIReportId` | `String` | No | - | Power BI report GUID |
| `powerBIDatasetId` | `String` | No | - | Power BI dataset GUID |
| `powerBIWorkspaceId` | `String` | No | - | Power BI workspace GUID |
| `accessLevel` | `String` | No | `'View'` | Power BI access level |
| `allowedRoles` | `[String]` | No | `[]` | Roles with access |
| `defaultFilters` | `Object` | No | `{}` | Default report filters |
| `refreshSchedule` | `String` | No | - | Data refresh schedule |
| `isActive` | `Boolean` | No | `true` | Report active flag |

**reportType Enum:** `pipeline`, `production`, `branch`, `officer`, `marketing`, `compliance`
**Timestamps:** Yes

---

### DashboardMetric

**Collection:** `dashboardmetrics`
**File:** `src/models/DashboardMetric.js`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `metricType` | `String` | Yes | - | Type of metric |
| `periodType` | `String` | Yes | - | Aggregation period |
| `periodStart` | `Date` | Yes | - | Period start date |
| `periodEnd` | `Date` | Yes | - | Period end date |
| `user` | `ObjectId` → User | No | - | Specific user (if applicable) |
| `branch` | `String` | No | - | Branch code |
| `region` | `String` | No | - | Region name |
| `aggregationLevel` | `String` | No | `'individual'` | Aggregation level |
| `value` | `Number` | Yes | - | Metric value |
| `byProductType` | `Object` | No | `{}` | Breakdown by product type |
| `byLoanSource` | `Object` | No | `{}` | Breakdown by loan source |
| `previousPeriodValue` | `Number` | No | - | Previous period comparison |
| `percentChange` | `Number` | No | - | Period-over-period change |

**metricType Enum:** `loan_volume`, `loan_count`, `pull_through`, `average_loan_size`, `pipeline_value`, `applications_received`, `preapprovals_issued`, `average_days_to_close`, `conversion_rate`
**periodType Enum:** `daily`, `weekly`, `monthly`, `quarterly`, `yearly`
**aggregationLevel Enum:** `individual`, `branch`, `region`, `company`
**Timestamps:** Yes

---

### BranchPerformance

**Collection:** `branchperformances`
**File:** `src/models/BranchPerformance.js`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `branchCode` | `String` | Yes | - | Branch identifier |
| `branchName` | `String` | Yes | - | Branch name |
| `region` | `String` | No | - | Region |
| `branchManager` | `ObjectId` → User | No | - | Branch manager |
| `periodType` | `String` | Yes | - | Aggregation period |
| `teamSize.loanOfficers` | `Number` | No | `0` | LO count |
| `teamSize.processors` | `Number` | No | `0` | Processor count |
| `teamSize.underwriters` | `Number` | No | `0` | Underwriter count |
| `applications` | `Object` | No | `{}` | Application metrics (received, approved, denied, withdrawn) |
| `preapprovals` | `Object` | No | `{}` | Preapproval metrics |
| `pipeline` | `Object` | No | `{}` | Pipeline metrics (count, value, avg age) |
| `funded` | `Object` | No | `{}` | Funded metrics (count, volume, avg size, avg days to close) |
| `KPIs` | `Object` | No | `{}` | Key performance indicators |
| `goals` | `Object` | No | `{}` | Branch goals |
| `goalAttainment` | `Object` | No | `{}` | Goal achievement metrics |
| `monthOverMonth` | `Object` | No | `{}` | MoM comparisons |
| `yearOverYear` | `Object` | No | `{}` | YoY comparisons |

**periodType Enum:** `daily`, `weekly`, `monthly`, `quarterly`, `yearly`
**Timestamps:** Yes

---

## 10. Referral Sources

### ReferralSource

**Collection:** `referralsources`
**File:** `src/models/ReferralSource.js`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | `String` | Yes | - | Contact name |
| `type` | `String` | Yes | - | Source type |
| `companyName` | `String` | No | - | Company name |
| `email` | `String` | No | - | Email address |
| `phone` | `String` | No | - | Phone number |
| `website` | `String` | No | - | Website URL |
| `address` | `Object` | No | `{}` | Full address |
| `branding` | `Object` | No | `{}` | Co-branding settings (logo, colors) |
| `socialMedia` | `Object` | No | `{}` | Social media links |
| `licenseNumber` | `String` | No | - | Professional license |
| `assignedLoanOfficer` | `ObjectId` → User | No | - | Assigned LO |
| `partnershipTier` | `String` | No | `'standard'` | Partnership level |
| `coBrandingSettings` | `Object` | No | `{}` | Co-branding config |
| `analytics` | `Object` | No | `{}` | Aggregate analytics |
| `status` | `String` | No | `'active'` | Source status |
| `notes` | `String` | No | - | Internal notes |

**Type Enum:** `realtor`, `builder`, `financial_advisor`, `insurance_agent`, `attorney`, `other`
**partnershipTier Enum:** `standard`, `preferred`, `elite`
**Status Enum:** `active`, `inactive`, `pending`
**Timestamps:** Yes

---

### ReferralSourceAnalytics

**Collection:** `referralsourceanalytics`
**File:** `src/models/ReferralSourceAnalytics.js`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `referralSource` | `ObjectId` → ReferralSource | Yes | - | Source reference |
| `periodType` | `String` | Yes | - | Aggregation period |
| `periodDate` | `Date` | Yes | - | Period date |
| `leads` | `Object` | No | `{}` | Lead metrics (total, new, returning) |
| `applications` | `Object` | No | `{}` | App metrics (total, started, submitted, conversionRate) |
| `preapprovals` | `Object` | No | `{}` | Preapproval metrics |
| `loans` | `Object` | No | `{}` | Pipeline metrics (inProgress, underwriting, approved, funded, withdrawn, denied) |
| `revenue` | `Object` | No | `{}` | Revenue metrics (totalLoanVolume, avgLoanAmount, estimatedCommission) |
| `engagement` | `Object` | No | `{}` | Engagement metrics (emailOpens/Clicks, appLogins, docsUploaded, messages) |
| `coBrandingUsage` | `Object` | No | `{}` | Co-branding usage stats |
| `productTypes` | `[Object]` | No | `[]` | Breakdown by product type |

**periodType Enum:** `daily`, `monthly`, `yearly`
**Statics:** `getAnalyticsByDateRange()`, `getTopPerformers()`, `createOrUpdatePeriod()`
**Timestamps:** Yes

---

## 11. Business Cards & Preapproval

### BusinessCard

**Collection:** `businesscards`
**File:** `src/models/BusinessCard.js`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `user` | `ObjectId` → User | Yes (unique) | - | Card owner |
| `slug` | `String` | Yes (unique) | - | URL-safe card identifier |
| `nmls` | `String` | No | - | NMLS number |
| `title` | `String` | No | - | Job title |
| `photo` | `String` | No | - | Profile photo URL |
| `bio` | `String` | No | - | Bio text |
| `phone` | `String` | No | - | Phone number |
| `email` | `String` | No | - | Email address |
| `branch.name` | `String` | No | - | Branch name |
| `branch.address` | `String` | No | - | Branch address |
| `socialLinks` | `Object` | No | `{}` | Social media links |
| `referralSource` | `ObjectId` → ReferralSource | No | - | Default referral source |
| `branding` | `Object` | No | `{}` | Branding (logo, colors, companyName) |
| `qrCode` | `String` | No | - | QR code URL |
| `applyNowUrl` | `String` | No | - | Apply now link |
| `stats.views` | `Number` | No | `0` | View count |
| `stats.applies` | `Number` | No | `0` | Apply click count |
| `stats.shares` | `Number` | No | `0` | Share count |
| `isActive` | `Boolean` | No | `true` | Card active flag |
| `isPublic` | `Boolean` | No | `true` | Public visibility |
| `customDomain` | `String` | No | - | Custom domain |

**Timestamps:** Yes

---

### PreapprovalLetter

**Collection:** `preapprovalletters`
**File:** `src/models/PreapprovalLetter.js`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `loan` | `ObjectId` → LoanApplication | Yes | - | Associated loan |
| `borrower` | `ObjectId` → User | Yes | - | Borrower |
| `loanOfficer` | `ObjectId` → User | Yes | - | Issuing loan officer |
| `letterNumber` | `String` | Yes (unique) | - | Unique letter number |
| `borrowerData` | `Object` | No | `{}` | Borrower snapshot (name, address, SSN last 4) |
| `loanData` | `Object` | No | `{}` | Loan details (amount, type, term, rate, property type) |
| `creditData` | `Object` | No | `{}` | Credit snapshot (midScore, date pulled) |
| `referralSource` | `ObjectId` → ReferralSource | No | - | Referral source |
| `branding` | `Object` | No | `{}` | Co-branding (companyLogo, lenderLogo, colors, disclaimer) |
| `pdfUrl` | `String` | No | - | Generated PDF URL |
| `status` | `String` | No | `'draft'` | Letter status |
| `encompassData` | `Object` | No | `{}` | Encompass sync data |
| `expirationDate` | `Date` | No | - | Letter expiration |
| `conditions` | `[String]` | No | `[]` | Letter conditions |
| `disclaimers` | `[String]` | No | `[]` | Legal disclaimers |
| `signatures` | `Object` | No | `{}` | Digital signatures (loanOfficer, borrower) |
| `sharing` | `Object` | No | `{}` | Sharing settings (sharedWith[], publicLink, accessCode) |
| `viewHistory` | `[Object]` | No | `[]` | View tracking log |

**Status Enum:** `draft`, `issued`, `expired`, `revoked`, `superseded`
**Timestamps:** Yes

---

## 12. Consent & Privacy

### ConsentManagement

**Collection:** `consentmanagements`
**File:** `src/models/ConsentManagement.js`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `borrower` | `ObjectId` → User | Yes | - | Borrower granting consent |
| `grantedTo` | `ObjectId` → User | Yes | - | User receiving consent |
| `grantedToRole` | `String` | No | - | Role of consent receiver |
| `loan` | `ObjectId` → LoanApplication | No | - | Associated loan |
| `dataScope.creditReport` | `Boolean` | No | `false` | Credit report access |
| `dataScope.incomeDocuments` | `Boolean` | No | `false` | Income doc access |
| `dataScope.loanApplication` | `Boolean` | No | `false` | Loan app access |
| `dataScope.personalInfo` | `Boolean` | No | `false` | Personal info access |
| `dataScope.propertyInfo` | `Boolean` | No | `false` | Property info access |
| `dataScope.communicationHistory` | `Boolean` | No | `false` | Communication access |
| `purpose` | `String` | Yes | - | Consent purpose |
| `status` | `String` | No | `'active'` | Consent status |
| `expiresAt` | `Date` | No | - | Consent expiration |
| `revokedAt` | `Date` | No | - | Revocation timestamp |
| `revokedBy` | `ObjectId` → User | No | - | Who revoked |
| `consentText` | `String` | No | - | Legal consent text shown |
| `autoRenew` | `Boolean` | No | `false` | Auto-renewal flag |
| `notificationPreferences` | `Object` | No | `{}` | Notification settings |
| `auditLog` | `[Object]` | No | `[]` | Consent change history |

**Purpose Enum:** `loan_processing`, `credit_check`, `document_sharing`, `marketing`, `referral_sharing`, `third_party_sharing`
**Status Enum:** `active`, `revoked`, `expired`, `pending`
**Timestamps:** Yes

---

## 13. Chatbot

### ChatbotSession

**Collection:** `chatbotsessions`
**File:** `src/models/ChatbotSession.js`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `sessionId` | `String` | Yes (unique) | - | Unique session ID |
| `user` | `ObjectId` → User | Yes | - | Session user |
| `loan` | `ObjectId` → LoanApplication | No | - | Associated loan |
| `status` | `String` | No | `'active'` | Session status |
| `messages` | `[messageSchema]` | No | `[]` | Chat message history |
| `context.userRole` | `String` | No | - | User's role in session |
| `context.currentLoanId` | `String` | No | - | Active loan context |
| `context.recentTopics` | `[String]` | No | `[]` | Recent discussion topics |
| `context.preferredLanguage` | `String` | No | `'en'` | User's preferred language |
| `escalation.escalated` | `Boolean` | No | `false` | Escalation flag |
| `escalation.escalatedAt` | `Date` | No | - | When escalated |
| `escalation.escalatedTo` | `ObjectId` → User | No | - | Escalated to user |
| `escalation.escalationReason` | `String` | No | - | Reason for escalation |
| `escalation.escalationType` | `String` | No | - | Escalation channel |
| `escalation.resolvedAt` | `Date` | No | - | Resolution timestamp |
| `escalation.resolutionNotes` | `String` | No | - | Resolution notes |
| `dataSources` | `[dataSourceSchema]` | No | `[]` | Data sources consulted |
| `metadata.deviceType` | `String` | No | - | Device type |
| `metadata.ipAddress` | `String` | No | - | Client IP |
| `metadata.userAgent` | `String` | No | - | User agent |
| `metadata.startedAt` | `Date` | No | `Date.now` | Session start |
| `metadata.lastMessageAt` | `Date` | No | `Date.now` | Last message time |
| `metadata.endedAt` | `Date` | No | - | Session end |
| `metadata.sessionDuration` | `Number` | No | - | Duration in seconds |
| `metadata.messageCount` | `Number` | No | `0` | Message count |
| `metadata.satisfactionRating` | `Number` | No | - | Rating (1-5) |
| `metadata.feedbackText` | `String` | No | - | Feedback text |
| `settings.voiceEnabled` | `Boolean` | No | `false` | Voice mode |
| `settings.autoEscalate` | `Boolean` | No | `false` | Auto-escalation |
| `settings.maxIdleMinutes` | `Number` | No | `30` | Idle timeout |

**Status Enum:** `active`, `escalated`, `resolved`, `closed`
**escalationType Enum:** `teams`, `in_app_chat`, `sms`, `email`
**TTL:** Closed sessions auto-delete after 90 days

**Embedded: messageSchema**

| Field | Type | Description |
|-------|------|-------------|
| `role` | `String` | `user`, `assistant`, `system`, `function` |
| `content` | `String` | Message content |
| `functionCall` | `Object` | Function call details (name, arguments) |
| `functionResponse` | `Object` | Function response (name, content) |
| `timestamp` | `Date` | Message timestamp |

**Embedded: dataSourceSchema**

| Field | Type | Description |
|-------|------|-------------|
| `source` | `String` | `encompass`, `crm`, `pos`, `faq`, `calculator`, `rates`, `guidelines` |
| `query` | `String` | Query sent |
| `response` | `String` | Response received |
| `timestamp` | `Date` | Timestamp |

**Timestamps:** Yes

---

## 14. Persona & Views

### PersonaView

**Collection:** `personaviews`
**File:** `src/models/PersonaView.js`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `user` | `ObjectId` → User | Yes (unique) | - | View owner |
| `role` | `String` | Yes | - | User role |
| `viewConfiguration.dashboard.layout` | `String` | No | `'default'` | Dashboard layout |
| `viewConfiguration.dashboard.widgets` | `[Object]` | No | `[]` | Dashboard widgets config |
| `viewConfiguration.dashboard.defaultFilters` | `Object` | No | `{}` | Default dashboard filters |
| `viewConfiguration.navigation` | `Object` | No | `{}` | Navigation overrides |
| `viewConfiguration.notifications` | `Object` | No | `{}` | Notification preferences |
| `viewConfiguration.dataVisibility` | `Object` | No | `{}` | Data visibility rules |
| `viewConfiguration.preferences` | `Object` | No | `{}` | General preferences |
| `viewConfiguration.branding` | `Object` | No | `{}` | Branding overrides |

**Statics:** `getDefaultConfig(role)` — returns role-specific default configuration
**Timestamps:** Yes

---

## 15. Menu & Navigation

### Menu

**Collection:** `menus`
**File:** `src/models/Menu.js`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `alias` | `String` | Yes (unique) | - | Menu item alias |
| `label` | `String` | Yes | - | Display label |
| `icon` | `String` | Yes | - | Icon identifier |
| `route` | `String` | Yes | - | Navigation route |
| `type` | `String` | Yes | - | Navigation type |
| `slug` | `String` | Yes | - | URL-safe identifier |
| `content` | `Mixed` | No | `null` | Arbitrary content data |
| `order` | `Number` | Yes | - | Display order |
| `visible` | `Boolean` | Yes | - | Visibility flag |
| `override` | `Boolean` | No | `false` | Override flag |
| `roles` | `[String]` | Yes | - | Roles with access |
| `analytics.views` | `Number` | No | - | View count |
| `analytics.uniqueUsers` | `Number` | No | - | Unique user count |
| `analytics.lastAccessed` | `String` | No | - | Last access time |

**Type Enum:** `drawer`, `tab`, `stack`
**Timestamps:** Yes

---

### MenuConfig

**Collection:** `menuconfigs`
**File:** `src/models/MenuConfig.js`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `key` | `String` | Yes (unique) | - | Configuration key |
| `value` | `Mixed` | Yes | - | Configuration value (any type) |

**Timestamps:** Yes

---

### MenuVersion

**Collection:** `menuversions`
**File:** `src/models/menuVersion.js`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `version` | `Number` | Yes | - | Version number |
| `menus` | `Array` | Yes | - | Menu snapshot at this version |
| `createdBy` | `ObjectId` → User | No | - | Version creator |
| `createdAt` | `Date` | No | `Date.now` | Creation date |
| `comment` | `String` | No | - | Version comment |

---

### Screen

**Collection:** `screens`
**File:** `src/models/Screen.js`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `slug` | `String` | Yes (unique) | - | Screen identifier |
| `title` | `String` | Yes | - | Screen title |
| `route` | `String` | Yes | - | Navigation route |
| `navigation` | `navigationSchema` | Yes | - | Navigation configuration |
| `roles` | `[String]` | No | `[]` | Allowed roles |
| `tenant_scope` | `[String]` | No | `[]` | Tenant scope |
| `components` | `[componentSchema]` | No | `[]` | Screen components |
| `status` | `String` | No | `'draft'` | Screen status |
| `version` | `Number` | No | `1` | Screen version |

**Status Enum:** `draft`, `published`

**Embedded: navigationSchema**

| Field | Type | Description |
|-------|------|-------------|
| `type` | `String` | `drawer`, `tab`, `stack`, `modal` |
| `icon` | `String` | Icon identifier |
| `order` | `Number` | Display order |

**Embedded: componentSchema**

| Field | Type | Description |
|-------|------|-------------|
| `type` | `String` | Component type identifier |
| `props` | `Mixed` | Component properties |

**Timestamps:** Yes

---

### NavigationConfig

**Collection:** `navigationconfigs`
**File:** `src/models/NavigationConfig.js`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `type` | `String` | Yes | - | Navigation type |
| `role` | `String` | Yes | - | Target role |
| `items` | `[itemsSchema]` | No | `[]` | Navigation items |

**Type Enum:** `drawer`, `tab`, `stack`, `modal`
**Unique Index:** `{type, role}`

**Embedded: itemsSchema**

| Field | Type | Description |
|-------|------|-------------|
| `screen_slug` | `String` | Screen reference |
| `order` | `Number` | Display order |

**Timestamps:** Yes

---

## 16. CMS & Feature Management

### FeatureFlag

**Collection:** `featureflags`
**File:** `src/models/FeatureFlag.js`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `key` | `String` | Yes (unique) | - | Feature flag key |
| `enabled` | `Boolean` | No | `false` | Feature enabled |
| `roles` | `[String]` | No | `[]` | Roles with access |
| `min_app_version` | `String` | No | - | Minimum app version |

**Timestamps:** Yes

---

### ComponentRegistryItem

**Collection:** `componentregistryitems`
**File:** `src/models/ComponentRegistryItem.js`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `type` | `String` | Yes (unique) | - | Component type identifier |
| `allowed_props` | `Mixed` | No | `{}` | Allowed component properties |
| `allowed_actions` | `[String]` | No | `[]` | Allowed action identifiers |
| `supports_actions` | `Boolean` | No | `false` | Whether component supports actions |
| `status` | `String` | No | `'active'` | Component status |

**Status Enum:** `active`, `inactive`
**Timestamps:** Yes

---

## Cross-Reference: Model Relationships

```
User ──────────┬──→ Role ──→ [Capability]
               │
               ├──→ LoanApplication ──→ ReferralSource
               │         │
               │         ├──→ Document
               │         ├──→ DocumentUpload
               │         ├──→ LoanContact
               │         ├──→ Message
               │         ├──→ EncompassSyncLog
               │         ├──→ CreditReport ──→ CreditPullLog
               │         ├──→ RateLock ──→ RateSnapshot
               │         ├──→ PreapprovalLetter
               │         ├──→ ConsentManagement
               │         ├──→ SMSMessage
               │         └──→ POSSession
               │
               ├──→ Notification
               ├──→ RefreshToken
               ├──→ RateAlert
               ├──→ BusinessCard
               ├──→ PersonaView
               ├──→ ChatbotSession
               └──→ CRMContact ──→ CRMActivityLog
                                 ──→ CRMJourney

ReferralSource ──→ ReferralSourceAnalytics

Standalone:
  ├── ProductPricing
  ├── RateSnapshot
  ├── DashboardReport
  ├── DashboardMetric
  ├── BranchPerformance
  ├── AuditLog
  ├── CRMSyncLog
  ├── Menu / MenuConfig / MenuVersion
  ├── Screen / NavigationConfig
  ├── FeatureFlag
  └── ComponentRegistryItem
```

---

## Security Notes

| Feature | Models Using It |
|---------|----------------|
| **AES-256-CBC Encryption** | `CreditReport`, `POSSession` |
| **Bcrypt Password Hashing** | `User` (salt rounds: 10) |
| **SHA-256 Token Hashing** | `RefreshToken` |
| **TTL Auto-Expiration** | `RefreshToken`, `RateAlert` (90d), `ChatbotSession` (90d), `CreditReport` (730d FCRA), `SMSMessage` (7yr retention) |
| **RBAC via ObjectId→Role** | `User` → `Role` → `[Capability]` |

---

*Total Models: 41 | Generated: 2026-02-23*
