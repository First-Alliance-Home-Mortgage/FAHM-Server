# Encompass LOS Integration - Implementation Summary

## Overview
Complete integration with ICE Mortgage Technology's Encompass LOS for automated loan data sync, milestone tracking, contact management, document upload, and messaging.

## Implementation Date
December 12, 2024

## Components Created

### 1. Data Models (2 files)

#### `src/models/LoanContact.js`
- **Purpose**: Store loan team contacts synced from Encompass
- **Key Fields**:
  - `loan`: Reference to LoanApplication
  - `user`: Reference to User
  - `role`: Loan Officer, Processor, Underwriter, Closer
  - `encompassContactId`: External system ID
  - `isPrimary`: Flag for primary contact
  - `assignedDate`, `removedDate`: Contact lifecycle
- **Indexes**: Loan + role for quick team lookups

#### `src/models/EncompassSyncLog.js`
- **Purpose**: Audit trail for all Encompass sync operations
- **Key Fields**:
  - `loan`: Reference to LoanApplication
  - `syncType`: full_sync, milestone_update, contact_sync, document_upload, status_update
  - `status`: success, partial, failed
  - `recordsSynced`, `recordsFailed`, `duration`
  - `errorDetails`: Error messages for troubleshooting
- **Indexes**: Loan + timestamp, syncType + status

### 2. Service Layer

#### `src/services/encompassService.js`
- **OAuth 2.0 Token Management**: Cached tokens with automatic refresh
- **Core Methods**:
  - `getLoanDetails(encompassLoanId)` - Fetch complete loan data
  - `getLoanMilestones(encompassLoanId)` - Get milestone status
  - `getLoanContacts(encompassLoanId)` - Get loan team
  - `updateLoanStatus(encompassLoanId, status)` - Update loan status
  - `uploadDocument(encompassLoanId, documentData)` - Upload documents
  - `sendMessage(encompassLoanId, messageData)` - Log messages for compliance
- **Data Transformation**: Maps Encompass field IDs to FAHM schemas
- **Error Handling**: Retry logic with exponential backoff

### 3. Scheduler Integration

#### Auto-Sync Scheduler (runs every 15 minutes)
- **Location**: `src/server.js`
- **Functionality**:
  - Syncs all active loans (not 'funded')
  - Updates milestones from Encompass
  - Syncs loan contacts and team assignments
  - Updates loan status and data
  - Creates EncompassSyncLog for each operation
- **Schedule**: `0,15,30,45 * * * *` (every 15 minutes)

### 4. Controller Integration

#### `src/controllers/loanController.js`
- **Enhanced Methods**:
  - `create` - Creates loan in both FAHM and Encompass
  - `update` - Syncs updates to Encompass
  - `get` - Fetches fresh data from Encompass if available
  - `updateMilestone` - Updates milestone in both systems

#### Manual Sync Endpoint
- `POST /api/v1/encompass/loans/:id/sync` - Trigger immediate sync
- Returns updated loan data, contacts, and sync duration
- LO and Admin access only

### 5. Document Upload Integration

#### `src/controllers/documentController.js`
- **Auto-Upload**: Documents uploaded via FAHM automatically push to Encompass
- **Status Tracking**: `encompassSynced` flag and `encompassSyncedAt` timestamp
- **Document Types**: Maps FAHM doc types to Encompass categories

### 6. Messaging Integration

#### `src/models/Message.js`
- **Auto-Logging**: All in-app messages logged to Encompass
- **Compliance**: Required for regulatory audit trails
- **Bidirectional**: Future support for Encompass → FAHM via webhooks
- **Fields**:
  - `encompassSynced`: Boolean flag
  - `encompassSyncedAt`: Sync timestamp
  - `encompassMessageId`: External message ID

## Environment Configuration

Required environment variables:
```bash
ENCOMPASS_API_URL=https://api.elliemae.com
ENCOMPASS_CLIENT_ID=your_client_id
ENCOMPASS_CLIENT_SECRET=your_client_secret
ENCOMPASS_INSTANCE_ID=your_instance_id
```

## Authentication & Security

- **OAuth 2.0**: Client credentials flow
- **Token Caching**: In-memory cache with 5-minute expiry buffer
- **API Version**: Latest Encompass Partner Connect API
- **Scopes**: lp (loan pipeline), doc (documents), msg (messages)

## Data Flow

### Loan Creation Flow
1. User creates loan in FAHM mobile app
2. Backend creates LoanApplication record
3. Service calls `encompassService.createLoan()`
4. Encompass returns `encompassLoanId`
5. FAHM stores ID for future sync operations

### Auto-Sync Flow (Every 15 Minutes)
1. Scheduler finds all active loans with `encompassLoanId`
2. For each loan:
   - Fetch latest data from Encompass
   - Update milestones (name, status, updatedAt)
   - Sync loan contacts and team
   - Update loan status if changed
   - Create EncompassSyncLog entry
3. Logs success/failure for monitoring

### Document Upload Flow
1. Borrower uploads document via mobile app
2. FAHM stores document in database
3. Background job uploads to Encompass
4. Encompass returns document ID
5. FAHM marks as synced with timestamp

### Message Logging Flow
1. User sends in-app message
2. FAHM creates Message record
3. Async job logs to Encompass for compliance
4. Updates `encompassSynced` flag
5. Stores `encompassMessageId` for reference

## Integration Benefits

✅ **Real-Time Data**: Always displays latest loan status from LOS  
✅ **Compliance**: All communications logged in Encompass  
✅ **Automation**: Eliminates manual data entry between systems  
✅ **Team Sync**: Loan team contacts always up-to-date  
✅ **Document Management**: Single source of truth for loan docs  
✅ **Milestone Tracking**: Accurate loan progress visibility  
✅ **Audit Trail**: Complete sync history via EncompassSyncLog  

## Error Handling

- **Sync Failures**: Logged but don't block user operations
- **Retry Logic**: 3 attempts with exponential backoff
- **Error Logging**: Detailed error messages in EncompassSyncLog
- **Monitoring**: Check `/api/v1/encompass/logs` for sync health

## Future Enhancements

- [ ] Webhook support for real-time Encompass → FAHM updates
- [ ] Conditional approval tracking from underwriting
- [ ] Automated disclosure delivery via Encompass
- [ ] eSign integration via Encompass eSign API
- [ ] Custom field mapping configuration UI
