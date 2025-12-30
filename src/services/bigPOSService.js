const axios = require('axios');
const logger = require('../utils/logger');

class BigPOSService {
  constructor() {
    this.apiUrl = process.env.BIG_POS_API_URL || 'https://api.bigpos.example.com';
    this.clientId = process.env.BIG_POS_CLIENT_ID;
    this.clientSecret = process.env.BIG_POS_CLIENT_SECRET;
    this.tokenCache = {
      accessToken: null,
      expiresAt: null
    };

    if (!this.clientId || !this.clientSecret) {
      logger.warn('Big POS credentials not configured - integration will not work');
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
        client_secret: this.clientSecret,
        scope: 'application:read application:write document:upload'
      });

      this.tokenCache.accessToken = response.data.access_token;
      this.tokenCache.expiresAt = Date.now() + (response.data.expires_in - 300) * 1000; // 5 min buffer

      return this.tokenCache.accessToken;
    } catch (error) {
      logger.error('Big POS OAuth token error:', error.response?.data || error.message);
      throw new Error('Failed to obtain Big POS access token');
    }
  }

  /**
   * Create SSO handoff URL for borrower to access Big POS
   * @param {Object} borrowerData - Borrower information
   * @param {Object} loanData - Loan application data
   * @param {Object} options - Additional options (returnUrl, etc.)
   * @returns {Promise<Object>} - SSO URL and session info
   */
  async createSSOHandoff(borrowerData, loanData, options = {}) {
    try {
      const token = await this.getAccessToken();

      const payload = {
        applicant: {
          email: borrowerData.email,
          firstName: borrowerData.firstName,
          lastName: borrowerData.lastName,
          phoneNumber: borrowerData.phone,
          ssn: borrowerData.ssn
        },
        loanDetails: {
          loanAmount: loanData.loanAmount,
          propertyAddress: loanData.propertyAddress,
          estimatedPropertyValue: loanData.propertyValue,
          loanPurpose: loanData.loanPurpose,
          loanType: loanData.productType
        },
        customization: {
          logoUrl: options.logoUrl || 'https://fahm.com/logo.png',
          primaryColor: options.primaryColor || '#003B5C',
          secondaryColor: options.secondaryColor || '#FF6B35',
          companyName: 'First Alliance Home Mortgage',
          returnUrl: options.returnUrl || 'https://app.fahm.com/dashboard',
          cancelUrl: options.cancelUrl || 'https://app.fahm.com/dashboard'
        },
        integrationMetadata: {
          sourceSystem: 'FAHM',
          loanId: loanData.fahmLoanId,
          loanOfficerId: loanData.loanOfficerId,
          loanOfficerName: loanData.loanOfficerName,
          loanOfficerNMLS: loanData.loanOfficerNMLS,
          referralSource: loanData.referralSource
        },
        settings: {
          sessionTimeout: 3600, // 1 hour
          autoSave: true,
          sendConfirmationEmail: true
        }
      };

      const response = await axios.post(`${this.apiUrl}/v1/applications/initiate`, payload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });

      return {
        success: true,
        applicationId: response.data.applicationId,
        ssoUrl: response.data.ssoUrl,
        expiresAt: new Date(Date.now() + 3600000), // 1 hour
        sessionToken: response.data.sessionToken,
        accessCode: response.data.accessCode
      };
    } catch (error) {
      logger.error('Big POS SSO handoff error:', error.response?.data || error.message);
      throw new Error(`Failed to create Big POS SSO handoff: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get application status from Big POS
   * @param {String} applicationId - Big POS application ID
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
          id: response.data.applicationId,
          status: response.data.status, // initiated, in_progress, completed, submitted, under_review, approved, conditional_approval, denied
          progressPercentage: response.data.progressPercentage,
          currentStep: response.data.currentStep,
          lastActivity: response.data.lastActivity,
          applicant: {
            name: `${response.data.applicant.firstName} ${response.data.applicant.lastName}`,
            email: response.data.applicant.email,
            phone: response.data.applicant.phoneNumber
          },
          loanDetails: {
            loanAmount: response.data.loanDetails.loanAmount,
            propertyAddress: response.data.loanDetails.propertyAddress,
            loanType: response.data.loanDetails.loanType
          },
          documents: response.data.documents || [],
          milestones: response.data.milestones || []
        }
      };
    } catch (error) {
      logger.error('Big POS get application status error:', error.response?.data || error.message);
      throw new Error(`Failed to get Big POS application status: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Sync borrower data to Big POS application
   * @param {String} applicationId - Big POS application ID
   * @param {Object} borrowerData - Updated borrower data
   * @returns {Promise<Object>} - Sync result
   */
  async syncBorrowerData(applicationId, borrowerData) {
    try {
      const token = await this.getAccessToken();

      const payload = {
        applicant: {
          email: borrowerData.email,
          firstName: borrowerData.firstName,
          lastName: borrowerData.lastName,
          phoneNumber: borrowerData.phone,
          dateOfBirth: borrowerData.dateOfBirth,
          ssn: borrowerData.ssn,
          currentAddress: borrowerData.currentAddress,
          employmentInfo: borrowerData.employment || {}
        }
      };

      const response = await axios.put(`${this.apiUrl}/v1/applications/${applicationId}/applicant`, payload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      return {
        success: true,
        message: 'Borrower data synced successfully',
        syncedAt: response.data.syncedAt,
        validationStatus: response.data.validationStatus
      };
    } catch (error) {
      logger.error('Big POS sync borrower data error:', error.response?.data || error.message);
      throw new Error(`Failed to sync borrower data to Big POS: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Upload document to Big POS application
   * @param {String} applicationId - Big POS application ID
   * @param {Object} documentData - Document information and file
   * @returns {Promise<Object>} - Upload result
   */
  async uploadDocument(applicationId, documentData) {
    try {
      const token = await this.getAccessToken();

      const formData = new FormData();
      formData.append('documentCategory', documentData.documentType);
      formData.append('file', documentData.file);
      formData.append('fileName', documentData.fileName);
      formData.append('description', documentData.description || '');
      formData.append('uploadedBy', documentData.uploadedBy || 'borrower');

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
        documentId: response.data.documentId,
        status: response.data.status,
        uploadedAt: response.data.uploadedAt,
        fileSize: response.data.fileSize,
        verificationStatus: response.data.verificationStatus
      };
    } catch (error) {
      logger.error('Big POS upload document error:', error.response?.data || error.message);
      throw new Error(`Failed to upload document to Big POS: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get documents for Big POS application
   * @param {String} applicationId - Big POS application ID
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
          id: doc.documentId,
          category: doc.documentCategory,
          fileName: doc.fileName,
          status: doc.status,
          uploadedAt: doc.uploadedAt,
          uploadedBy: doc.uploadedBy,
          verificationStatus: doc.verificationStatus,
          downloadUrl: doc.downloadUrl,
          thumbnailUrl: doc.thumbnailUrl
        }))
      };
    } catch (error) {
      logger.error('Big POS get documents error:', error.response?.data || error.message);
      throw new Error(`Failed to get Big POS documents: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Submit application to underwriting
   * @param {String} applicationId - Big POS application ID
   * @param {Object} submissionData - Additional submission data
   * @returns {Promise<Object>} - Submission result
   */
  async submitApplication(applicationId, submissionData = {}) {
    try {
      const token = await this.getAccessToken();

      const payload = {
        submittedBy: submissionData.submittedBy || 'borrower',
        notes: submissionData.notes || '',
        urgency: submissionData.urgency || 'normal',
        requestedClosingDate: submissionData.requestedClosingDate
      };

      const response = await axios.post(
        `${this.apiUrl}/v1/applications/${applicationId}/submit`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      return {
        success: true,
        status: response.data.status,
        submittedAt: response.data.submittedAt,
        confirmationNumber: response.data.confirmationNumber,
        estimatedReviewTime: response.data.estimatedReviewTime,
        nextSteps: response.data.nextSteps
      };
    } catch (error) {
      logger.error('Big POS submit application error:', error.response?.data || error.message);
      throw new Error(`Failed to submit Big POS application: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get application milestones
   * @param {String} applicationId - Big POS application ID
   * @returns {Promise<Object>} - Milestones list
   */
  async getMilestones(applicationId) {
    try {
      const token = await this.getAccessToken();

      const response = await axios.get(`${this.apiUrl}/v1/applications/${applicationId}/milestones`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        timeout: 10000
      });

      return {
        success: true,
        milestones: response.data.milestones.map(milestone => ({
          id: milestone.milestoneId,
          name: milestone.milestoneName,
          status: milestone.status, // pending, in_progress, completed, skipped
          completedAt: milestone.completedAt,
          order: milestone.order
        }))
      };
    } catch (error) {
      logger.error('Big POS get milestones error:', error.response?.data || error.message);
      throw new Error(`Failed to get Big POS milestones: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Verify webhook signature for security
   * @param {Object} payload - Webhook payload
   * @param {String} signature - Webhook signature header
   * @returns {Boolean} - Valid signature
   */
  verifyWebhookSignature(_payload, _signature) {
    // Implement HMAC signature verification
    // For now, return true (implement with crypto.createHmac when webhook secret available)
    logger.warn('Big POS webhook signature verification not implemented');
    return true;
  }

  /**
   * Process webhook event from Big POS
   * @param {Object} event - Webhook event
   * @returns {Promise<Object>} - Processing result
   */
  async processWebhookEvent(event) {
    try {
      logger.info('Processing Big POS webhook event:', event.eventType);

      const result = {
        eventType: event.eventType,
        applicationId: event.applicationId,
        timestamp: event.timestamp,
        processed: true
      };

      switch (event.eventType) {
        case 'application.initiated':
          result.action = 'Application initiated';
          break;
        
        case 'application.progress_updated':
          result.action = 'Application progress updated';
          result.progressPercentage = event.data.progressPercentage;
          break;
        
        case 'application.completed':
          result.action = 'Application completed by borrower';
          break;
        
        case 'application.submitted':
          result.action = 'Application submitted - trigger CRM and Encompass sync';
          result.shouldSyncCRM = true;
          result.shouldSyncEncompass = true;
          result.confirmationNumber = event.data.confirmationNumber;
          break;
        
        case 'application.approved':
          result.action = 'Application approved';
          result.shouldNotifyBorrower = true;
          result.shouldNotifyLO = true;
          break;
        
        case 'application.conditional_approval':
          result.action = 'Conditional approval issued';
          result.shouldNotifyBorrower = true;
          result.conditions = event.data.conditions;
          break;
        
        case 'application.denied':
          result.action = 'Application denied';
          result.shouldNotifyBorrower = true;
          result.denialReasons = event.data.reasons;
          break;
        
        case 'document.uploaded':
          result.action = 'Document uploaded';
          result.documentId = event.data.documentId;
          result.documentCategory = event.data.documentCategory;
          break;
        
        case 'document.verified':
          result.action = 'Document verified';
          result.documentId = event.data.documentId;
          result.verificationStatus = event.data.verificationStatus;
          break;
        
        case 'milestone.completed':
          result.action = 'Milestone completed';
          result.milestoneName = event.data.milestoneName;
          break;
        
        default:
          result.action = 'Unknown event type';
          logger.warn('Unknown Big POS webhook event type:', event.eventType);
      }

      return result;
    } catch (error) {
      logger.error('Big POS webhook processing error:', error);
      throw error;
    }
  }
}

module.exports = new BigPOSService();
