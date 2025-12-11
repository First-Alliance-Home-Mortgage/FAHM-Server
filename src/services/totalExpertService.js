const axios = require('axios');
const logger = require('../utils/logger');

class TotalExpertService {
  constructor() {
    this.baseURL = process.env.TOTAL_EXPERT_API_URL || 'https://api.totalexpert.com';
    this.clientId = process.env.TOTAL_EXPERT_CLIENT_ID;
    this.clientSecret = process.env.TOTAL_EXPERT_CLIENT_SECRET;
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Get OAuth 2.0 access token
   */
  async getAccessToken() {
    try {
      // Return cached token if still valid
      if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
        return this.accessToken;
      }

      logger.info('Requesting new Total Expert access token');

      const response = await axios.post(`${this.baseURL}/oauth/token`, {
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret
      });

      this.accessToken = response.data.access_token;
      // Set expiry to 5 minutes before actual expiry
      this.tokenExpiry = Date.now() + (response.data.expires_in - 300) * 1000;

      return this.accessToken;
    } catch (error) {
      logger.error('Failed to get Total Expert access token', { error: error.message });
      throw error;
    }
  }

  /**
   * Get authenticated axios instance
   */
  async getClient() {
    const token = await this.getAccessToken();
    return axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Get contact details from Total Expert
   */
  async getContact(contactId) {
    try {
      const client = await this.getClient();
      const response = await client.get(`/v1/contacts/${contactId}`);
      return this.transformContact(response.data);
    } catch (error) {
      logger.error(`Failed to get contact ${contactId} from Total Expert`, { error: error.message });
      throw error;
    }
  }

  /**
   * Sync contact to Total Expert (create or update)
   */
  async syncContact(contactData) {
    try {
      const client = await this.getClient();
      const payload = this.transformContactToTE(contactData);

      let response;
      if (contactData.crmContactId) {
        // Update existing contact
        response = await client.put(`/v1/contacts/${contactData.crmContactId}`, payload);
      } else {
        // Create new contact
        response = await client.post('/v1/contacts', payload);
      }

      return {
        crmContactId: response.data.id,
        ...this.transformContact(response.data)
      };
    } catch (error) {
      logger.error('Failed to sync contact to Total Expert', { error: error.message });
      throw error;
    }
  }

  /**
   * Get all contacts assigned to a user
   */
  async getContactsByAssignedUser(userId) {
    try {
      const client = await this.getClient();
      const response = await client.get('/v1/contacts', {
        params: {
          assigned_to: userId,
          limit: 100
        }
      });

      return response.data.contacts.map(contact => this.transformContact(contact));
    } catch (error) {
      logger.error('Failed to get contacts from Total Expert', { error: error.message });
      throw error;
    }
  }

  /**
   * Get journey details
   */
  async getJourney(journeyId) {
    try {
      const client = await this.getClient();
      const response = await client.get(`/v1/campaigns/${journeyId}`);
      return this.transformJourney(response.data);
    } catch (error) {
      logger.error(`Failed to get journey ${journeyId} from Total Expert`, { error: error.message });
      throw error;
    }
  }

  /**
   * Get all active journeys
   */
  async getAllJourneys() {
    try {
      const client = await this.getClient();
      const response = await client.get('/v1/campaigns', {
        params: {
          status: 'active',
          limit: 100
        }
      });

      return response.data.campaigns.map(journey => this.transformJourney(journey));
    } catch (error) {
      logger.error('Failed to get journeys from Total Expert', { error: error.message });
      throw error;
    }
  }

  /**
   * Enroll contact in a journey
   */
  async enrollInJourney(contactId, journeyId, metadata = {}) {
    try {
      const client = await this.getClient();
      const response = await client.post(`/v1/campaigns/${journeyId}/enrollments`, {
        contact_id: contactId,
        metadata
      });

      return {
        enrollmentId: response.data.id,
        status: response.data.status,
        startedAt: new Date(response.data.started_at)
      };
    } catch (error) {
      logger.error(`Failed to enroll contact ${contactId} in journey ${journeyId}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Get contact engagement metrics
   */
  async getContactEngagement(contactId) {
    try {
      const client = await this.getClient();
      const response = await client.get(`/v1/contacts/${contactId}/engagement`);

      return {
        engagementScore: response.data.score || 0,
        lastEngagementDate: response.data.last_activity ? new Date(response.data.last_activity) : null,
        emailOpens: response.data.email_opens || 0,
        emailClicks: response.data.email_clicks || 0,
        smsReplies: response.data.sms_replies || 0
      };
    } catch (error) {
      logger.error(`Failed to get engagement for contact ${contactId}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Log activity to Total Expert
   */
  async logActivity(activityData) {
    try {
      const client = await this.getClient();
      const payload = this.transformActivityToTE(activityData);

      const response = await client.post('/v1/activities', payload);

      return {
        crmActivityId: response.data.id,
        syncedAt: new Date()
      };
    } catch (error) {
      logger.error('Failed to log activity to Total Expert', { error: error.message });
      throw error;
    }
  }

  /**
   * Trigger journey based on milestone update
   */
  async triggerMilestoneJourney(contactId, milestoneType, loanData) {
    try {
      const client = await this.getClient();
      
      // Find journey configured for this milestone type
      const response = await client.get('/v1/campaigns', {
        params: {
          trigger_type: 'milestone_update',
          trigger_value: milestoneType
        }
      });

      if (response.data.campaigns.length === 0) {
        logger.info(`No journey configured for milestone type: ${milestoneType}`);
        return null;
      }

      const journey = response.data.campaigns[0];
      return await this.enrollInJourney(contactId, journey.id, {
        milestone: milestoneType,
        loan_id: loanData.loanId,
        loan_status: loanData.status
      });
    } catch (error) {
      logger.error('Failed to trigger milestone journey', { error: error.message });
      throw error;
    }
  }

  /**
   * Transform Total Expert contact to FAHM format
   */
  transformContact(teContact) {
    return {
      crmContactId: teContact.id,
      firstName: teContact.first_name,
      lastName: teContact.last_name,
      email: teContact.email,
      phone: teContact.phone,
      contactType: this.mapContactType(teContact.type),
      status: teContact.status === 'active' ? 'active' : 'inactive',
      tags: teContact.tags || [],
      customFields: teContact.custom_fields || {},
      lastSyncedAt: new Date()
    };
  }

  /**
   * Transform FAHM contact to Total Expert format
   */
  transformContactToTE(fahmContact) {
    return {
      first_name: fahmContact.firstName,
      last_name: fahmContact.lastName,
      email: fahmContact.email,
      phone: fahmContact.phone,
      type: this.mapContactTypeToTE(fahmContact.contactType),
      status: fahmContact.status === 'active' ? 'active' : 'inactive',
      tags: fahmContact.tags || [],
      custom_fields: fahmContact.customFields || {}
    };
  }

  /**
   * Transform Total Expert journey to FAHM format
   */
  transformJourney(teJourney) {
    return {
      crmJourneyId: teJourney.id,
      name: teJourney.name,
      description: teJourney.description,
      status: teJourney.status,
      triggerType: this.mapTriggerType(teJourney.trigger_type),
      steps: (teJourney.steps || []).map(step => ({
        stepId: step.id,
        name: step.name,
        type: this.mapStepType(step.type),
        delayMinutes: step.delay_minutes || 0,
        content: step.content
      })),
      metrics: {
        totalEnrolled: teJourney.total_enrolled || 0,
        completed: teJourney.completed || 0,
        active: teJourney.active || 0
      },
      lastSyncedAt: new Date()
    };
  }

  /**
   * Transform FAHM activity to Total Expert format
   */
  transformActivityToTE(fahmActivity) {
    return {
      contact_id: fahmActivity.crmContactId,
      type: this.mapActivityTypeToTE(fahmActivity.activityType),
      direction: fahmActivity.direction,
      subject: fahmActivity.subject,
      content: fahmActivity.content,
      performed_by: fahmActivity.performedBy,
      occurred_at: fahmActivity.createdAt || new Date(),
      metadata: fahmActivity.metadata || {}
    };
  }

  /**
   * Map contact type from Total Expert to FAHM
   */
  mapContactType(teType) {
    const mapping = {
      'borrower': 'borrower',
      'partner': 'partner',
      'referral': 'referral_source',
      'realtor': 'realtor',
      'other': 'other'
    };
    return mapping[teType] || 'other';
  }

  /**
   * Map contact type from FAHM to Total Expert
   */
  mapContactTypeToTE(fahmType) {
    const mapping = {
      'borrower': 'borrower',
      'partner': 'partner',
      'referral_source': 'referral',
      'realtor': 'realtor',
      'other': 'other'
    };
    return mapping[fahmType] || 'other';
  }

  /**
   * Map trigger type from Total Expert to FAHM
   */
  mapTriggerType(teType) {
    const mapping = {
      'milestone': 'milestone_update',
      'new_lead': 'new_lead',
      'application': 'application_submit',
      'manual': 'manual',
      'scheduled': 'scheduled'
    };
    return mapping[teType] || 'manual';
  }

  /**
   * Map step type from Total Expert to FAHM
   */
  mapStepType(teType) {
    const mapping = {
      'email': 'email',
      'sms': 'sms',
      'push': 'push_notification',
      'task': 'task',
      'wait': 'wait'
    };
    return mapping[teType] || 'email';
  }

  /**
   * Map activity type from FAHM to Total Expert
   */
  mapActivityTypeToTE(fahmType) {
    const mapping = {
      'message': 'note',
      'push_notification': 'notification',
      'email': 'email',
      'sms': 'sms',
      'call': 'call',
      'journey_step': 'campaign_activity',
      'milestone_update': 'milestone',
      'application_submit': 'application'
    };
    return mapping[fahmType] || 'note';
  }
}

module.exports = new TotalExpertService();
