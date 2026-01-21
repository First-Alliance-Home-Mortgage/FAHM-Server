const axios = require('axios');
const logger = require('../utils/logger');
const { integrations } = require('../config/env');

/**
 * Encompass API Service
 * Handles integration with Encompass LOS via Partner Connect API
 */

class EncompassService {
  constructor() {
    this.baseUrl = integrations.encompass || 'https://api.elliemae.com';
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Get access token for Encompass API
   * In production, implement OAuth 2.0 flow
   */
  async getAccessToken() {
    // Use cached token if valid
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }
    try {
      const clientId = process.env.ENCOMPASS_CLIENT_ID;
      const clientSecret = process.env.ENCOMPASS_CLIENT_SECRET;
      const instanceId = process.env.ENCOMPASS_INSTANCE_ID;
      if (!clientId || !clientSecret || !instanceId) {
        throw new Error('Missing Encompass OAuth credentials or instance ID');
      }
      const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const params = new URLSearchParams();
      params.append('grant_type', 'client_credentials');
      params.append('instance_id', instanceId);
      params.append('scope', 'lp');

      const response = await axios.post(
        `${this.baseUrl}/oauth2/v1/token`,
        params,
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
      return this.accessToken;
    } catch (err) {
      logger.error('Failed to get Encompass access token', { error: err.message });
      throw new Error('Encompass authentication failed');
    }
  }

  async getStatus() {
    try {
      const token = await this.getAccessToken();
      const response = await axios.get(`${this.baseUrl}/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data;
    } catch (err) {
      logger.error('Failed to fetch Encompass status', { error: err.message });
      throw err;
    }
  }

  /**
   * Fetch loan details from Encompass
   */
  async getLoanDetails(encompassLoanId) {
    try {
      const token = await this.getAccessToken();
      const response = await axios.get(`${this.baseUrl}/encompass/v3/loans/${encompassLoanId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      return response.data;
    } catch (err) {
      logger.error('Failed to fetch Encompass loan details', {
        loanId: encompassLoanId,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * Get loan milestones from Encompass
   */
  async getLoanMilestones(encompassLoanId) {
    try {
      const token = await this.getAccessToken();
      const response = await axios.get(`${this.baseUrl}/encompass/v3/loans/${encompassLoanId}/milestones`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      return this.transformMilestones(response.data);
    } catch (err) {
      logger.error('Failed to fetch Encompass milestones', {
        loanId: encompassLoanId,
        error: err.message,
      });
      return [];
    }
  }

  /**
   * Get loan contacts from Encompass
   */
  async getLoanContacts(encompassLoanId) {
    try {
      const token = await this.getAccessToken();
      const response = await axios.get(`${this.baseUrl}/encompass/v3/loans/${encompassLoanId}/associates`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      return this.transformContacts(response.data);
    } catch (err) {
      logger.error('Failed to fetch Encompass contacts', {
        loanId: encompassLoanId,
        error: err.message,
      });
      return [];
    }
  }

  /**
   * Update loan status in Encompass
   */
  async updateLoanStatus(encompassLoanId, status, milestones) {
    try {
      const token = await this.getAccessToken();
      await axios.patch(
        `${this.baseUrl}/encompass/v3/loans/${encompassLoanId}`,
        {
          loanStatus: status,
          milestones: milestones || [],
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      return true;
    } catch (err) {
      logger.error('Failed to update Encompass loan status', {
        loanId: encompassLoanId,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * Upload document to Encompass
   */
  async uploadDocument(encompassLoanId, documentData) {
    try {
      const token = await this.getAccessToken();
      const response = await axios.post(
        `${this.baseUrl}/encompass/v3/loans/${encompassLoanId}/attachments`,
        documentData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (err) {
      logger.error('Failed to upload document to Encompass', {
        loanId: encompassLoanId,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * Send message/note to Encompass
   */
  async sendMessage(encompassLoanId, message) {
    try {
      const token = await this.getAccessToken();
      await axios.post(
        `${this.baseUrl}/encompass/v3/loans/${encompassLoanId}/notes`,
        {
          noteText: message.content,
          dateCreated: message.createdAt || new Date().toISOString(),
          createdBy: message.senderName || 'FAHM App',
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      return true;
    } catch (err) {
      logger.error('Failed to send message to Encompass', {
        loanId: encompassLoanId,
        error: err.message,
      });
      return false;
    }
  }

  /**
   * Transform Encompass milestones to FAHM format
   */
  transformMilestones(encompassMilestones) {
    if (!Array.isArray(encompassMilestones)) return [];

    return encompassMilestones.map((m) => ({
      name: m.milestoneName || m.name,
      status: this.mapMilestoneStatus(m.status || m.completed),
      updatedAt: m.completedDate || m.updatedAt || new Date(),
    }));
  }

  /**
   * Transform Encompass contacts to FAHM format
   */
  transformContacts(encompassContacts) {
    if (!Array.isArray(encompassContacts)) return [];

    return encompassContacts.map((c) => ({
      role: this.mapContactRole(c.role || c.contactType),
      name: c.fullName || c.name,
      email: c.email,
      phone: c.phone || c.cellPhone,
      encompassId: c.id || c.userId,
      isPrimary: c.isPrimary || false,
    }));
  }

  /**
   * Map Encompass milestone status to FAHM status
   */
  mapMilestoneStatus(encompassStatus) {
    if (typeof encompassStatus === 'boolean') {
      return encompassStatus ? 'completed' : 'pending';
    }

    const statusMap = {
      completed: 'completed',
      'in progress': 'in_progress',
      'in-progress': 'in_progress',
      pending: 'pending',
      started: 'in_progress',
    };

    return statusMap[encompassStatus?.toLowerCase()] || 'pending';
  }

  /**
   * Map Encompass contact role to FAHM role
   */
  mapContactRole(encompassRole) {
    const roleMap = {
      'loan officer': 'loan_officer',
      lo: 'loan_officer',
      processor: 'processor',
      underwriter: 'underwriter',
      closer: 'closer',
      'closing coordinator': 'closer',
    };

    return roleMap[encompassRole?.toLowerCase()] || 'other';
  }
}

module.exports = new EncompassService();
