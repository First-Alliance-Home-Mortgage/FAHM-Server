const express = require('express');
const { body, query } = require('express-validator');
const crmController = require('../controllers/crmController');
// Removed unused 'query' import
const { authenticate } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: CRM Integration
 *   description: Total Expert CRM integration for marketing journeys and engagement
 */

/**
 * @swagger
 * /api/v1/crm/sync/contacts:
 *   post:
 *     summary: Sync all contacts bidirectionally with Total Expert CRM
 *     tags: [CRM Integration]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Contact sync completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 recordsProcessed:
 *                   type: number
 *                 recordsSucceeded:
 *                   type: number
 *                 recordsFailed:
 *                   type: number
 *                 duration:
 *                   type: number
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Contact sync failed
 */
router.post('/sync/contacts', authenticate, crmController.syncContacts);

/**
 * @swagger
 * /api/v1/crm/contacts:
 *   get:
 *     summary: Get CRM contacts for current user
 *     tags: [CRM Integration]
 *     security:
 *       - bearerAuth: []
 *     description: Returns contacts assigned to the current user (LO) or the borrower's own contact record
 *     responses:
 *       200:
 *         description: List of CRM contacts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 contacts:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       crmContactId:
 *                         type: string
 *                       firstName:
 *                         type: string
 *                       lastName:
 *                         type: string
 *                       email:
 *                         type: string
 *                       phone:
 *                         type: string
 *                       contactType:
 *                         type: string
 *                         enum: [borrower, partner, referral_source, realtor, other]
 *                       status:
 *                         type: string
 *                         enum: [active, inactive, archived]
 *                       engagementScore:
 *                         type: number
 *                       lastEngagementDate:
 *                         type: string
 *                         format: date-time
 *                       journeys:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             journeyId:
 *                               type: string
 *                             journeyName:
 *                               type: string
 *                             status:
 *                               type: string
 *       401:
 *         description: Unauthorized
 */
router.get('/contacts', authenticate, crmController.getContacts);

/**
 * @swagger
 * /api/v1/crm/contacts/{contactId}/engagement:
 *   get:
 *     summary: Get engagement metrics for a contact
 *     tags: [CRM Integration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contactId
 *         required: true
 *         schema:
 *           type: string
 *         description: CRM Contact ID
 *     responses:
 *       200:
 *         description: Contact engagement metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 contactId:
 *                   type: string
 *                 crmContactId:
 *                   type: string
 *                 engagementScore:
 *                   type: number
 *                   example: 85
 *                 lastEngagementDate:
 *                   type: string
 *                   format: date-time
 *                 emailOpens:
 *                   type: number
 *                 emailClicks:
 *                   type: number
 *                 smsReplies:
 *                   type: number
 *                 journeys:
 *                   type: array
 *                   items:
 *                     type: object
 *       404:
 *         description: Contact not found
 *       401:
 *         description: Unauthorized
 */
router.get('/contacts/:contactId/engagement', authenticate, crmController.getContactEngagement);

/**
 * @swagger
 * /api/v1/crm/sync/journeys:
 *   post:
 *     summary: Sync all marketing journeys from Total Expert CRM
 *     tags: [CRM Integration]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Journey sync completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 recordsProcessed:
 *                   type: number
 *                 recordsSucceeded:
 *                   type: number
 *                 recordsFailed:
 *                   type: number
 *                 duration:
 *                   type: number
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Journey sync failed
 */
router.post('/sync/journeys', authenticate, crmController.syncJourneys);

/**
 * @swagger
 * /api/v1/crm/journeys:
 *   get:
 *     summary: Get all active marketing journeys
 *     tags: [CRM Integration]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of active journeys
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 journeys:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       crmJourneyId:
 *                         type: string
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       triggerType:
 *                         type: string
 *                         enum: [milestone_update, new_lead, application_submit, manual, scheduled]
 *                       status:
 *                         type: string
 *                         enum: [active, inactive, draft]
 *                       steps:
 *                         type: array
 *                         items:
 *                           type: object
 *                       metrics:
 *                         type: object
 *                         properties:
 *                           totalEnrolled:
 *                             type: number
 *                           completed:
 *                             type: number
 *                           active:
 *                             type: number
 *       401:
 *         description: Unauthorized
 */
router.get('/journeys', authenticate, crmController.getJourneys);

/**
 * @swagger
 * /api/v1/crm/contacts/{contactId}/journeys/{journeyId}/enroll:
 *   post:
 *     summary: Enroll a contact in a marketing journey
 *     tags: [CRM Integration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contactId
 *         required: true
 *         schema:
 *           type: string
 *         description: CRM Contact ID
 *       - in: path
 *         name: journeyId
 *         required: true
 *         schema:
 *           type: string
 *         description: Journey ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               metadata:
 *                 type: object
 *                 description: Additional metadata for journey enrollment
 *           example:
 *             metadata:
 *               source: "mobile_app"
 *               campaign: "spring_2024"
 *     responses:
 *       200:
 *         description: Successfully enrolled in journey
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 enrollment:
 *                   type: object
 *                   properties:
 *                     contactId:
 *                       type: string
 *                     journeyId:
 *                       type: string
 *                     journeyName:
 *                       type: string
 *                     status:
 *                       type: string
 *                     startedAt:
 *                       type: string
 *                       format: date-time
 *       404:
 *         description: Contact or journey not found
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/contacts/:contactId/journeys/:journeyId/enroll',
  authenticate,
  crmController.enrollInJourney
);

/**
 * @swagger
 * /api/v1/crm/loans/{loanId}/trigger-milestone-journey:
 *   post:
 *     summary: Trigger marketing journey based on loan milestone update
 *     tags: [CRM Integration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: loanId
 *         required: true
 *         schema:
 *           type: string
 *         description: Loan Application ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - milestone
 *             properties:
 *               milestone:
 *                 type: string
 *                 description: Milestone type that triggers the journey
 *                 example: "application_submitted"
 *           example:
 *             milestone: "underwriting_approved"
 *     responses:
 *       200:
 *         description: Milestone journey triggered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 milestone:
 *                   type: string
 *                 enrollment:
 *                   type: object
 *       404:
 *         description: Loan or borrower not found
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/loans/:loanId/trigger-milestone-journey',
  authenticate,
  body('milestone').notEmpty().withMessage('Milestone is required'),
  crmController.triggerMilestoneJourney
);

/**
 * @swagger
 * /api/v1/crm/contacts/{contactId}/activities:
 *   post:
 *     summary: Log an activity to CRM for a contact
 *     tags: [CRM Integration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contactId
 *         required: true
 *         schema:
 *           type: string
 *         description: CRM Contact ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - activityType
 *               - direction
 *             properties:
 *               activityType:
 *                 type: string
 *                 enum: [message, push_notification, email, sms, call, journey_step, milestone_update, application_submit]
 *               direction:
 *                 type: string
 *                 enum: [inbound, outbound]
 *               subject:
 *                 type: string
 *               content:
 *                 type: string
 *               metadata:
 *                 type: object
 *           example:
 *             activityType: "email"
 *             direction: "outbound"
 *             subject: "Pre-approval letter sent"
 *             content: "Sent pre-approval letter for $350,000"
 *             metadata:
 *               loanAmount: 350000
 *               propertyAddress: "123 Main St"
 *     responses:
 *       200:
 *         description: Activity logged successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 activity:
 *                   type: object
 *       404:
 *         description: Contact not found
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/contacts/:contactId/activities',
  authenticate,
  body('activityType').isIn(['message', 'push_notification', 'email', 'sms', 'call', 'journey_step', 'milestone_update', 'application_submit']),
  body('direction').isIn(['inbound', 'outbound']),
  crmController.logActivity
);

/**
 * @swagger
 * /api/v1/crm/contacts/{contactId}/activities:
 *   get:
 *     summary: Get activity history for a contact
 *     tags: [CRM Integration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contactId
 *         required: true
 *         schema:
 *           type: string
 *         description: CRM Contact ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 50
 *         description: Number of activities to return
 *       - in: query
 *         name: skip
 *         schema:
 *           type: number
 *           default: 0
 *         description: Number of activities to skip
 *     responses:
 *       200:
 *         description: Activity history retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 activities:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                     limit:
 *                       type: number
 *                     skip:
 *                       type: number
 *                     hasMore:
 *                       type: boolean
 *       404:
 *         description: Contact not found
 *       401:
 *         description: Unauthorized
 */
router.get('/contacts/:contactId/activities', authenticate, crmController.getActivityHistory);

/**
 * @swagger
 * /api/v1/crm/sync/logs:
 *   get:
 *     summary: Get CRM sync logs
 *     tags: [CRM Integration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: syncType
 *         schema:
 *           type: string
 *           enum: [contact, journey, activity, full]
 *         description: Filter by sync type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [success, partial, failed]
 *         description: Filter by sync status
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 50
 *         description: Number of logs to return
 *     responses:
 *       200:
 *         description: Sync logs retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 logs:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       syncType:
 *                         type: string
 *                       direction:
 *                         type: string
 *                       status:
 *                         type: string
 *                       recordsProcessed:
 *                         type: number
 *                       recordsSucceeded:
 *                         type: number
 *                       recordsFailed:
 *                         type: number
 *                       syncDuration:
 *                         type: number
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: Unauthorized
 */
router.get('/sync/logs', authenticate, crmController.getSyncLogs);

module.exports = router;
