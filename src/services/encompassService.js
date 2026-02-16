const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');
const { integrations } = require('../config/env');

/**
 * Encompass API Service
 * Handles integration with Encompass LOS via Partner Connect API
 *
 * Auth reference: https://developer.icemortgagetechnology.com/developer-connect/docs/authentication
 *
 * Supported grant types:
 *  - "password"             (Resource Owner Password Credentials – for lenders)
 *  - "client_credentials"   (for ISV partners only)
 */

const TOKEN_SAFETY_MARGIN_MS = 5 * 60 * 1000; // Re-authenticate 5 min before expiry

class EncompassService {
  constructor() {
    this.baseUrl = integrations.encompass || 'https://api.elliemae.com';
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  // ───────────────────────────────────────────────────────────────
  //  Authentication
  // ───────────────────────────────────────────────────────────────

  /**
   * Get access token for Encompass API
   * Supports both "password" (lender) and "client_credentials" (ISV) grant types.
   * Tokens are cached and refreshed 5 minutes before expiry.
   */
  async getAccessToken() {
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const clientId = integrations.encompassClientId;
    const clientSecret = integrations.encompassClientSecret;
    const instanceId = integrations.encompassInstanceId;
    const grantType = integrations.encompassGrantType || 'password';

    if (!clientId || !clientSecret) {
      throw new Error('Missing Encompass OAuth credentials (client_id / client_secret)');
    }

    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const params = new URLSearchParams();

    if (grantType === 'password') {
      // Resource Owner Password Credentials – for lenders
      const username = integrations.encompassUsername;
      const password = integrations.encompassPassword;

      if (!username || !password || !instanceId) {
        throw new Error(
          'Missing Encompass credentials for password grant (ENCOMPASS_USERNAME, ENCOMPASS_PASSWORD, ENCOMPASS_INSTANCE_ID)'
        );
      }

      params.append('grant_type', 'password');
      params.append('username', `${username}@encompass:${instanceId}`);
      params.append('password', password);
    } else if (grantType === 'client_credentials') {
      // Client Credentials – ISV partners only
      if (!instanceId) {
        throw new Error('Missing ENCOMPASS_INSTANCE_ID for client_credentials grant');
      }

      params.append('grant_type', 'client_credentials');
      params.append('instance_id', instanceId);
      params.append('scope', 'lp');
    } else {
      throw new Error(`Unsupported Encompass grant type: ${grantType}`);
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/oauth2/v1/token`,
        params,
        {
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      this.accessToken = response.data.access_token;

      // Cache token with safety margin.
      // Encompass tokens are active for up to 30 min but expire early
      // if not used within 15 min. We refresh 5 min before expiry.
      const expiresInMs = (response.data.expires_in || 1800) * 1000;
      this.tokenExpiry = Date.now() + expiresInMs - TOKEN_SAFETY_MARGIN_MS;

      logger.info('Encompass access token obtained', { grantType });
      return this.accessToken;
    } catch (err) {
      this.accessToken = null;
      this.tokenExpiry = null;
      const detail = this._parseApiError(err);
      logger.error('Failed to get Encompass access token', { error: detail });
      throw new Error(`Encompass authentication failed: ${detail}`);
    }
  }

  /**
   * Introspect a token to check if it's still active.
   * Returns the introspection payload or null if the token is inactive.
   */
  async introspectToken(token) {
    const clientId = integrations.encompassClientId;
    const clientSecret = integrations.encompassClientSecret;

    if (!clientId || !clientSecret) {
      throw new Error('Missing Encompass OAuth credentials for introspection');
    }

    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const params = new URLSearchParams();
    params.append('token', token || this.accessToken);

    try {
      const response = await axios.post(
        `${this.baseUrl}/oauth2/v1/token/introspection`,
        params,
        {
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      return response.data;
    } catch (err) {
      logger.error('Token introspection failed', { error: this._parseApiError(err) });
      return null;
    }
  }

  /**
   * Revoke the current access token.
   * Returns true on success.
   */
  async revokeToken() {
    if (!this.accessToken) return true;

    const clientId = integrations.encompassClientId;
    const clientSecret = integrations.encompassClientSecret;
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const params = new URLSearchParams();
    params.append('token', this.accessToken);

    try {
      await axios.post(
        `${this.baseUrl}/oauth2/v1/token/revocation`,
        params,
        {
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      this.accessToken = null;
      this.tokenExpiry = null;
      logger.info('Encompass access token revoked');
      return true;
    } catch (err) {
      logger.error('Token revocation failed', { error: this._parseApiError(err) });
      return false;
    }
  }

  /**
   * Force-clear the cached token so the next API call re-authenticates.
   */
  clearToken() {
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Build Authorization header for Encompass API calls.
   */
  async _authHeaders() {
    const token = await this.getAccessToken();
    return { Authorization: `Bearer ${token}` };
  }

  // ───────────────────────────────────────────────────────────────
  //  Status / Connectivity
  // ───────────────────────────────────────────────────────────────

  async getStatus() {
    try {
      const headers = await this._authHeaders();
      const response = await axios.get(`${this.baseUrl}/encompass/v3/loans`, {
        headers,
        params: { limit: 1 },
      });
      return { ok: true, loanCount: response.data?.length ?? 0 };
    } catch (err) {
      logger.error('Failed to fetch Encompass status', { error: this._parseApiError(err) });
      throw err;
    }
  }

  // ───────────────────────────────────────────────────────────────
  //  Loan Operations
  // ───────────────────────────────────────────────────────────────

  /**
   * Fetch loan details from Encompass
   */
  async getLoanDetails(encompassLoanId) {
    try {
      const headers = await this._authHeaders();
      const response = await axios.get(
        `${this.baseUrl}/encompass/v3/loans/${encompassLoanId}`,
        { headers }
      );
      return response.data;
    } catch (err) {
      logger.error('Failed to fetch Encompass loan details', {
        loanId: encompassLoanId,
        error: this._parseApiError(err),
      });
      throw this._wrapError(err, 'Failed to fetch loan details from Encompass');
    }
  }

  /**
   * Get loan milestones from Encompass
   */
  async getLoanMilestones(encompassLoanId) {
    try {
      const headers = await this._authHeaders();
      const response = await axios.get(
        `${this.baseUrl}/encompass/v3/loans/${encompassLoanId}/milestones`,
        { headers }
      );
      return this.transformMilestones(response.data);
    } catch (err) {
      logger.error('Failed to fetch Encompass milestones', {
        loanId: encompassLoanId,
        error: this._parseApiError(err),
      });
      return [];
    }
  }

  /**
   * Get loan contacts from Encompass
   */
  async getLoanContacts(encompassLoanId) {
    try {
      const headers = await this._authHeaders();
      const response = await axios.get(
        `${this.baseUrl}/encompass/v3/loans/${encompassLoanId}/associates`,
        { headers }
      );
      return this.transformContacts(response.data);
    } catch (err) {
      logger.error('Failed to fetch Encompass contacts', {
        loanId: encompassLoanId,
        error: this._parseApiError(err),
      });
      return [];
    }
  }

  /**
   * Update loan status in Encompass
   */
  async updateLoanStatus(encompassLoanId, status, milestones) {
    try {
      const headers = await this._authHeaders();
      await axios.patch(
        `${this.baseUrl}/encompass/v3/loans/${encompassLoanId}`,
        { loanStatus: status, milestones: milestones || [] },
        { headers }
      );
      return true;
    } catch (err) {
      logger.error('Failed to update Encompass loan status', {
        loanId: encompassLoanId,
        error: this._parseApiError(err),
      });
      throw this._wrapError(err, 'Failed to update loan status in Encompass');
    }
  }

  // ───────────────────────────────────────────────────────────────
  //  Document / eFolder Operations
  // ───────────────────────────────────────────────────────────────

  /**
   * Upload document to Encompass eFolder.
   *
   * Encompass eFolder upload is a two-step process:
   *  1. Create the attachment metadata (POST /attachments)
   *  2. Upload the file content (PUT /attachments/{id}/upload)
   */
  async uploadDocument(encompassLoanId, documentData) {
    try {
      const headers = await this._authHeaders();

      // Step 1 – Create attachment metadata
      const metaResponse = await axios.post(
        `${this.baseUrl}/encompass/v3/loans/${encompassLoanId}/attachments`,
        {
          title: documentData.title || 'Uploaded Document',
          document: { entityType: documentData.documentType || 'Other' },
        },
        { headers: { ...headers, 'Content-Type': 'application/json' } }
      );

      const attachmentId =
        metaResponse.data?.attachmentId || metaResponse.data?.id;

      if (!attachmentId) {
        throw new Error('Encompass did not return an attachmentId');
      }

      // Step 2 – Upload file content
      const fileBuffer = Buffer.from(documentData.file.content, 'base64');
      await axios.put(
        `${this.baseUrl}/encompass/v3/loans/${encompassLoanId}/attachments/${attachmentId}`,
        fileBuffer,
        {
          headers: {
            ...headers,
            'Content-Type': documentData.file.contentType || 'application/pdf',
          },
        }
      );

      return { attachmentId, title: documentData.title };
    } catch (err) {
      logger.error('Failed to upload document to Encompass', {
        loanId: encompassLoanId,
        error: this._parseApiError(err),
      });
      throw this._wrapError(err, 'Failed to upload document to Encompass');
    }
  }

  /**
   * Get documents from Encompass
   */
  async getDocuments(encompassLoanId) {
    try {
      const headers = await this._authHeaders();
      const response = await axios.get(
        `${this.baseUrl}/encompass/v3/loans/${encompassLoanId}/attachments`,
        { headers }
      );
      return this.transformDocuments(response.data);
    } catch (err) {
      logger.error('Failed to fetch Encompass documents', {
        loanId: encompassLoanId,
        error: this._parseApiError(err),
      });
      return [];
    }
  }

  /**
   * Download a specific document from Encompass
   */
  async downloadDocument(encompassLoanId, attachmentId) {
    try {
      const headers = await this._authHeaders();
      const response = await axios.get(
        `${this.baseUrl}/encompass/v3/loans/${encompassLoanId}/attachments/${attachmentId}`,
        { headers, responseType: 'arraybuffer' }
      );

      return {
        data: response.data,
        contentType: response.headers['content-type'],
        filename: response.headers['content-disposition']?.match(/filename="?(.+)"?/)?.[1],
      };
    } catch (err) {
      logger.error('Failed to download Encompass document', {
        loanId: encompassLoanId,
        attachmentId,
        error: this._parseApiError(err),
      });
      throw this._wrapError(err, 'Failed to download document from Encompass');
    }
  }

  // ───────────────────────────────────────────────────────────────
  //  Messaging
  // ───────────────────────────────────────────────────────────────

  /**
   * Send message/note to Encompass
   */
  async sendMessage(encompassLoanId, message) {
    try {
      const headers = await this._authHeaders();
      await axios.post(
        `${this.baseUrl}/encompass/v3/loans/${encompassLoanId}/notes`,
        {
          noteText: message.content,
          dateCreated: message.createdAt || new Date().toISOString(),
          createdBy: message.senderName || 'FAHM App',
        },
        { headers }
      );
      return true;
    } catch (err) {
      logger.error('Failed to send message to Encompass', {
        loanId: encompassLoanId,
        error: this._parseApiError(err),
      });
      return false;
    }
  }

  // ───────────────────────────────────────────────────────────────
  //  Webhook Verification
  // ───────────────────────────────────────────────────────────────

  /**
   * Verify webhook signature from Encompass (HMAC-SHA256)
   */
  verifyWebhookSignature(payload, signature, secret) {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  // ───────────────────────────────────────────────────────────────
  //  Data Transformers
  // ───────────────────────────────────────────────────────────────

  transformMilestones(encompassMilestones) {
    if (!Array.isArray(encompassMilestones)) return [];

    return encompassMilestones.map((m) => ({
      name: m.milestoneName || m.name,
      status: this.mapMilestoneStatus(m.status || m.completed),
      updatedAt: m.completedDate || m.updatedAt || new Date(),
    }));
  }

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

  transformDocuments(encompassDocuments) {
    if (!Array.isArray(encompassDocuments)) return [];

    return encompassDocuments.map((doc) => ({
      id: doc.attachmentId || doc.id,
      title: doc.title || doc.name,
      documentType: doc.documentType || doc.type || 'other',
      mimeType: doc.mediaType || doc.mimeType,
      size: doc.fileSize || doc.size,
      createdAt: doc.dateCreated || doc.createdAt,
      createdBy: doc.createdByName || doc.createdBy,
      isActive: doc.isActive !== false,
    }));
  }

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

  // ───────────────────────────────────────────────────────────────
  //  Error Helpers
  // ───────────────────────────────────────────────────────────────

  /**
   * Extract a human-readable error message from an Axios error / Encompass response.
   */
  _parseApiError(err) {
    if (err.response) {
      const data = err.response.data;
      // Encompass errors may come as { summary, details, errorCode } or plain string
      if (typeof data === 'object' && data !== null) {
        return data.summary || data.message || data.error || JSON.stringify(data);
      }
      if (typeof data === 'string' && data.length < 500) {
        return data;
      }
      return `HTTP ${err.response.status}`;
    }
    return err.message;
  }

  /**
   * Wrap an Axios error with a user-friendly message while preserving status code.
   */
  _wrapError(err, fallbackMessage) {
    const detail = this._parseApiError(err);
    const wrapped = new Error(`${fallbackMessage}: ${detail}`);
    wrapped.status = err.response?.status || 500;
    return wrapped;
  }
}

module.exports = new EncompassService();
