const axios = require('axios');
const logger = require('../utils/logger');

class BlendPOSService {
  constructor() {
    this.apiUrl = process.env.BLEND_API_URL || 'https://api.blend.com';
    this.clientId = process.env.BLEND_CLIENT_ID;
    this.clientSecret = process.env.BLEND_CLIENT_SECRET;
    this.tokenCache = {
      accessToken: null,
      expiresAt: null
    };

    if (!this.clientId || !this.clientSecret) {
      logger.warn('Blend POS credentials not configured - integration will not work');
    }
  }

  /**
   * Get OAuth 2.0 access token with caching
   * @returns {Promise<String>} - Access token
   */
  async getAccessToken() {
    // Return cached token if still valid
    if (this.tokenCache.accessToken && this.tokenCache.expiresAt > Date.now()) {
      return this.tokenCache.accessToken;
    }

    try {
      const response = await axios.post(`${this.apiUrl}/oauth/token`, {
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret
      });

      this.tokenCache.accessToken = response.data.access_token;
      this.tokenCache.expiresAt = Date.now() + (response.data.expires_in - 300) * 1000; // 5 min buffer

      return this.tokenCache.accessToken;
    } catch (error) {
      logger.error('Blend OAuth token error:', error.response?.data || error.message);
      throw new Error('Failed to obtain Blend access token');
    }
  }

  /**
   * Create SSO handoff URL for borrower to access Blend POS
   * @param {Object} borrowerData - Borrower information
   * @param {Object} loanData - Loan application data
   * @param {Object} options - Additional options (returnUrl, etc.)
   * @returns {Promise<Object>} - SSO URL and session info
   */
  async createSSOHandoff(borrowerData, loanData, options = {}) {
    try {
      const token = await this.getAccessToken();

      const payload = {
        borrower: {
          email: borrowerData.email,
          first_name: borrowerData.firstName,
          last_name: borrowerData.lastName,
          phone: borrowerData.phone,
          ssn: borrowerData.ssn // Encrypted in transit
        },
        loan: {
          loan_amount: loanData.loanAmount,
          property_address: loanData.propertyAddress,
          property_value: loanData.propertyValue,
          loan_purpose: loanData.loanPurpose,
          product_type: loanData.productType
        },
        branding: {
          logo_url: options.logoUrl || 'https://fahm.com/logo.png',
          primary_color: options.primaryColor || '#003B5C',
          return_url: options.returnUrl || 'https://app.fahm.com/dashboard'
        },
        metadata: {
          fahm_loan_id: loanData.fahmLoanId,
          loan_officer_id: loanData.loanOfficerId,
          referral_source: loanData.referralSource
        }
      };

      const response = await axios.post(`${this.apiUrl}/v1/applications`, payload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });

      return {
        success: true,
        applicationId: response.data.application_id,
        ssoUrl: response.data.sso_url,
        expiresAt: new Date(Date.now() + 3600000), // 1 hour
        sessionToken: response.data.session_token
      };
    } catch (error) {
      logger.error('Blend SSO handoff error:', error.response?.data || error.message);
      throw new Error(`Failed to create Blend SSO handoff: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get application status from Blend
   * @param {String} applicationId - Blend application ID
   * @returns {Promise<Object>} - Application status and details
   */
  async getApplicationStatus(applicationId) {
    try {
      const token = await this.getAccessToken();

      const response = await axios.get(`${this.apiUrl}/v1/applications/${applicationId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        timeout: 10000
      });

      return {
        success: true,
        application: {
          id: response.data.application_id,
          status: response.data.status, // draft, submitted, processing, approved, declined
          completionPercentage: response.data.completion_percentage,
          lastUpdated: response.data.updated_at,
          borrower: {
            name: `${response.data.borrower.first_name} ${response.data.borrower.last_name}`,
            email: response.data.borrower.email
          },
          loan: {
            loanAmount: response.data.loan.loan_amount,
            propertyAddress: response.data.loan.property_address
          },
          documents: response.data.documents || []
        }
      };
    } catch (error) {
      logger.error('Blend get application status error:', error.response?.data || error.message);
      throw new Error(`Failed to get Blend application status: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Sync borrower data to Blend application
   * @param {String} applicationId - Blend application ID
   * @param {Object} borrowerData - Updated borrower data
   * @returns {Promise<Object>} - Sync result
   */
  async syncBorrowerData(applicationId, borrowerData) {
    try {
      const token = await this.getAccessToken();

      const payload = {
        borrower: {
          email: borrowerData.email,
          first_name: borrowerData.firstName,
          last_name: borrowerData.lastName,
          phone: borrowerData.phone,
          date_of_birth: borrowerData.dateOfBirth,
          ssn: borrowerData.ssn
        }
      };

      const response = await axios.patch(`${this.apiUrl}/v1/applications/${applicationId}/borrower`, payload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      return {
        success: true,
        message: 'Borrower data synced successfully',
        updatedAt: response.data.updated_at
      };
    } catch (error) {
      logger.error('Blend sync borrower data error:', error.response?.data || error.message);
      throw new Error(`Failed to sync borrower data to Blend: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Upload document to Blend application
   * @param {String} applicationId - Blend application ID
   * @param {Object} documentData - Document information and file
   * @returns {Promise<Object>} - Upload result
   */
  async uploadDocument(applicationId, documentData) {
    try {
      const token = await this.getAccessToken();

      const formData = new FormData();
      formData.append('document_type', documentData.documentType);
      formData.append('file', documentData.file);
      formData.append('description', documentData.description || '');

      const response = await axios.post(
        `${this.apiUrl}/v1/applications/${applicationId}/documents`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          },
          timeout: 30000
        }
      );

      return {
        success: true,
        documentId: response.data.document_id,
        status: response.data.status,
        uploadedAt: response.data.uploaded_at
      };
    } catch (error) {
      logger.error('Blend upload document error:', error.response?.data || error.message);
      throw new Error(`Failed to upload document to Blend: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get documents for Blend application
   * @param {String} applicationId - Blend application ID
   * @returns {Promise<Object>} - List of documents
   */
  async getDocuments(applicationId) {
    try {
      const token = await this.getAccessToken();

      const response = await axios.get(`${this.apiUrl}/v1/applications/${applicationId}/documents`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        timeout: 10000
      });

      return {
        success: true,
        documents: response.data.documents.map(doc => ({
          id: doc.document_id,
          type: doc.document_type,
          name: doc.file_name,
          status: doc.status,
          uploadedAt: doc.uploaded_at,
          downloadUrl: doc.download_url
        }))
      };
    } catch (error) {
      logger.error('Blend get documents error:', error.response?.data || error.message);
      throw new Error(`Failed to get Blend documents: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Submit application to underwriting
   * @param {String} applicationId - Blend application ID
   * @returns {Promise<Object>} - Submission result
   */
  async submitApplication(applicationId) {
    try {
      const token = await this.getAccessToken();

      const response = await axios.post(
        `${this.apiUrl}/v1/applications/${applicationId}/submit`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`
          },
          timeout: 10000
        }
      );

      return {
        success: true,
        status: response.data.status,
        submittedAt: response.data.submitted_at,
        confirmationNumber: response.data.confirmation_number
      };
    } catch (error) {
      logger.error('Blend submit application error:', error.response?.data || error.message);
      throw new Error(`Failed to submit Blend application: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Verify webhook signature for security
   * @param {Object} payload - Webhook payload
   * @param {String} signature - Webhook signature header
   * @returns {Boolean} - Valid signature
   */
  verifyWebhookSignature(payload, signature) {
    // Implement HMAC signature verification
    // For now, return true (implement with crypto.createHmac when webhook secret available)
    logger.warn('Blend webhook signature verification not implemented');
    return true;
  }

  /**
   * Process webhook event from Blend
   * @param {Object} event - Webhook event
   * @returns {Promise<Object>} - Processing result
   */
  async processWebhookEvent(event) {
    try {
      logger.info('Processing Blend webhook event:', event.event_type);

      const result = {
        eventType: event.event_type,
        applicationId: event.application_id,
        timestamp: event.timestamp,
        processed: true
      };

      switch (event.event_type) {
        case 'application.created':
          result.action = 'Application created';
          break;
        
        case 'application.submitted':
          result.action = 'Application submitted - trigger CRM and Encompass sync';
          result.shouldSyncCRM = true;
          result.shouldSyncEncompass = true;
          break;
        
        case 'application.approved':
          result.action = 'Application approved';
          result.shouldNotifyBorrower = true;
          break;
        
        case 'application.declined':
          result.action = 'Application declined';
          result.shouldNotifyBorrower = true;
          break;
        
        case 'document.uploaded':
          result.action = 'Document uploaded';
          result.documentId = event.document_id;
          break;
        
        case 'document.reviewed':
          result.action = 'Document reviewed';
          result.documentStatus = event.document_status;
          break;
        
        default:
          result.action = 'Unknown event type';
          logger.warn('Unknown Blend webhook event type:', event.event_type);
      }

      return result;
    } catch (error) {
      logger.error('Blend webhook processing error:', error);
      throw error;
    }
  }
}

module.exports = new BlendPOSService();
