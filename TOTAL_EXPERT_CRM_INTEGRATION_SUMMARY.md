# Total Expert CRM Integration - Implementation Summary

## Overview
Bidirectional integration with Total Expert CRM for marketing automation, contact management, journey enrollment, engagement tracking, and activity logging.

## Implementation Date
December 12, 2024

## Components Created

### 1. Data Models (4 files)

#### `src/models/CRMContact.js`
- **Purpose**: Store borrower and partner contacts synced with Total Expert
- **Key Fields**:
  - `user`: Reference to FAHM User
  - `totalExpertContactId`: External CRM contact ID
  - `contactType`: borrower, loan_officer, realtor, broker, partner
  - `engagementScore`: 0-100 calculated from interactions
  - `journeyEnrollments`: Array of active marketing journeys
  - `lastActivityDate`, `lastSyncedAt`: Activity tracking
  - `customFields`: Flexible JSON for CRM-specific data
- **Indexes**: User reference, totalExpertContactId, contactType

#### `src/models/CRMJourney.js`
- **Purpose**: Marketing journey definitions from Total Expert
- **Key Fields**:
  - `totalExpertJourneyId`: External journey ID
  - `name`, `description`, `category`: Journey metadata
  - `triggerType`: milestone_update, new_lead, application_submit, manual, scheduled
  - `isActive`: Enable/disable journeys
  - `steps`: Array of journey steps with templates and delays
  - `enrollmentCount`, `completionRate`: Performance metrics
- **Indexes**: TotalExpertJourneyId, isActive, triggerType

#### `src/models/CRMActivityLog.js`
- **Purpose**: Log all in-app communications for CRM sync
- **Key Fields**:
  - `contact`: Reference to CRMContact
  - `activityType`: message, push_notification, email, sms, call, journey_step, milestone_update
  - `activityData`: JSON with activity details
  - `totalExpertActivityId`: Synced activity ID
  - `syncedAt`: Timestamp of CRM sync
- **Indexes**: Contact + timestamp, activityType, syncedAt

#### `src/models/CRMSyncLog.js`
- **Purpose**: Audit trail for all CRM sync operations
- **Key Fields**:
  - `syncType`: contact_sync, journey_sync, activity_log, engagement_update
  - `status`: success, partial, failed
  - `direction`: fahm_to_crm, crm_to_fahm, bidirectional
  - `recordsSynced`, `recordsFailed`, `duration`
  - `errorDetails`: Error messages for troubleshooting
- **Indexes**: SyncType + status, timestamp

### 2. Service Layer

#### `src/services/totalExpertService.js`
- **OAuth 2.0 Token Management**: Cached tokens with automatic refresh
- **Core Methods**:
  - `syncContact(userId)` - Sync FAHM user to CRM contact
  - `getContactEngagement(totalExpertContactId)` - Get engagement metrics
  - `enrollInJourney(contactId, journeyId)` - Enroll contact in journey
  - `triggerMilestoneJourney(loanId, milestone)` - Auto-enroll on milestone
  - `logActivity(contactId, activityData)` - Log activity to CRM
  - `getJourneys()` - Fetch all active journeys
- **Data Transformation**: Maps FAHM schemas to Total Expert API formats
- **Error Handling**: Non-blocking with detailed error logging

### 3. Scheduler Integration

#### Auto-Sync Scheduler (runs every 15 minutes)
- **Location**: `src/server.js`
- **Functionality**:
  - **Contact Sync**: Pushes new/updated FAHM users to CRM
  - **Journey Import**: Fetches active journeys from Total Expert
  - **Activity Sync**: Logs unsynced activities to CRM
  - **Engagement Update**: Updates engagement scores
  - Creates CRMSyncLog for each operation
- **Schedule**: `5,20,35,50 * * * *` (every 15 minutes, offset from Encompass)

### 4. Controller Layer

#### `src/controllers/crmController.js` (10 handlers)
1. `syncContact` - Manual contact sync to CRM
2. `getContactEngagement` - View engagement metrics
3. `enrollInJourney` - Manually enroll contact in journey
4. `unenrollFromJourney` - Remove from journey
5. `triggerMilestoneJourney` - Trigger milestone-based journey
6. `getJourneys` - List available journeys
7. `getContactJourneys` - View contact's active journeys
8. `logActivity` - Manually log activity
9. `getContactActivities` - View activity history
10. `getSyncLogs` - View CRM sync audit trail (Admin only)

### 5. Integration Points

#### Loan Milestone Updates
- **Location**: `src/controllers/loanController.js`
- **Trigger**: When loan milestone updated
- **Action**: Calls `totalExpertService.triggerMilestoneJourney()`
- **Journeys**: Application submitted, underwriting approved, clear to close, funded

#### Rate Alerts
- **Location**: `src/services/rateAlertService.js`
- **Trigger**: When rate alert triggered
- **Action**: Logs rate alert activity to CRM
- **Data**: Alert details, current rate, target rate, user contact

#### In-App Messages
- **Location**: `src/controllers/messageController.js`
- **Trigger**: When user sends/receives message
- **Action**: Logs to CRMActivityLog for batch sync
- **Sync**: Every 15 minutes via scheduler

#### POS Application Submission
- **Location**: `src/controllers/posController.js`
- **Trigger**: Webhook from Blend/Big POS on application.submitted
- **Action**: Logs pos_application_submitted activity
- **Data**: ApplicationId, confirmationNumber, submission timestamp

### 6. Marketing Journey Triggers

#### Automated Journey Enrollment
- **New Lead**: When new borrower registers
- **Application Submit**: When loan application submitted
- **Milestone Update**: When loan reaches key milestones
  - Underwriting approved
  - Clear to close
  - Loan funded
- **Rate Alert**: When rate drops to target
- **Document Request**: When LO requests documents

#### Manual Journey Enrollment
- **Endpoint**: `POST /api/v1/crm/contacts/:contactId/journeys/:journeyId/enroll`
- **Access**: LO, BM, Admin only
- **Use Cases**: Re-engagement campaigns, targeted marketing, referral programs

## Environment Configuration

Required environment variables:
```bash
TOTAL_EXPERT_API_URL=https://api.totalexpert.com
TOTAL_EXPERT_CLIENT_ID=your_client_id
TOTAL_EXPERT_CLIENT_SECRET=your_client_secret
TOTAL_EXPERT_COMPANY_ID=your_company_id
```

## Authentication & Security

- **OAuth 2.0**: Client credentials flow
- **Token Caching**: In-memory cache with 5-minute expiry buffer
- **API Version**: Total Expert REST API v2
- **Scopes**: contacts.write, journeys.read, activities.write, engagement.read

## Data Flow

### Contact Sync Flow
1. User registers or updates profile in FAHM
2. Scheduler detects new/updated user
3. Service calls `totalExpertService.syncContact()`
4. Total Expert creates/updates contact
5. Returns `totalExpertContactId`
6. FAHM creates/updates CRMContact record
7. Creates CRMSyncLog entry

### Journey Enrollment Flow
1. Loan milestone updated (e.g., application submitted)
2. Controller calls `triggerMilestoneJourney()`
3. Service finds matching journey by trigger type
4. Enrolls contact in journey via Total Expert API
5. Updates CRMContact.journeyEnrollments array
6. Journey sends automated emails/SMS per schedule

### Activity Logging Flow
1. In-app event occurs (message, notification, rate alert)
2. Creates CRMActivityLog record
3. Scheduler syncs unsynced activities every 15 minutes
4. Service calls `logActivity()` for each activity
5. Total Expert logs activity to contact timeline
6. Updates `syncedAt` and `totalExpertActivityId`

### Engagement Tracking Flow
1. Borrower interacts with marketing (email open, link click)
2. Total Expert tracks engagement
3. FAHM calls `getContactEngagement()` periodically
4. Updates CRMContact.engagementScore
5. LO dashboard displays engagement metrics
6. High engagement triggers priority follow-up

## Integration Benefits

✅ **Marketing Automation**: Automated journey enrollment based on loan lifecycle  
✅ **Engagement Tracking**: Real-time engagement scores for prioritization  
✅ **Activity Logging**: Complete borrower interaction history  
✅ **Lead Management**: All FAHM users automatically added to CRM  
✅ **Campaign Analytics**: Journey completion rates and performance  
✅ **Multi-Channel**: Email, SMS, and push notifications coordinated  
✅ **Compliance**: All communications logged for audit  
✅ **Referral Tracking**: Partner and realtor engagement metrics  

## CRM Dashboard Features

### LO Dashboard
- **Pipeline View**: Shows engagement score next to each borrower
- **Active Journeys**: Displays which journeys each contact is enrolled in
- **Recent Activity**: Timeline of all touchpoints
- **Engagement Alerts**: Highlights high-engagement leads for follow-up

### Admin Dashboard
- **Journey Performance**: Enrollment count, completion rate, avg time
- **Sync Health**: CRMSyncLog monitoring for failures
- **Contact Stats**: Total contacts, new this month, engagement distribution
- **Activity Volume**: Messages, calls, emails by type and date

## Error Handling

- **Sync Failures**: Logged but don't block user operations
- **Retry Logic**: 3 attempts for activity logging
- **Error Logging**: Detailed error messages in CRMSyncLog
- **Monitoring**: Check `/api/v1/crm/sync-logs` for sync health
- **Fallback**: Queue activities for retry if CRM unavailable

## Performance Optimizations

- **Batch Processing**: Activities synced in batches of 50
- **Incremental Sync**: Only syncs changed contacts
- **Engagement Caching**: 1-hour cache for engagement scores
- **Journey Caching**: 4-hour cache for journey definitions
- **Async Processing**: All CRM operations non-blocking

## Future Enhancements

- [ ] Webhook support for real-time CRM → FAHM updates
- [ ] Co-marketing campaigns with referral partners
- [ ] Predictive lead scoring based on engagement
- [ ] A/B testing for journey variants
- [ ] Social media integration tracking
- [ ] Video engagement tracking
- [ ] AI-powered next-best-action recommendations
