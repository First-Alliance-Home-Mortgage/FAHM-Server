# FAHM Server - AI Coding Assistant Instructions

## Project Overview
Node.js REST API backend for FAHM mobile app using Express, MongoDB (Mongoose), JWT auth with role-based access control. No frontend - API-only server for loan application management.

## Architecture & Core Patterns

### Request Flow
`server.js` bootstraps → `app.js` mounts middleware & routes → `/api/v1/*` routes → `authenticate` middleware → `authorize` middleware → controller → model → response

### Role-Based Access Control
Seven distinct roles in `config/roles.js`: `borrower`, `loan_officer_tpo`, `loan_officer_retail`, `broker`, `branch_manager`, `realtor`, `admin`. Apply roles in routes using `authorize(roles.ADMIN, roles.LO_RETAIL)` after `authenticate` middleware. Borrowers see only their own loans (filtered in `loanController.list`).

### Error Handling Pattern
All async route handlers use `asyncHandler` wrapper (see `utils/asyncHandler.js`) or try-catch with `next(err)`. Use `http-errors` package: `createError(404, 'Loan not found')`. Central error middleware in `middleware/error.js` logs and formats responses.

### Controllers & Validation
Controllers live in `controllers/`, handle business logic only. Use `express-validator` in routes (see `routes/loans.js` for examples). Always call `validationResult(req)` in controllers and return `createError(400, { errors: errors.array() })` on validation failure.

### Authentication Flow
JWT tokens via `tokenService.sign(user)` return 12h expiring tokens with `{ sub: userId, role, email }` payload. `authenticate` middleware extracts Bearer token, verifies, attaches `req.user` (without password field). Password hashing handled automatically in User model pre-save hook using bcryptjs.

## Models & Data Patterns

### User Model (`models/User.js`)
- Password field has `select: false` by default - must explicitly `.select('+password')` when comparing passwords
- Pre-save hook auto-hashes passwords only when modified
- Instance method `comparePassword(candidate)` returns Promise<boolean>

### LoanApplication Model (`models/LoanApplication.js`)
- Uses embedded `milestones` array (not separate collection) with schema `{ name, status, updatedAt }`
- References User docs via `borrower` and `assignedOfficer` ObjectIds
- Always `.populate('borrower', 'name email')` when returning loan data
- Encompass integration fields: `encompassLoanId`, `lastEncompassSync`, `encompassData`

### LoanContact Model (`models/LoanContact.js`)
- Stores assigned contacts for loans (Loan Officer, Processor, Underwriter, Closer)
- Links to both loan and user, includes Encompass ID for sync
- Indexed by loan and role for efficient queries

### Message Model (`models/Message.js`)
- In-app secure messaging between borrowers and loan team
- Auto-synced to Encompass via `encompassSynced` flag
- Supports text, system, document, and milestone message types

### Document Model (`models/Document.js`)
- References both `loan` (LoanApplication) and `uploadedBy` (User)
- `status` tracks sync state: `pending` → `synced` (for external system integration)
- `url` field stores document location (implementation stub - no actual file storage yet)

## Development Commands

```bash
npm run dev        # Run with nodemon (auto-restart)
npm start          # Production mode
npm run lint       # ESLint check
```

## Encompass Integration

### Auto-Sync Scheduler
- Runs every 15 minutes automatically (started in `server.js`)
- Syncs active loans (not 'funded') with Encompass LOS
- Updates milestones, contacts, and loan status
- Logs all sync operations in `EncompassSyncLog` model

### Manual Sync
- `POST /api/v1/encompass/loans/:id/sync` - Trigger immediate sync
- Returns updated loan data, contacts, and sync duration

### Messaging
- All in-app messages auto-logged to Encompass for compliance
- `encompassSynced` flag tracks sync status
- Bidirectional: app → Encompass (future: Encompass → app via webhooks)

### Service Layer (`services/encompassService.js`)
- OAuth 2.0 token management with automatic refresh
- Methods: `getLoanDetails`, `getLoanMilestones`, `getLoanContacts`, `updateLoanStatus`, `uploadDocument`, `sendMessage`
- Transforms Encompass data formats to FAHM schemas

## Total Expert CRM Integration

### Auto-Sync Scheduler
- Runs every 15 minutes automatically (started in `server.js`)
- Bidirectional sync: contacts, journeys, and activities
- Syncs FAHM users to CRM as contacts, imports marketing journeys
- Logs all sync operations in `CRMSyncLog` model

### CRM Models
- **CRMContact**: Stores borrower/partner contacts with engagement scores and journey enrollments
- **CRMJourney**: Marketing journey definitions with trigger types and steps
- **CRMActivityLog**: All in-app communications logged for CRM sync
- **CRMSyncLog**: Audit trail for sync operations

### Marketing Journeys
- Trigger journeys on milestone updates: `POST /api/v1/crm/loans/:id/trigger-milestone-journey`
- Manual enrollment: `POST /api/v1/crm/contacts/:contactId/journeys/:journeyId/enroll`
- Journey types: milestone_update, new_lead, application_submit, manual, scheduled

### Engagement Tracking
- `GET /api/v1/crm/contacts/:contactId/engagement` - Real-time engagement metrics
- Tracks email opens, clicks, SMS replies, and overall engagement score
- Displays active journeys and completion status in LO dashboards

### Activity Logging
- All in-app messages, notifications, and communications auto-logged to CRM
- `POST /api/v1/crm/contacts/:contactId/activities` - Manual activity logging
- Activity types: message, push_notification, email, sms, call, journey_step, milestone_update

### Service Layer (`services/totalExpertService.js`)
- OAuth 2.0 token management with automatic refresh
- Methods: `syncContact`, `getContactEngagement`, `enrollInJourney`, `triggerMilestoneJourney`, `logActivity`
- Transforms Total Expert data formats to FAHM schemas

## Xactus Credit Reporting Integration

### Credit Report Models
- **CreditReport**: Stores tri-merge reports with encryption, FCRA retention, scores, tradelines, public records
- **CreditPullLog**: Audit trail for all credit pulls with borrower consent tracking

### FCRA Compliance
- Automatic data expiration after 730 days (2 years per FCRA)
- Daily scheduler at 2 AM purges expired reports
- Daily warnings at 9 AM for reports expiring within 30 days
- AES-256-CBC encryption for sensitive raw credit data

### Credit Pull Flow
- `POST /api/v1/credit/loans/:loanId/request` - Request tri-merge report with borrower consent
- Validates SSN, DOB, address, and explicit borrower consent
- Stores encrypted raw data, calculates mid score from three bureaus
- Auto-notifies assigned LO when report completes

### Credit Data Access
- `GET /api/v1/credit/reports/:reportId` - Retrieve credit report (role-based access)
- `GET /api/v1/credit/loans/:loanId/reports` - All reports for a loan
- `POST /api/v1/credit/reports/:reportId/reissue` - Refresh/reissue existing report
- `GET /api/v1/credit/logs` - Audit trail for compliance

### Service Layer (`services/xactusService.js`)
- OAuth 2.0 token management with automatic refresh
- Methods: `requestTriMergeReport`, `getCreditReport`, `requestSoftPull`, `reissueReport`
- Transforms Xactus formats to FAHM schemas (scores, tradelines, public records, inquiries)
- Calculates mid score and credit utilization metrics

## Optimal Blue Rate & Pricing Integration

### Rate Models
- **RateSnapshot**: Daily rate sheets with compliance history (productType, loanTerm, rate, apr, points, lockPeriod, adjustments)
- **RateAlert**: User subscriptions for rate change notifications with trigger types (below, above, drops_by)
- **ProductPricing**: Investor product pricing details with LTV/credit/property requirements
- **RateLock**: Rate lock records with extension history and Optimal Blue sync

### Auto-Sync Scheduler
- Daily rate fetch at 7 AM (before market opens) for 10 product/term combinations
- Product pricing fetch at 7:15 AM
- Rate alert checks every 30 minutes during business hours (6 AM - 8 PM)
- Expired snapshot cleanup daily at 8 AM
- Logs all rate alerts to Total Expert CRM

### Rate Sheet Flow
- `GET /api/v1/rates/current` - Fetch real-time rates from Optimal Blue with loan scenario filters
- Saves snapshots automatically for compliance history (24-hour expiration)
- `GET /api/v1/rates/history` - Historical rates for trending and compliance audits
- `GET /api/v1/rates/products` - Product pricing with investor requirements

### Rate Alerts
- `POST /api/v1/rates/alerts` - Create rate alert with target rate and notification preferences (push/sms/email/all)
- Trigger types: below (rate <= target), above (rate >= target), drops_by (baseline - current >= dropAmount)
- `GET /api/v1/rates/alerts` - User's rate alerts filtered by status
- Auto-checks compare current rates to alerts, send notifications, log to CRM

### Rate Lock Management
- `POST /api/v1/rates/locks` - Submit rate lock request to Optimal Blue
- Links to loan and rate snapshot, updates loan interestRate and rateLockExpiresAt
- `POST /api/v1/rates/locks/:lockId/extend` - Extend lock period (LO only)
- Tracks extension history with fees, maintains investor confirmation numbers
- Lock statuses: pending, confirmed, extended, expired, released, cancelled

### Service Layer (`services/optimalBlueService.js`)
- OAuth 2.0 token management with automatic refresh
- Methods: `getRateSheet`, `getProductPricing`, `submitRateLock`, `extendRateLock`, `getRateLockDetails`, `releaseRateLock`
- Transforms Optimal Blue formats to FAHM schemas with product type, loan purpose, property type mappings

## Performance Dashboard Integration

### Dashboard Models
- **DashboardReport**: Power BI report metadata with access control (personal, branch, regional, company)
- **DashboardMetric**: Time-series KPI data (applications, preapprovals, funding rate, cycle time, pipeline)
- **BranchPerformance**: Branch-level aggregated metrics with team composition and goal attainment

### Power BI Embedded
- Azure AD authentication with cached tokens
- `getEmbedToken()` generates short-lived tokens for report embedding
- `getEmbedConfig()` returns full config with filters applied based on user role
- Row-level security via Power BI filters (user, branch, region)

### Metrics Aggregation
- Daily aggregation at 1 AM for all active loan officers
- Monthly aggregation on 1st of month at 2 AM
- Calculates: applications, preapprovals, funding rate, cycle time, avg loan amount, active pipeline
- Aggregates at user, branch, and regional levels with product type and loan source breakdowns

### Dashboard Endpoints
- `GET /api/v1/dashboard/reports` - Available reports for user role
- `GET /api/v1/dashboard/reports/:id/embed` - Power BI embed config with RLS filters
- `GET /api/v1/dashboard/my-kpis` - Personal KPI summary with real-time pipeline
- `GET /api/v1/dashboard/branch-performance` - Branch metrics (BM/Admin only)
- `GET /api/v1/dashboard/regional-performance` - Regional aggregation (Admin only)
- `GET /api/v1/dashboard/leaderboard` - Top performing LOs by metric
- `POST /api/v1/dashboard/reports/:id/refresh` - Trigger dataset refresh (BM/Admin)

### Access Control
- **Personal**: User sees only their own metrics (LOs, Borrowers)
- **Branch**: Branch Manager sees all LOs in their branch
- **Regional**: Regional managers see all branches in region
- **Company**: Admins see all data with full drill-down

### Service Layer (`services/powerBIService.js`)
- OAuth 2.0 with Azure AD for Power BI REST API
- Methods: `getEmbedToken`, `getReport`, `refreshDataset`, `pushData`, `createReportFilter`
- Supports both import and DirectQuery datasets with real-time push

## Mortgage Calculator Integration

### Calculator Features
- Enhanced mortgage payment calculator with true APR calculation including closing costs
- Optimal Blue rate integration for real-time pricing (falls back to database snapshots)
- Detailed amortization schedule generation for any month range
- "Apply Now" CTA generating POS handoff links with pre-filled loan data

### Calculator Endpoints
- `POST /api/v1/calculator` - Calculate payment with optional first 12 months amortization
- `GET /api/v1/calculator/rates` - Fetch current rates from Optimal Blue by product/term/credit
- `POST /api/v1/calculator/amortization` - Generate detailed schedule for specified month range
- `POST /api/v1/calculator/apply` - Generate secure POS link with pre-filled calculator inputs

### APR Calculation
- Uses Newton-Raphson method to solve for true APR including closing costs
- Formula: Solves for rate where PV of all payments equals loan amount minus fees
- Iterates to 0.0001 tolerance (max 100 iterations) for accurate APR
- Returns APR as percentage (e.g., 6.734 for 6.734%)

### Amortization Generation
- `generateAmortizationSchedule(principal, annualRate, termYears, startMonth, monthsToGenerate)`
- Fast-forwards to starting month, then generates requested range
- Returns: month number, payment, principal, interest, remaining balance for each month
- Supports partial schedules (e.g., months 120-132) or full 360-month schedule

### Rate Integration
- First checks RateSnapshot model for recent rates (within 24 hours)
- Falls back to `optimalBlueService.getRateSheet()` if no recent snapshots
- Saves fetched rates to database for future queries
- Returns default rates (6.5%, 6.65% APR) if external service fails
- Filters by: loanAmount, productType, loanTerm, creditScore, ltv

### POS Handoff
- `generateApplyLink()` creates secure URL with query params
- Pre-fills: loan_amount, product_type, loan_term, user_id, source=calculator
- Link expires in 1 hour (3600 seconds) for security
- Base URL from `process.env.POS_API_URL` (default: https://apply.fahm.com)
- Example: `https://apply.fahm.com/application/start?loan_amount=320000&product_type=conventional&loan_term=30&user_id=...&source=calculator`

### Calculator Controller (`controllers/calculatorController.js`)
- `calcMonthlyPayment()` - Standard mortgage formula: P * r / (1 - (1 + r)^-n)
- `calculateAPR()` - Newton-Raphson solver for true APR with fees
- `generateAmortizationSchedule()` - Month-by-month principal/interest breakdown
- `exports.calculate` - Main calculator with optional amortization in response
- `exports.getCurrentRates` - Fetch rates from Optimal Blue or database
- `exports.getAmortization` - Standalone amortization endpoint
- `exports.generateApplyLink` - POS handoff link generator

## Digital Business Card Integration

### Business Card Features
- Auto-generated from FAHM directory data (User model)
- Unique slug-based URLs for sharing (e.g., card.fahm.com/john-doe)
- QR code generation for referral sharing (base64 PNG data URL)
- Co-branding support with partner logos and custom colors
- "Apply Now" button linking to co-branded POS landing page
- Analytics tracking (views, applies, shares, conversion rate)

### Business Card Endpoints
- `POST /api/v1/business-cards` - Create/update card (auto-populated from user profile)
- `GET /api/v1/business-cards/me` - Get current user's card
- `GET /api/v1/business-cards/slug/:slug` - Public card view (increments views)
- `POST /api/v1/business-cards/slug/:slug/apply` - Track Apply Now click
- `POST /api/v1/business-cards/slug/:slug/share` - Track share (email/sms/social/qr)
- `GET /api/v1/business-cards/me/analytics` - View analytics (views/applies/conversion)
- `POST /api/v1/business-cards/me/regenerate-qr` - Regenerate QR code
- `GET /api/v1/business-cards` - List all cards (Admin/BM only)
- `DELETE /api/v1/business-cards/me` - Delete own card

### Card Data Structure
- Auto-populated from User: name, email, phone, nmls, title, photo, branch
- Optional fields: bio (500 char max), social links (LinkedIn, Facebook, Twitter, Instagram)
- Branding: primaryColor, secondaryColor, logo, partnerLogo, partnerName
- QR code: base64-encoded PNG data URL (300x300px, error correction level H)
- URLs: slug-based public URL, POS Apply Now URL with lo_id pre-fill
- Analytics: views, applies, shares counters, calculated conversion rate

### QR Code Generation
- Uses `qrcode` npm package (https://www.npmjs.com/package/qrcode)
- Encodes card URL (card.fahm.com/slug or custom domain)
- Error correction level H (high) for logo embedding compatibility
- 300x300px size with 1-unit margin
- Returns base64 data URL for direct embedding in mobile/web apps

### Co-Branding Support
- Partner logo URL and name stored in branding object
- Custom colors (primary/secondary) override FAHM defaults
- Apply Now URL includes lo_id and source=business_card for tracking
- Can use custom domain instead of card.fahm.com subdomain

### Analytics Tracking
- Views: incremented on each GET /slug/:slug (async, non-blocking)
- Applies: incremented when Apply Now button clicked
- Shares: incremented on share action (method: email/sms/social/qr)
- Conversion rate: (applies / views) * 100, returned in analytics endpoint

### Business Card Controller (`controllers/businessCardController.js`)
- `exports.createOrUpdate` - Create/update card with auto-population from User model
- `exports.getBySlug` - Public view with view tracking
- `exports.getMyCard` - Retrieve own card details
- `exports.trackApply` - Increment apply counter, return POS URL
- `exports.trackShare` - Increment share counter by method
- `exports.getAnalytics` - View stats and conversion rate
- `exports.regenerateQR` - Generate new QR code
- `exports.list` - Admin/BM list with search and pagination
- `exports.deleteCard` - Delete own card

## Document Upload to POS Integration

### Document Upload Features
- Secure multipart file upload (PDF, PNG, JPG formats)
- Azure Blob Storage for temporary holding before POS sync
- Automatic sync to Blend, Big POS, or Encompass Consumer Connect
- File validation (type, size max 10MB per file, max 5 files per request)
- LO/Processor notification on upload
- Real-time upload status tracking (uploaded → processing → synced/failed)
- Download and delete capabilities with role-based access control

### Document Upload Endpoints
- `POST /api/v1/document-uploads/upload` - Upload documents (multipart/form-data)
- `GET /api/v1/document-uploads/loan/:loanId` - Get all documents for loan
- `GET /api/v1/document-uploads/:id` - Get document details
- `GET /api/v1/document-uploads/:id/download` - Download document file
- `DELETE /api/v1/document-uploads/:id` - Delete document
- `POST /api/v1/document-uploads/:id/retry-sync` - Retry failed POS sync (LO/Admin)

### Document Upload Model (DocumentUpload)
- References: loan (LoanApplication), uploadedBy (User)
- File metadata: fileName, originalFileName, fileSize, mimeType
- Document types: paystub, w2, tax_return, bank_statement, id, proof_of_employment, appraisal, purchase_agreement, insurance, credit_report, other
- Azure Blob: blobUrl, blobContainer, blobName
- Status tracking: uploaded, processing, synced, failed, deleted
- POS integration: posSystem, posDocumentId, posSyncedAt, encompassDocId, encompassSyncedAt
- Notifications: loNotified, processorNotified flags with timestamps
- Metadata: uploadSource, ipAddress, userAgent, pageCount, isComplete

### File Upload Middleware
- Multer with memory storage for in-memory processing
- File type validation: only PDF, PNG, JPG/JPEG allowed
- File size limit: 10MB per file
- Max files per request: 5
- Custom error handling for clear error messages

### Azure Blob Service (`services/azureBlobService.js`)
- `uploadFile()` - Upload buffer to Azure Blob with metadata
- `downloadFile()` - Download file from blob storage
- `deleteFile()` - Remove file from blob storage
- `generateSasUrl()` - Create temporary access URL (60 min default)
- `blobExists()` - Check if blob exists
- Container: loan-documents (private access)
- Connection via AZURE_STORAGE_CONNECTION_STRING env var

### POS Upload Service (`services/posUploadService.js`)
- `uploadToBlend()` - Push document to Blend POS with OAuth token
- `uploadToBigPOS()` - Push document to Big POS API
- `uploadToEncompass()` - Push to Encompass Consumer Connect (base64 encoding)
- Token management: cached tokens with auto-refresh before expiry
- Error handling: logs failures, marks document as failed with validation errors

### Upload Workflow
1. User uploads file(s) via multipart form-data with loanId, documentType, description
2. Middleware validates file types and sizes
3. Files stored in memory as buffers
4. Upload to Azure Blob Storage with unique filename (loanId/documentType/uuid.ext)
5. Create DocumentUpload record with status "uploaded"
6. Background job: Download from blob, push to selected POS system (blend/big_pos/encompass)
7. On success: Update status to "synced", record posDocumentId
8. On failure: Mark as "failed" with validation errors
9. Async notification: Send notification to assigned LO and processor
10. Return upload results to user immediately (sync happens in background)

### Access Control
- Borrowers: Can upload/view/delete own loan documents
- Loan Officers: Can view/delete documents for assigned loans, retry failed syncs
- Processors: Can view documents for assigned loans
- Admins: Full access to all documents

### Document Upload Controller (`controllers/documentUploadController.js`)
- `exports.uploadDocument` - Handle multipart upload, Azure Blob storage, background POS sync
- `exports.getDocumentsByLoan` - List documents with filtering by status/type
- `exports.getDocument` - Get single document details
- `exports.downloadDocument` - Stream file from Azure Blob to client
- `exports.deleteDocument` - Soft delete (mark as deleted, remove from blob)
- `exports.retrySyncToPOS` - Manual retry for failed syncs (LO/Admin only)

## Preapproval Letter Generation Integration

### Preapproval Letter Features
- Branded PDF generation with PDFKit merging borrower and loan data from Encompass
- Co-branding support with referral partner logos and custom colors
- Multi-channel sharing: email (nodemailer), SMS (twilio), or in-app download
- Azure Blob Storage for PDF hosting with temporary SAS URLs
- 90-day default validity with configurable expiration
- Unique letter numbering system (PA-YYYY-NNNNNN format)
- View tracking and share history for analytics
- Automatic Encompass data sync during generation

### Preapproval Letter Endpoints
- `POST /api/v1/preapproval/generate` - Generate preapproval letter with Encompass data merge
- `GET /api/v1/preapproval/loan/:loanId` - Get all letters for loan
- `GET /api/v1/preapproval/:id` - Get letter details
- `GET /api/v1/preapproval/:id/download` - Download PDF (tracks views)
- `POST /api/v1/preapproval/:id/share` - Share via email/SMS/link
- `POST /api/v1/preapproval/:id/regenerate` - Regenerate PDF with updated data (LO/Admin)
- `DELETE /api/v1/preapproval/:id` - Soft delete letter (LO/Admin)

### Preapproval Letter Model (PreapprovalLetter)
- References: loan (LoanApplication), borrower (User), loanOfficer (User)
- Borrower data: primaryBorrower, coBorrower with full contact info
- Loan data: loanAmount, purchasePrice, downPayment, property details, terms
- Credit data: creditScore, verified income/assets flags
- Branding: logo, partnerLogo, partnerName, primaryColor, secondaryColor
- PDF storage: pdfUrl, pdfBlobName for Azure Blob retrieval
- Status tracking: draft, generated, sent, viewed, expired
- Encompass sync: encompassLoanId, lastSync, syncStatus
- Sharing: sharedViaEmail/SMS/InApp flags, shareHistory array with timestamps
- View tracking: viewHistory array with timestamps and IP addresses
- Methods: generateLetterNumber(), markSent(), trackView(), isExpired()

### PDF Generation Service (`services/pdfGenerationService.js`)
- `generatePreapprovalLetter()` - Create branded PDF with PDFKit
- Branded header with FAHM logo and company info
- Co-branding support with partner logo and name
- Formatted sections: borrower info, approval details, property info, conditions, disclaimers
- Digital signature placeholder for loan officer
- Professional styling with custom colors (#003B5C primary, #FF6B35 secondary)
- Returns: PDF buffer for Azure Blob upload
- Helper methods: formatCurrency(), formatLoanType(), formatPropertyType()

### Email Service (`services/emailService.js`)
- Nodemailer-based email sending with SMTP configuration
- `sendPreapprovalLetter()` - Email with PDF attachment
- `sendDownloadLink()` - Email with temporary SAS URL
- HTML email templates with responsive design
- Branded email with custom colors matching letter branding
- Email content: congratulations message, approval summary, next steps, LO contact info
- Configuration: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
- Returns: { success, messageId }

### SMS Service (`services/smsService.js`)
- Twilio-based SMS sending with E.164 phone number formatting
- `sendPreapprovalLink()` - SMS with download link (160 char limit)
- `sendPreapprovalNotification()` - In-app notification trigger
- Auto-formats phone numbers to E.164 standard (+1XXXXXXXXXX)
- Short message format: "Hi [FirstName]! Your mortgage pre-approval for $XXX,XXX is ready..."
- Configuration: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
- Returns: { success, messageSid, status }

### Preapproval Generation Workflow
1. LO initiates generation via POST /generate with loanId, validityDays, conditions, branding
2. Fetch loan application with borrower and assignedOfficer populated
3. Authorization check: Only assigned LO or admin can generate
4. Fetch Encompass data via encompassService.getLoanDetails() (fallback to loan app data)
5. Generate unique letter number (PA-YYYY-NNNNNN)
6. Calculate expiration date (90 days default)
7. Merge borrower, loan, credit, branding data into letterData object
8. Create PreapprovalLetter database record
9. Generate PDF with pdfGenerationService.generatePreapprovalLetter()
10. Upload PDF to Azure Blob Storage with path: preapproval-letters/{loanId}/{letterNumber}.pdf
11. Update PreapprovalLetter record with pdfUrl and pdfBlobName
12. Return letter summary to LO

### Sharing Workflow
1. User requests share via POST /:id/share with method (email/sms/link) and recipient
2. Authorization check: Borrower can share own, LO can share assigned loans
3. Check expiration: Return 410 Gone if letter expired
4. Generate temporary SAS URL with 24-hour expiration
5. For email: Download PDF from blob, send via emailService with attachment
6. For SMS: Send download link via smsService
7. For link: Return SAS URL directly
8. Track share in PreapprovalLetter.sharing.shareHistory
9. Mark letter status as 'sent'

### Access Control
- Borrowers: Can view/download/share own letters
- Loan Officers: Can generate/regenerate/delete letters for assigned loans, view all sharing history
- Branch Managers: Can view all letters in their branch
- Admins: Full access to all letters

### Preapproval Controller (`controllers/preapprovalController.js`)
- `exports.generate` - Generate letter with Encompass data merge, PDF generation, Azure upload
- `exports.getByLoan` - List letters for loan (borrowers see only own)
- `exports.get` - Get single letter details with populated references
- `exports.download` - Stream PDF from Azure Blob, track view
- `exports.share` - Multi-channel sharing with email/SMS/link support
- `exports.regenerate` - Regenerate PDF (delete old, create new)
- `exports.deletePreapproval` - Soft delete and remove PDF from blob

## Multi-Party Access Integration

### Multi-Party Access Features
- Role-based authentication with Azure AD B2C support
- Custom views by persona (borrower, LO, realtor, BM)
- Secure consent-based data sharing for referral partners
- Granular data scope control (personal info, financial info, loan details, documents, milestones, communications)
- Audit trail for all consent grants, revocations, and data access
- Automatic consent expiration with configurable validity periods
- Persona-specific dashboards with customizable widgets and layouts

### Consent Management Endpoints
- `POST /api/v1/consent/request` - Request consent from borrower (Realtor/Broker/LO)
- `POST /api/v1/consent/:id/grant` - Grant consent (Borrower only)
- `POST /api/v1/consent/:id/revoke` - Revoke consent (Borrower/Admin)
- `GET /api/v1/consent` - Get user's consents
- `GET /api/v1/consent/:id` - Get consent details with audit log
- `GET /api/v1/consent/check-access` - Check if user has access to borrower data
- `POST /api/v1/consent/:id/log-access` - Log consent access for audit trail

### Persona View Endpoints
- `GET /api/v1/persona-views/me` - Get user's persona view configuration
- `PATCH /api/v1/persona-views/me` - Update view configuration
- `POST /api/v1/persona-views/me/reset` - Reset to role-based defaults
- `GET /api/v1/persona-views/dashboard` - Get dashboard data with persona-specific filtering

### ConsentManagement Model
- References: borrower (User), grantedTo (User), loan (LoanApplication)
- Data scope flags: personalInfo, financialInfo, loanDetails, documents, milestones, communications
- Purpose tracking: referral_partnership, co_branding, transaction_coordination, market_analysis, compliance_review, other
- Status tracking: pending, active, revoked, expired
- Expiration: configurable expirationDays (default 365, max 730)
- Audit log: tracks created, granted, accessed, modified, revoked, expired actions
- Methods: grant(), revoke(), isValid(), logAccess(), hasDataScope()
- Static methods: hasActiveConsent(), expireConsents()

### PersonaView Model
- References: user (User), role (enum matching user roles)
- View configuration: dashboard (layout, widgets, defaultFilters), navigation (homeView, pinnedItems, hiddenMenuItems)
- Notification preferences: push/email/SMS enabled, category subscriptions, quiet hours
- Data visibility flags: role-specific (showCreditScore, showPipeline, showReferralStats, showBranchMetrics)
- Preferences: theme (light/dark/auto), language, dateFormat, currencyFormat, timezone
- Branding: logo, primaryColor, secondaryColor, partnerName, partnerLogo
- Default configurations: predefined layouts for borrower, LO (retail/TPO), realtor, broker, BM roles
- Static methods: getDefaultConfig(), createOrUpdate()

### Azure AD B2C Service (`services/azureADB2CService.js`)
- OAuth 2.0 authentication with Azure AD B2C
- `validateToken()` - Validate B2C token with JWKS verification
- `exchangeCodeForTokens()` - Exchange authorization code for access/ID/refresh tokens
- `refreshAccessToken()` - Refresh expired access token
- `provisionUser()` - Create or update user from B2C claims
- `mapClaimsToRole()` - Map extension attributes to FAHM roles
- `getAuthorizationUrl()` - Generate OAuth authorization URL
- `getLogoutUrl()` - Generate logout URL with redirect
- JWKS caching with 24-hour expiry and auto-refresh
- Configuration: AZURE_AD_B2C_TENANT_NAME, CLIENT_ID, CLIENT_SECRET, POLICY_NAME, SCOPE

### Consent Workflow
1. Realtor/Broker/LO requests consent via POST /request with borrowerId, dataScope, purpose, expirationDays
2. System creates ConsentManagement record with status "pending"
3. Borrower receives notification (in-app/email/SMS)
4. Borrower grants consent via POST /:id/grant (status → "active", logs grant action)
5. Partner accesses borrower data (checks hasActiveConsent() before data access)
6. All data access logged to auditLog with timestamp, performedBy, ipAddress
7. Borrower can revoke consent via POST /:id/revoke (status → "revoked", logs reason)
8. Automatic expiration: Daily cron job marks expired consents (status → "expired")

### Persona View Workflow
1. User logs in, system fetches PersonaView by userId
2. If not exists, create with getDefaultConfig() based on user role
3. Frontend renders dashboard with role-specific widgets and layout
4. User customizes view via PATCH /me (updates viewConfiguration)
5. Dashboard data endpoint applies defaultFilters and role-based access control
6. Borrower sees only own loans, LO sees assigned loans, BM sees branch team loans, Realtor sees consented loans
7. User can reset to defaults via POST /me/reset

### Access Control
- Consent requests: Realtor, Broker, LO can request consent
- Consent grants: Only borrower can grant own consent
- Consent revocations: Borrower can revoke own, Admin can revoke any
- Data access: Checked via hasActiveConsent() before returning borrower data
- Persona views: All authenticated users can manage own views
- Dashboard data: Role-based filtering applied in controller

### Consent Controller (`controllers/consentController.js`)
- `exports.requestConsent` - Create consent request with data scope and purpose
- `exports.grantConsent` - Borrower approves consent request
- `exports.revokeConsent` - Borrower or admin revokes consent with reason
- `exports.getConsents` - List consents (borrower sees granted, others see received)
- `exports.getConsent` - Get consent details with populated references and audit log
- `exports.checkAccess` - Verify if user has active consent for borrower data
- `exports.logAccess` - Log data access to consent audit trail
- `generateConsentText()` - Generate GLBA-compliant consent text

### Persona View Controller (`controllers/personaViewController.js`)
- `exports.getMyView` - Get or create user's persona view with defaults
- `exports.updateMyView` - Update view configuration (merge with existing)
- `exports.resetToDefault` - Reset to role-based default configuration
- `exports.getDashboardData` - Get dashboard data with role-based filtering
- `getBorrowerDashboard()` - Borrower's loans, documents, stats
- `getLODashboard()` - LO's pipeline with default filters applied
- `getRealtorDashboard()` - Referrals (loans with active consents)
- `getBrokerDashboard()` - Broker's submissions and stats
- `getBMDashboard()` - Branch team pipeline and performance
- `getAdminDashboard()` - Company-wide overview

## Co-Branding with Referral Sources Integration

### Co-Branding Features
- Referral partner (realtor, builder, financial planner) branding across all borrower touchpoints
- Customizable branding: logo, colors, tagline, custom messages
- Co-branded preapproval letters, business cards, and marketing emails
- Granular co-branding controls per feature (preapproval, business card, email, borrower view)
- Analytics tracking for referral source performance (leads, applications, funded loans, revenue)
- Time-series analytics with daily, monthly, yearly aggregations
- Partnership tier system (bronze, silver, gold, platinum)
- Automated activity tracking and conversion rate calculations

### Co-Branding Models
- **ReferralSource**: Tracks referral partners with branding, contact info, co-branding settings, analytics counters
- **ReferralSourceAnalytics**: Time-series performance data (leads, applications, loans, revenue, engagement, co-branding usage)

### Referral Source Data Structure
- Basic info: name, type (realtor/builder/financial_planner/attorney/cpa/other), companyName, contact details
- Branding: logo, primaryColor, secondaryColor, tagline, customMessage
- Social media: Facebook, Instagram, LinkedIn, Twitter links
- License: licenseNumber, licenseState
- Relationship: assignedLoanOfficer, partnershipTier, partnershipStartDate
- Co-branding settings: enablePreapprovalLetters, enableBusinessCards, enableEmailCommunications, enableBorrowerView, customDisclaimer
- Analytics counters: totalLeads, totalApplications, totalPreapprovals, totalFundedLoans, totalFundedVolume, conversionRate
- Status: active, inactive, suspended

### Analytics Tracking
- Time-series data by period (daily, monthly, yearly)
- Lead metrics: total, new, returning
- Application metrics: total, started, submitted, conversion rate
- Preapproval metrics: total, issued, used
- Loan pipeline: inProgress, underwriting, approved, funded, withdrawn, denied
- Revenue metrics: totalLoanVolume, averageLoanAmount, estimatedCommission
- Engagement metrics: emailOpens, emailClicks, appLogins, documentsUploaded, messagesExchanged
- Co-branding usage: preapprovalLettersGenerated, businessCardsViewed, coBrandedEmailsSent
- Product type breakdown: count and volume by conventional/fha/va/usda/jumbo/other

### Co-Branding Endpoints
- `POST /api/v1/referral-sources` - Create referral source (LO/BM/Admin)
- `GET /api/v1/referral-sources` - List referral sources with filtering (role-based access)
- `GET /api/v1/referral-sources/:id` - Get referral source details
- `PATCH /api/v1/referral-sources/:id` - Update referral source (assigned LO/BM/Admin)
- `DELETE /api/v1/referral-sources/:id` - Delete referral source (Admin only, prevents deletion if loans exist)
- `GET /api/v1/referral-sources/:id/analytics` - Get analytics with date range and period type
- `GET /api/v1/referral-sources/top-performers` - Get top performers by metric (BM/Admin)
- `GET /api/v1/referral-sources/:id/branding` - Get branding config (public, for co-branded views)
- `PATCH /api/v1/referral-sources/:id/branding` - Update branding and co-branding settings
- `POST /api/v1/referral-sources/:id/track` - Track activity (lead, application, preapproval, funded)

### Co-Branding Workflow
1. LO/Admin creates referral source via POST /referral-sources with branding assets
2. LO assigns referral source to loan application (referralSource field)
3. When generating preapproval letter: System checks if referralSource exists and co-branding enabled
4. If enabled: Fetch referral source branding via getBrandingConfig() method
5. Apply co-branding: Merge FAHM logo with partner logo, use partner colors, include partner name/tagline
6. Same workflow applies to business cards and email communications
7. Track activity: Auto-increment counters when loan milestones reached (lead → application → funded)
8. Analytics: Generate time-series records for performance tracking and dashboard display

### Model Integration
- LoanApplication model: Added referralSource reference (ObjectId to ReferralSource)
- PreapprovalLetter model: Added referralSource reference for tracking letter source
- BusinessCard model: Added referralSource reference for co-branded cards

### Controller Updates
- preapprovalController: Check loan.referralSource, fetch branding, apply to letter generation
- businessCardController: Accept referralSourceId, fetch branding, apply to card generation

### ReferralSource Model Methods
- `incrementLead()` - Increment lead counter, update lastReferralDate
- `incrementApplication()` - Increment application counter, recalculate conversion rate
- `incrementPreapproval()` - Increment preapproval counter
- `incrementFundedLoan(loanAmount)` - Increment funded loan counter and volume
- `getBrandingConfig()` - Return branding object for co-branded views
- `isCoBrandingEnabled(feature)` - Check if co-branding enabled for specific feature
- Static: `getTopPerformers(limit, metric)` - Get top performers sorted by metric
- Static: `getByLoanOfficer(loanOfficerId)` - Get referral sources assigned to LO

### ReferralSourceAnalytics Model Methods
- `calculateConversionRate()` - Recalculate application/lead conversion
- `calculateAverageLoanAmount()` - Recalculate average from total volume / funded count
- `addProductType(productType, loanAmount)` - Update product type breakdown
- Static: `getAnalyticsByDateRange(referralSourceId, startDate, endDate, periodType)` - Fetch time-series
- Static: `getTopPerformers(startDate, endDate, metric, limit)` - Aggregate top performers
- Static: `createOrUpdatePeriod(referralSourceId, periodType, periodDate, updateData)` - Upsert analytics record

### Access Control
- Referral source creation: LO, BM, Admin
- Referral source viewing: LO sees only assigned, BM sees branch sources, Admin sees all
- Referral source updates: Assigned LO, BM, Admin
- Referral source deletion: Admin only (prevents deletion if associated loans exist)
- Analytics viewing: Assigned LO, BM, Admin
- Top performers: BM, Admin only
- Branding config (public endpoint): No authentication required (for co-branded public views)

### Referral Source Controller (`controllers/referralSourceController.js`)
- `exports.create` - Create referral source with auto-assign to creator if LO
- `exports.list` - List with role-based filtering, search, pagination
- `exports.get` - Get single with populated references
- `exports.update` - Update with authorization check (prevents analytics manipulation)
- `exports.deleteReferralSource` - Soft delete with loan count validation
- `exports.getAnalytics` - Fetch time-series analytics with summary metrics
- `exports.getTopPerformers` - Aggregate top performers by date range and metric
- `exports.updateBranding` - Update branding and co-branding settings
- `exports.trackActivity` - Track activity and update counters + time-series
- `exports.getBranding` - Public endpoint for branding config

## POS Link (Seamless Integration)

### POS Link Features
- Direct navigation from FAHM mobile app to POS systems (Blend, Big POS, Encompass Consumer Connect)
- Secure OAuth 2.0 token passing with encrypted session management
- Pre-filled borrower data for seamless application experience
- Co-branded handoff with referral partner styling
- Real-time analytics tracking (session duration, completion rate, abandonment points)
- Automatic expiration of sessions (1-hour default, configurable)
- Sync to Encompass and CRM upon application completion

### POS Link Models
- **POSSession**: Tracks secure handoff sessions with tokens, expiration, analytics, branding, sync status

### POSSession Data Structure
- Session identification: sessionToken (unique, 64-char hex), sessionId (UUID), oauthState
- References: user, loan, loanOfficer, referralSource
- POS system: posSystem (blend/big_pos/encompass_consumer_connect), posApplicationId, posUrl
- Status workflow: pending → active → completed/expired/failed
- Lifecycle: createdAt, expiresAt (1 hour default), activatedAt, completedAt
- Handoff data: borrowerData (encrypted), loanData, prefilledFields, customAttributes
- Navigation: returnUrl, cancelUrl for post-application redirect
- Analytics: source (calculator/business_card/preapproval/dashboard), deviceType, ipAddress, sessionDuration, completionRate, abandonedStep
- Branding: theme (fahm_default/co_branded/white_label), logo, colors, partner branding
- Sync status: encompassSynced, crmSynced, lastSyncAt, syncErrors
- Metadata: campaignId, UTM parameters, customFields
- Error handling: errorCode, errorMessage, retryCount

### POS Link Endpoints
- `POST /api/v1/pos-link/generate` - Generate secure POS handoff link with pre-filled data
- `GET /api/v1/pos-link/session/:sessionToken` - Retrieve session details (validate and activate)
- `POST /api/v1/pos-link/session/:sessionToken/complete` - Mark session complete with POS application ID
- `POST /api/v1/pos-link/session/:sessionToken/fail` - Mark session failed with error details
- `GET /api/v1/pos-link/sessions` - List user's POS sessions with filtering
- `GET /api/v1/pos-link/analytics` - Get POS handoff analytics summary
- `POST /api/v1/pos-link/expire-old` - Admin endpoint to expire stale sessions

### POS Link Workflow
1. User initiates POS handoff from mobile app (calculator "Apply Now", business card, preapproval, dashboard)
2. Backend generates unique sessionToken and sessionId via `POST /generate`
3. System creates POSSession record with encrypted borrower/loan data, expiration (1 hour)
4. Backend constructs POS URL with session parameters and co-branding settings
5. Mobile app redirects user to POS URL (Blend, Big POS, or Encompass Consumer Connect)
6. POS system calls `GET /session/:sessionToken` to validate and fetch pre-fill data
7. FAHM backend marks session as "active", returns decrypted borrower/loan data
8. Borrower completes application in POS (seamless experience with FAHM branding)
9. POS system calls `POST /session/:sessionToken/complete` with posApplicationId
10. FAHM backend marks session "completed", calculates sessionDuration and completionRate
11. Background jobs sync application data to Encompass LOS and Total Expert CRM
12. Analytics tracked: conversion rate, avg session duration, abandonment funnel

### Session Security
- Tokens generated with crypto.randomBytes(32) for 64-char hex strings
- OAuth state parameter prevents CSRF attacks
- Sessions expire after 1 hour (configurable)
- TTL index on MongoDB auto-deletes expired sessions
- Handoff data encrypted before storage (AES-256)
- IP address and user agent tracked for fraud detection

### Analytics Tracking
- Session metrics: totalSessions, completedSessions, activeSessions, expiredSessions, failedSessions
- Conversion rate: (completedSessions / totalSessions) * 100
- Average session duration: time from activation to completion
- Average completion rate: percentage of application steps completed
- Abandonment analysis: track abandonedStep when sessions fail or expire
- Source attribution: track which feature generated the handoff (calculator, business card, etc.)
- Referral source performance: track conversions by referral partner

### Co-Branding Support
- Apply referral source branding to POS handoff (logo, colors, partner name)
- Three branding themes: fahm_default, co_branded, white_label
- Branding passed to POS via session data for consistent UX
- Partner logo and colors applied to application screens

### POSSession Model Methods
- `isExpired()` - Check if session has expired
- `isValid()` - Check if session is pending/active and not expired
- `activate()` - Mark session as active (called when POS retrieves data)
- `complete(completionData)` - Mark session complete, calculate duration
- `fail(errorCode, errorMessage)` - Mark session failed, increment retry count
- `expire()` - Mark session as expired
- `trackEvent(eventType, eventData)` - Track analytics events
- Static: `generateSessionToken()` - Generate secure 64-char hex token
- Static: `generateOAuthState()` - Generate OAuth state parameter
- Static: `findValidSession(sessionToken)` - Find valid session by token
- Static: `expireOldSessions()` - Bulk expire stale sessions
- Static: `getAnalyticsSummary(filters)` - Aggregate analytics with filters

### Access Control
- Generate POS link: Authenticated users (borrowers, LOs)
- Retrieve session: Public endpoint (called by POS systems), validates sessionToken
- Complete/fail session: Public endpoint (called by POS systems), validates sessionToken
- List sessions: Authenticated users (borrowers see own, LOs see assigned loans, admins see all)
- Analytics: Branch Manager, Admin only
- Expire old sessions: Admin only

### POS Link Controller (`controllers/posLinkController.js`)
- `exports.generateLink` - Generate secure POS handoff link with pre-filled data
- `exports.getSession` - Retrieve and activate session (called by POS)
- `exports.completeSession` - Mark session complete with POS application ID
- `exports.failSession` - Mark session failed with error details
- `exports.listSessions` - List user's sessions with role-based filtering
- `exports.getAnalytics` - Get analytics summary with date range and filters
- `exports.expireOldSessions` - Admin endpoint to expire stale sessions

## Encompass Texting Integration

### Encompass Texting Features
- 2-way SMS communication via Twilio integrated with Encompass LOS
- Automated status notifications for loan milestones and document requests
- Conversation threading with borrowers and loan team
- Automatic logging to Encompass for compliance
- TCPA compliance tracking with 7-year retention
- Delivery tracking and analytics

### SMS Models
- **SMSMessage**: Tracks all SMS communications with Twilio integration, 2-way threading, compliance logging, and Encompass sync status

### SMSMessage Model
- Message identification: messageId (unique, auto-generated), twilioMessageSid (from Twilio)
- Participants: from/to phone numbers (E.164 format), sender/recipient user refs
- Loan context: loan reference for Encompass logging
- Content: body (max 1600 chars for long SMS), direction (inbound/outbound)
- Type classification: manual, automated, notification, reminder, alert, milestone_update
- Status tracking: queued → sending → sent → delivered/failed/received
- Threading system: threadId (generated from sorted participants), conversationId, inReplyTo
- Encompass integration: synced boolean, syncedAt timestamp, encompassLogId, syncAttempts counter (max 3), lastSyncAttempt, syncError message
- Compliance fields: purpose (loan_update/document_request/appointment_reminder/general_inquiry/marketing/servicing/collection), consentObtained boolean, consentDate, tcpaCompliant boolean, optOutReceived boolean, retentionExpiresAt (7 years default)
- Media attachments: array of contentType, url, size for MMS
- Metadata: ipAddress, userAgent, deviceType, campaignId, automationTrigger, customFields
- Delivery details: numSegments (SMS parts), numMedia, price, priceUnit, twilioStatus, twilioErrorCode
- Timestamps: sentAt, deliveredAt, receivedAt, readAt
- Methods: markAsSent(), markAsDelivered(), markAsFailed(), markAsRead(), syncToEncompass(), generateThreadId()
- Static methods: generateMessageId(), getConversationThread(), findUnsyncedMessages(), getMessageStats()
- Indexes: 10+ compound indexes + TTL index for auto-cleanup after retention

### Encompass Texting Endpoints
- `POST /api/v1/sms/send` - Send SMS with automatic Encompass logging
- `POST /api/v1/sms/webhook/receive` - Twilio inbound webhook (public, for receiving SMS)
- `POST /api/v1/sms/webhook/status` - Twilio status webhook (public, for delivery updates)
- `GET /api/v1/sms/conversation/:phone` - Get conversation thread with specific phone number
- `GET /api/v1/sms/loan/:loanId` - Get all SMS messages for a loan
- `GET /api/v1/sms/my-messages` - Get authenticated user's messages
- `PATCH /api/v1/sms/:messageId/read` - Mark message as read
- `GET /api/v1/sms/stats` - Get SMS analytics (LO/BM/Admin only)
- `POST /api/v1/sms/sync-to-encompass` - Manually trigger Encompass sync (Admin only)

### SMS Workflow
1. User sends SMS via POST /send with to, body, loanId, messageType, purpose
2. System creates SMSMessage record with status "queued"
3. Send via Twilio using smsService.sendSMS()
4. Mark as "sent" with Twilio SID, segments, price
5. Async: Sync to Encompass using syncToEncompass() method
6. Twilio sends delivery status updates to /webhook/status
7. System updates SMSMessage status (delivered/failed)
8. For inbound SMS: Twilio posts to /webhook/receive
9. System creates inbound SMSMessage record, links to borrower/loan
10. Async: Sync inbound message to Encompass for compliance

### 2-Way Communication
- Thread identification: threadId generated from sorted phone numbers (e.g., "+11234567890_+19876543210")
- Conversation history: getConversationThread() retrieves all messages between two phone numbers
- Inbound message handling: Twilio webhook creates inbound SMSMessage, auto-links to borrower and active loan
- Reply threading: inReplyTo field links messages in conversation
- Conversation ID: Shared identifier for related messages across multiple threads

### Automated Notifications
- **smsNotificationService** provides pre-built notification templates:
  * `sendMilestoneUpdate()` - Loan milestone reached (e.g., "Underwriting approved")
  * `sendDocumentRequest()` - Document needed (e.g., "Please upload paystubs")
  * `sendAppointmentReminder()` - Appointment reminder (e.g., "Closing scheduled for...")
  * `sendRateAlert()` - Rate drop notification
  * `sendApplicationStarted()` - Welcome message for new borrowers
  * `sendApplicationSubmitted()` - Confirmation of application submission
  * `sendUnderwritingApproved()` - Underwriting approval notification
  * `sendClearToClose()` - Clear to close notification with closing date
  * `sendLoanFunded()` - Loan funding congratulations
- All notifications auto-create SMSMessage records with proper messageType and purpose
- Notifications include emojis and friendly messaging for borrower engagement

### Compliance & Retention
- TCPA compliance: All messages require consent tracking
- 7-year retention: Messages auto-deleted after retentionExpiresAt (2555 days from sent date)
- TTL index: MongoDB auto-cleanup of expired messages
- Purpose tracking: Categorized for regulatory reporting (loan_update, marketing, servicing, etc.)
- Opt-out management: optOutReceived flag prevents future SMS to opted-out numbers
- Encompass logging: All messages synced to Encompass for audit trail

### SMS Service (`services/smsService.js`)
- Twilio client initialization with TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
- Methods:
  * `sendSMS(to, body, options)` - Send SMS with optional status callback and media URLs
  * `send2WaySMS(to, body, threadId, options)` - Send with thread tracking
  * `validateWebhookSignature(url, params, signature)` - Verify Twilio webhook authenticity
  * `getMessageDetails(messageSid)` - Fetch message status from Twilio
  * `formatPhoneNumber(phoneNumber)` - Convert to E.164 format (+1XXXXXXXXXX)
  * `isValidPhoneNumber(phoneNumber)` - Validate phone number format
- Returns: { success, sid, status, numSegments, price, priceUnit, dateSent }

### Access Control
- Send SMS: Authenticated users (borrowers can send for own loans, LOs for assigned loans)
- Webhooks: Public endpoints (Twilio signature validation recommended)
- Conversation/loan messages: Role-based (borrowers see own, LOs see assigned, admins see all)
- Mark as read: Only recipient can mark message as read
- Statistics: LO/BM/Admin only
- Encompass sync: Admin only

### SMS Controller (`controllers/smsController.js`)
- `exports.sendMessage` - Send SMS with Twilio, create SMSMessage record, queue Encompass sync
- `exports.receiveWebhook` - Handle inbound SMS from Twilio, auto-link to borrower/loan
- `exports.statusWebhook` - Update message status from Twilio delivery events
- `exports.getConversation` - Retrieve conversation thread between two phone numbers
- `exports.getLoanMessages` - Get all SMS for a loan with pagination
- `exports.getMyMessages` - Get user's SMS with filtering (inbound/outbound)
- `exports.markAsRead` - Mark message as read by recipient
- `exports.getStats` - Analytics: total, sent, received, delivered, failed, synced, delivery rate, sync rate
- `exports.syncToEncompass` - Bulk sync unsynced messages to Encompass (Admin only)

## Environment & Configuration
Required env vars checked at startup in `config/env.js`: `MONGO_URI`, `JWT_SECRET`. Optional: `PORT` (default 4000), `LOG_LEVEL`, integration URLs for Encompass/TotalExpert/POS/Xactus/OptimalBlue. Email: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`. SMS: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`. Azure AD B2C: `AZURE_AD_B2C_TENANT_NAME`, `AZURE_AD_B2C_CLIENT_ID`, `AZURE_AD_B2C_CLIENT_SECRET`, `AZURE_AD_B2C_POLICY_NAME`, `AZURE_AD_B2C_SCOPE`. No `.env` in repo - developers must create locally.

## Key Conventions

- **No TypeScript**: Pure CommonJS Node.js (require/module.exports)
- **Mongoose over raw MongoDB**: All DB access through Mongoose models with schemas
- **Logging**: Use `logger.info()` / `logger.error()` from `utils/logger.js`, never `console.log`
- **Unused vars**: Prefix with `_` to avoid lint warnings (e.g., `_next`, `_err`)
- **Route nesting**: All routes under `/api/v1` prefix, mounted in `routes/index.js`

## Rate Alerts Integration

### Rate Alerts Features
- Pull live rate data from Optimal Blue API
- Custom triggers: below target, above target, drops by amount
- Multi-channel notifications: push, SMS, email, all
- Automatic logging to Total Expert CRM
- Scheduled checks every 30 minutes during business hours (6 AM - 8 PM)
- 90-day default alert expiration with auto-cleanup

### Rate Alert Models
- **RateAlert**: User subscriptions with trigger configuration, notification preferences, and trigger history

### RateAlert Model
- User identification: user reference (ObjectId)
- Rate configuration: productType (conventional/fha/va/usda/jumbo), loanTerm (10/15/20/25/30)
- Loan scenario: loanAmount (default 300k), creditScore (default 740), ltv (default 80), propertyType, occupancyType
- Trigger types: below (rate <= target), above (rate >= target), drops_by (baseline - current >= dropAmount)
- Target configuration: targetRate (for below/above), dropAmount + baselineRate (for drops_by)
- Notification method: push, sms, email, all
- Status workflow: active → triggered/paused/expired/cancelled
- Lifecycle: createdAt, lastCheckedAt, triggeredAt, expiresAt (90 days default)
- Trigger history: array of triggeredAt, currentRate, targetRate, notificationSent, crmLoggedAt
- CRM integration: crmActivityId, totalExpertContactId
- Methods: shouldTrigger(), trigger(), markNotificationSent(), markCRMLogged()
- Static: findAlertsToCheck(), expireOldAlerts()
- TTL index: Auto-deletes expired alerts

### Rate Alert Endpoints
- `POST /api/v1/rate-alerts` - Create rate alert subscription
- `GET /api/v1/rate-alerts` - Get user's rate alerts with filtering
- `GET /api/v1/rate-alerts/stats` - Get alert statistics
- `GET /api/v1/rate-alerts/:id` - Get single alert
- `PATCH /api/v1/rate-alerts/:id` - Update alert settings
- `DELETE /api/v1/rate-alerts/:id` - Delete alert
- `GET /api/v1/rate-alerts/:id/check-rate` - Check current rate for alert
- `POST /api/v1/rate-alerts/:id/trigger-check` - Manually trigger alert check
- `POST /api/v1/rate-alerts/:id/pause` - Pause alert notifications
- `POST /api/v1/rate-alerts/:id/resume` - Resume paused alert

### Rate Alert Workflow
1. User creates alert via POST /rate-alerts with trigger configuration
2. System creates RateAlert record with 90-day expiration
3. Scheduler checks active alerts every 30 minutes (6 AM - 8 PM)
4. For each alert: Fetch current rate from Optimal Blue
5. Check if shouldTrigger() based on trigger type
6. If triggered: Mark as triggered, add to trigger history
7. Send notifications via selected method (push/SMS/email)
8. Log activity to Total Expert CRM
9. Mark notification sent and CRM logged
10. Daily cleanup: Expire alerts past expiresAt date

### Rate Alert Scheduler
- Alert checks: Every 30 minutes during business hours (6 AM - 8 PM ET)
- Alert expiration: Daily at 2 AM ET
- Uses node-cron with America/New_York timezone
- Prevents concurrent checks with locking flag
- Logs all check results and errors

### Rate Alert Service (`services/rateAlertService.js`)
- `checkAllAlerts()` - Check all active alerts (called by scheduler)
- `checkSingleAlert(alert)` - Check individual alert with Optimal Blue
- `sendNotifications(alert, currentRate, rateData)` - Dispatch notifications via push/SMS/email
- `logToCRM(alert, currentRate)` - Log trigger to Total Expert CRM
- `expireOldAlerts()` - Mark expired alerts (called daily)
- `getGlobalStats()` - Aggregate alert statistics

### Notification Integration
- SMS: Via smsNotificationService.sendRateAlert()
- Push: TODO - Firebase/APNS integration
- Email: TODO - Email service integration
- All: Send via all enabled channels
- Notifications include: current rate, target rate, product type, loan term
- User-friendly messaging with emoji support

### CRM Integration
- Auto-log all triggered alerts to Total Expert CRM
- Activity type: rate_alert
- Includes: alert details, current/target rates, trigger type
- Links to contact via totalExpertContactId
- Non-blocking: CRM failures don't prevent notifications

### Access Control
- All alert operations: Authenticated users
- Users can only manage own alerts
- Alert checks: System scheduler (automated)
- Statistics: User's own stats only

### Rate Alert Controller (`controllers/rateAlertController.js`)
- `exports.createAlert` - Create alert with validation
- `exports.getAlerts` - List user's alerts with pagination
- `exports.getAlert` - Get single alert with authorization check
- `exports.updateAlert` - Update alert settings
- `exports.deleteAlert` - Delete alert
- `exports.checkRate` - Get current rate and trigger status
- `exports.triggerCheck` - Manually trigger check (user-initiated)
- `exports.getStats` - Get user's alert statistics
- `exports.pauseAlert` - Pause alert
- `exports.resumeAlert` - Resume paused alert

## POS Integration (Blend / Big POS)

### POS Integration Features
- Secure SSO handoff to Blend and Big POS via OAuth 2.0
- Real-time borrower data sync and application status tracking
- Document upload and retrieval integration
- Application submission with confirmation
- Webhook processing for status updates
- Automatic CRM and Encompass sync on application submission
- FAHM branding support (logo, colors, return URLs)
- Mobile app initiation of POS applications

### POS Integration Models
- **LoanApplication** (enhanced): Added `posSystem` (enum: blend/big_pos), `posApplicationId`, `lastPOSSync` fields

### POS System Overview
- **Blend**: Mortgage application platform with SSO handoff, status tracking, document management
- **Big POS**: Enhanced POS with milestone tracking, progress percentage, conditional approvals, document verification

### Blend POS Service (`services/blendPOSService.js`)
- OAuth 2.0 token management with client credentials flow and 5-minute expiry buffer caching
- `getAccessToken()` - Fetch and cache OAuth token with automatic refresh
- `createSSOHandoff(borrowerData, loanData, options)` - Generate SSO URL with pre-filled data
  * Returns: applicationId, ssoUrl, sessionToken, expiresAt (1-hour expiry)
  * Options: logoUrl, primaryColor, returnUrl for FAHM branding
  * Timeout: 15 seconds
- `getApplicationStatus(applicationId)` - Fetch application status and progress
  * Returns: status (draft/submitted/processing/approved/declined), completionPercentage, borrower, loan, documents
  * Timeout: 10 seconds
- `syncBorrowerData(applicationId, borrowerData)` - Update borrower information
  * Fields: firstName, lastName, email, phone, ssn, dateOfBirth, address
  * Timeout: 10 seconds
- `uploadDocument(applicationId, documentData)` - Upload document with multipart/form-data
  * Fields: file (buffer), type, description
  * Returns: documentId, uploadedAt
  * Timeout: 30 seconds
- `getDocuments(applicationId)` - List documents with download URLs
  * Returns: Array of { documentId, type, status, uploadedAt, downloadUrl }
  * Timeout: 10 seconds
- `submitApplication(applicationId)` - Submit to underwriting
  * Returns: confirmationNumber, submittedAt
  * Timeout: 10 seconds
- `verifyWebhookSignature(payload, signature, secret)` - Verify X-Blend-Signature header (stub implementation, ready for production HMAC verification)
- `processWebhookEvent(event)` - Parse and route webhook events
  * Event types: application.created, application.submitted, application.approved, application.declined, document.uploaded, document.reviewed
  * Returns: { eventType, applicationId, shouldSyncCRM, shouldSyncEncompass } flags
  * CRM sync trigger: application.submitted event
  * Encompass sync trigger: application.submitted event
- Configuration: BLEND_API_URL, BLEND_CLIENT_ID, BLEND_CLIENT_SECRET environment variables

### Big POS Service (`services/bigPOSService.js`)
- OAuth 2.0 token management with client credentials flow, scopes, and 5-minute expiry buffer caching
- `getAccessToken()` - Fetch and cache OAuth token with scopes (application:read, application:write, document:upload)
- `createSSOHandoff(borrowerData, loanData, options)` - Generate SSO URL with enhanced customization
  * Returns: applicationId, ssoUrl, sessionToken, accessCode, expiresAt (1-hour expiry)
  * Options: logoUrl, primaryColor, secondaryColor, companyName, returnUrl, cancelUrl, sessionTimeout, autoSave
  * Includes integrationMetadata: sourceSystem (fahm), loanId, loanOfficerId, loanOfficerNMLS, referralSource
  * Settings: sessionTimeout (default 30 min), autoSave (default true), sendConfirmationEmail (default true)
  * Timeout: 15 seconds
- `getApplicationStatus(applicationId)` - Fetch application status with milestones
  * Returns: status (initiated/in_progress/completed/submitted/under_review/approved/conditional_approval/denied), progressPercentage, currentStep, lastActivity, milestones
  * Timeout: 10 seconds
- `syncBorrowerData(applicationId, borrowerData)` - Update applicant with employment information
  * Fields: firstName, lastName, email, phone, ssn, dateOfBirth, address, employment (employer, jobTitle, monthlyIncome, yearsEmployed)
  * Returns: validationStatus with validation warnings/errors
  * Timeout: 10 seconds
- `uploadDocument(applicationId, documentData)` - Upload document with verification status
  * Fields: file (buffer), type, description
  * Returns: documentId, uploadedAt, thumbnailUrl, verificationStatus
  * Timeout: 30 seconds
- `getDocuments(applicationId)` - List documents with thumbnails and verification
  * Returns: Array of { documentId, type, status, uploadedAt, downloadUrl, thumbnailUrl, verificationStatus }
  * Timeout: 10 seconds
- `submitApplication(applicationId, submissionData)` - Submit with notes and urgency
  * Optional submissionData: notes, urgency (low/medium/high), requestedClosingDate
  * Returns: confirmationNumber, submittedAt, estimatedReviewTime, nextSteps
  * Timeout: 10 seconds
- `getMilestones(applicationId)` - Track application milestones
  * Returns: Array of { id, name, status (pending/in_progress/completed/skipped), completedAt, order }
  * Timeout: 10 seconds
- `verifyWebhookSignature(payload, signature, secret)` - Verify X-BigPOS-Signature header (stub implementation)
- `processWebhookEvent(event)` - Parse and route webhook events
  * Event types: application.initiated, application.progress_updated, application.completed, application.submitted, application.approved, application.conditional_approval, application.denied, document.uploaded, document.verified, milestone.completed
  * Returns: { eventType, applicationId, shouldSyncCRM, shouldSyncEncompass } flags
  * CRM sync trigger: application.submitted event
  * Encompass sync trigger: application.submitted event
- Configuration: BIG_POS_API_URL, BIG_POS_CLIENT_ID, BIG_POS_CLIENT_SECRET environment variables

### POS Controller (`controllers/posController.js`)
Original Method (preserved from existing implementation):
- `exports.createHandoff` - Generate JWT token for POS handoff with rate limiting (max per user per minute)
  * Uses mintWindow Map for rate limiting
  * Returns: token, deepLink, expiresInMinutes
  * Audit logging: pos.handoff event

New Methods for Blend/Big POS Integration:
- `exports.initiateApplication` - Create SSO handoff to Blend or Big POS
  * Validates user authorization (borrowers can only access their own loans)
  * Fetches loan with borrower and assignedOfficer populated
  * Prepares borrower data (name, email, phone, ssn, dob, address)
  * Prepares loan data (amount, purpose, product type, property address)
  * Calls blendPOSService or bigPOSService.createSSOHandoff based on posSystem
  * Updates loan with posSystem, posApplicationId, lastPOSSync
  * Audit logging: pos.initiate event
  * Returns: applicationId, ssoUrl, sessionToken, expiresAt
- `exports.getApplicationStatus` - Fetch current application status from POS
  * Routes to blendPOSService or bigPOSService based on posSystem query param
  * Returns: Full status object from POS (status, progress, borrower, loan, documents)
- `exports.syncBorrowerData` - Push updated borrower data to POS
  * Validates posSystem in body
  * Routes to blendPOSService or bigPOSService.syncBorrowerData
  * Audit logging: pos.sync_borrower event
  * Returns: success flag and optional validation status (Big POS only)
- `exports.getDocuments` - Retrieve document list from POS
  * Routes to blendPOSService or bigPOSService based on posSystem query param
  * Returns: Array of documents with download URLs
- `exports.submitApplication` - Submit application to underwriting
  * Validates posSystem in body
  * Optional submissionData for Big POS (notes, urgency, requestedClosingDate)
  * Routes to blendPOSService or bigPOSService.submitApplication
  * Audit logging: pos.submit event
  * Returns: confirmationNumber, submittedAt, and estimatedReviewTime/nextSteps (Big POS only)
- `exports.handleBlendWebhook` - Process Blend webhook events (PUBLIC endpoint)
  * Verifies X-Blend-Signature header using blendPOSService.verifyWebhookSignature
  * Calls blendPOSService.processWebhookEvent to parse event
  * Finds loan by posApplicationId
  * If shouldSyncCRM: Calls totalExpertService.logActivity with pos_application_submitted type
  * If shouldSyncEncompass: Calls encompassService.updateLoanStatus
  * Non-blocking error handling: CRM/Encompass failures logged but don't block webhook response
  * Returns: { success: true, message: 'Webhook processed' }
- `exports.handleBigPOSWebhook` - Process Big POS webhook events (PUBLIC endpoint)
  * Verifies X-BigPOS-Signature header using bigPOSService.verifyWebhookSignature
  * Calls bigPOSService.processWebhookEvent to parse event
  * Finds loan by posApplicationId
  * If shouldSyncCRM: Calls totalExpertService.logActivity with confirmationNumber
  * If shouldSyncEncompass: Calls encompassService.updateLoanStatus
  * Non-blocking error handling: CRM/Encompass failures logged but don't block webhook response
  * Returns: { success: true, message: 'Webhook processed' }

### POS Integration Endpoints
- `POST /api/v1/pos/handoff` - Create POS handoff token (original endpoint, preserved)
- `POST /api/v1/pos/initiate` - Initiate POS application with Blend or Big POS
- `GET /api/v1/pos/application/:applicationId/status` - Get application status (requires posSystem query param)
- `POST /api/v1/pos/application/:applicationId/sync-borrower` - Sync borrower data (validates posSystem in body)
- `GET /api/v1/pos/application/:applicationId/documents` - Get documents list (requires posSystem query param)
- `POST /api/v1/pos/application/:applicationId/submit` - Submit application (validates posSystem in body)
- `POST /api/v1/pos/webhooks/blend` - Blend webhook handler (PUBLIC, no authentication)
- `POST /api/v1/pos/webhooks/big-pos` - Big POS webhook handler (PUBLIC, no authentication)

### POS Integration Workflow
1. Borrower clicks "Apply" button in mobile app
2. App calls POST /pos/initiate with loanId, posSystem (blend or big_pos), optional branding options
3. Backend fetches loan with borrower and assignedOfficer data
4. Backend calls createSSOHandoff on selected POS service with pre-filled data
5. Backend updates loan with posSystem and posApplicationId
6. Backend returns ssoUrl to mobile app
7. Mobile app redirects borrower to ssoUrl (opens POS in webview or browser)
8. Borrower completes application in POS with pre-filled FAHM data
9. POS sends webhook to /pos/webhooks/blend or /pos/webhooks/big-pos on status changes
10. Backend verifies webhook signature, processes event
11. On application.submitted event: Backend triggers CRM logActivity and Encompass updateLoanStatus
12. CRM and Encompass sync happens asynchronously (failures logged, don't block webhook response)
13. Backend responds to webhook with success
14. LO can check application status via GET /application/:applicationId/status

### Access Control
- Initiate application: All authenticated users (borrowers can only access their own loans)
- Get status: Authenticated users (borrowers can only access their own loans)
- Sync borrower: Authenticated users (borrowers can only access their own loans)
- Get documents: Authenticated users (borrowers can only access their own loans)
- Submit application: Authenticated users (borrowers can only access their own loans)
- Webhooks: Public endpoints (no authentication, rely on signature verification)

### Webhook Security
- Blend: Verifies X-Blend-Signature header with HMAC-SHA256 (stub implementation ready for production)
- Big POS: Verifies X-BigPOS-Signature header with HMAC-SHA256 (stub implementation ready for production)
- Production implementation: Use crypto.createHmac('sha256', secret).update(payload).digest('hex')
- Webhook secrets stored in environment variables: BLEND_WEBHOOK_SECRET, BIG_POS_WEBHOOK_SECRET

### OAuth Token Caching
- Tokens cached in memory with 5-minute expiry buffer
- Cache structure: { token, expiresAt (timestamp - 300s) }
- Auto-refresh on cache miss or expiration
- Reduces API calls and improves performance

### CRM and Encompass Integration
- Triggered by application.submitted webhook events
- CRM: Logs activity with type pos_application_submitted, includes applicationId and confirmationNumber
- Encompass: Updates loan status to match POS submission status
- Non-blocking: Failures logged with logger.error, don't block webhook response
- Services used: totalExpertService.logActivity, encompassService.updateLoanStatus

## Chatbot (AI Assistant) Integration

### Chatbot Features
- Azure OpenAI-powered conversational AI assistant
- FAQ knowledge base with semantic search
- Live data integration from Encompass, CRM, POS, Optimal Blue
- Function calling for real-time loan status, rates, calculations
- Human escalation via Teams, in-app chat, SMS, or email
- Session management with conversation history and context
- Multi-language support (English default, extensible)
- Voice input support flag (future integration)
- Satisfaction ratings and feedback collection

### Chatbot Models
- **ChatbotSession**: Conversation sessions with messages, context, escalation, analytics

### ChatbotSession Model
- Session identification: sessionId (unique, auto-generated), user reference
- Loan context: Optional loan reference for context-aware assistance
- Status workflow: active → escalated/resolved/closed
- Messages array: role (user/assistant/system/function), content, timestamp, function call/response
- Context tracking: userRole, currentLoanId, recentTopics, preferredLanguage
- Escalation tracking: escalated flag, escalatedAt, escalatedTo (User ref), escalationType (teams/in_app_chat/sms/email), escalationReason, resolvedAt, resolutionNotes
- Data sources array: Logs all function calls (source: encompass/crm/pos/faq/calculator/rates/guidelines, query, response, timestamp)
- Metadata: deviceType, ipAddress, userAgent, startedAt, lastMessageAt, endedAt, sessionDuration, messageCount, satisfactionRating (1-5), feedbackText
- Settings: voiceEnabled, autoEscalate, maxIdleMinutes (default 30)
- Methods: addMessage(), addDataSource(), escalateToHuman(), resolveEscalation(), closeSession(), isExpired(), getRecentMessages()
- Static: generateSessionId(), findActiveSessions(), findEscalatedSessions(), getSessionStats(), closeIdleSessions()
- Indexes: user+status, startedAt, lastMessageAt, escalated+status, TTL on endedAt (90-day auto-cleanup)

### Chatbot Endpoints
- `POST /api/v1/chatbot/start` - Start new session with optional initial message and loan context
- `POST /api/v1/chatbot/message` - Send message and receive AI response
- `GET /api/v1/chatbot/session/:sessionId` - Get conversation history
- `GET /api/v1/chatbot/sessions` - Get user's chat sessions with status filtering
- `POST /api/v1/chatbot/session/:sessionId/escalate` - Escalate to human with reason and method
- `POST /api/v1/chatbot/session/:sessionId/close` - Close session with optional rating and feedback
- `GET /api/v1/chatbot/stats` - Get chatbot statistics (Admin/BM only)
- `GET /api/v1/chatbot/escalated` - Get escalated sessions (LO/Admin/BM only)
- `POST /api/v1/chatbot/session/:sessionId/resolve` - Resolve escalated session (LO/Admin only)

### Azure OpenAI Integration
- Chat completion with GPT-4 deployment
- Function calling for live data retrieval
- Embedding generation for semantic FAQ search (text-embedding-ada-002)
- System prompt customization based on user role and context
- Temperature 0.7 for balanced creativity/accuracy
- Max 800 tokens per response for concise answers
- 30-second timeout for API calls
- Fallback responses when OpenAI unavailable

### Function Definitions (AI Function Calling)
- `getLoanStatus(loanId)` - Fetch loan status, milestones, contacts from Encompass
- `getCRMData(contactId)` - Get contact info, engagement score, active journeys from Total Expert
- `getPOSData(applicationId)` - Retrieve POS application status and pending documents
- `getRateData(productType, loanTerm, loanAmount, creditScore, ltv)` - Get current rates from Optimal Blue
- `calculateMortgage(loanAmount, interestRate, loanTerm, propertyTax, insurance, hoa)` - Calculate monthly payment
- `searchFAQ(query, category)` - Semantic search FAQ knowledge base
- `escalateToHuman(reason, urgency, preferredMethod)` - Escalate conversation to loan officer

### FAQ Knowledge Base
- 15 pre-loaded FAQs covering common mortgage questions
- Categories: programs, eligibility, process, documents, rates, fees, closing
- Semantic search with keyword matching (production: use embeddings + vector DB)
- Topics: Loan programs (Conventional/FHA/VA/USDA/Jumbo), credit score requirements, down payment needs, process timeline, document requirements, rate information, closing procedures
- Confidence scoring: high (>5 matches), medium (2-5), low (<2)

### Chatbot Knowledge Service (`services/chatbotKnowledgeService.js`)
- `searchFAQ(query, category)` - Semantic FAQ search with confidence scoring
- `getLoanStatus(loanId)` - Fetch loan from database + live Encompass data
- `getCRMData(contactId)` - Fetch user + CRM engagement data
- `getPOSData(applicationId)` - Mock POS data (stub for Blend/Big POS integration)
- `getRateData(scenario)` - Fetch rates from Optimal Blue service
- `calculateMortgage(params)` - Standard mortgage payment calculation
- `executeFunction(functionName, args)` - Router for AI function calls

### Azure OpenAI Service (`services/azureOpenAIService.js`)
- `getChatCompletion(messages, functions, options)` - Generate AI response with function calling
- `getEmbedding(text)` - Generate embeddings for semantic search
- `buildSystemPrompt(context)` - Create role-aware system prompt
- `getFunctionDefinitions()` - Define available functions for AI
- `formatConversationHistory(messages, limit)` - Format for OpenAI API
- `generateFallbackResponse(userMessage)` - Keyword-based fallback when API unavailable
- Configuration: AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT_NAME, AZURE_OPENAI_EMBEDDING_DEPLOYMENT

### Chatbot Workflow
1. User starts session via POST /start with optional initial message and loanId
2. System creates ChatbotSession with unique sessionId, builds role-aware system prompt
3. If initial message provided: Send to Azure OpenAI with function definitions
4. AI responds with text or function call (e.g., getLoanStatus, searchFAQ, calculateMortgage)
5. If function call: Execute via chatbotKnowledgeService, add result to conversation
6. Get final AI response with function result incorporated
7. User sends additional messages via POST /message
8. AI maintains context with last 10 messages for coherent conversation
9. If AI determines escalation needed or user requests: Call escalateToHuman function
10. Session escalates, notification sent to assigned LO via SMS/Teams/in-app
11. LO resolves escalation via POST /resolve with resolution notes
12. User closes session with satisfaction rating and feedback

### Escalation Workflow
- Automatic: AI detects need for human assistance (complex questions, sensitive topics)
- Manual: User explicitly requests escalation via chat or POST /escalate endpoint
- Escalation types: teams (Microsoft Teams notification), in_app_chat (app messaging), sms (Twilio SMS), email (nodemailer)
- Assigned LO: Fetched from loan's assignedOfficer field if loan context available
- Notification: SMS sent to LO phone with session details and escalation reason
- Resolution: LO views escalated session, assists borrower, marks resolved with notes
- Session transitions: active → escalated → resolved (or closed after resolution)

### Session Management
- Active sessions: User actively chatting, lastMessageAt < 30 minutes ago
- Idle sessions: Auto-closed after 30 minutes of inactivity (configurable per session)
- Closed sessions: User-initiated close or auto-close on idle, TTL index auto-deletes after 90 days
- Message count tracking: Incremented on each addMessage() call
- Session duration: Calculated when closing (endedAt - startedAt in seconds)
- Data source tracking: Logs all function calls for audit trail and analytics

### Access Control
- Start session: All authenticated users
- Send message: Session owner only
- View session/history: Session owner only
- Escalate: Session owner or LO/Admin
- Close session: Session owner only
- Statistics: Admin/BM only
- View escalated sessions: LO/Admin/BM only
- Resolve escalation: LO/Admin only

### Chatbot Controller (`controllers/chatbotController.js`)
- `exports.startSession` - Create session, optional initial message processing, welcome message
- `exports.sendMessage` - Process user message, call Azure OpenAI, handle function calling, return AI response
- `exports.getSession` - Retrieve conversation history with populated references
- `exports.getUserSessions` - List user's sessions with status filtering and pagination
- `exports.escalateSession` - Manually escalate with reason and method, notify LO
- `exports.closeSession` - Mark closed with satisfaction rating and feedback
- `exports.getStats` - Aggregate statistics (total, active, escalated, resolved, closed, avg message count, avg duration, avg rating, escalation rate)
- `exports.getEscalatedSessions` - List all escalated sessions for LOs/Admins
- `exports.resolveSession` - Mark escalation resolved with notes

## Testing & Future Work
Tests not yet implemented (`npm test` is placeholder). External integrations (Encompass, Twilio, etc.) referenced in `config/env.js` but not wired up - add service modules when needed.

## Postman Collection
`Postman_Collection_v1.json` contains all API endpoint examples for manual testing.

