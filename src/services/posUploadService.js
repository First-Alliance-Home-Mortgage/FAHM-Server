const axios = require('axios');
const logger = require('../utils/logger');

class POSUploadService {
  constructor() {
    this.blendApiUrl = process.env.BLEND_API_URL;
    this.bigPosApiUrl = process.env.BIG_POS_API_URL;
    this.encompassApiUrl = process.env.ENCOMPASS_API_URL;
    
    this.blendClientId = process.env.BLEND_CLIENT_ID;
    this.blendClientSecret = process.env.BLEND_CLIENT_SECRET;
    
    this.bigPosClientId = process.env.BIG_POS_CLIENT_ID;
    this.bigPosClientSecret = process.env.BIG_POS_CLIENT_SECRET;
    
    this.encompassClientId = process.env.ENCOMPASS_CLIENT_ID;
    this.encompassClientSecret = process.env.ENCOMPASS_CLIENT_SECRET;
    
    this.blendToken = null;
    this.bigPosToken = null;
    this.encompassToken = null;
  }

  /**
   * Upload document to Blend POS
   */
  async uploadToBlend(loanId, documentBuffer, fileName, documentType, metadata = {}) {
    try {
      if (!this.blendApiUrl) {
        throw new Error('Blend API not configured');
      }

      // Get access token
      const token = await this.getBlendToken();

      // Create form data
      const FormData = require('form-data');
      const formData = new FormData();
      formData.append('file', documentBuffer, fileName);
      formData.append('document_type', documentType);
      formData.append('loan_id', loanId);
      
      if (metadata.description) {
        formData.append('description', metadata.description);
      }

      const response = await axios.post(
        `${this.blendApiUrl}/v1/loans/${loanId}/documents`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            ...formData.getHeaders()
          }
        }
      );

      logger.info('Document uploaded to Blend', {
        loanId,
        documentId: response.data.id,
        fileName
      });

      return {
        success: true,
        posSystem: 'blend',
        posDocumentId: response.data.id,
        response: response.data
      };
    } catch (error) {
      logger.error('Error uploading to Blend:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Upload document to Big POS
   */
  async uploadToBigPOS(loanId, documentBuffer, fileName, documentType, metadata = {}) {
    try {
      if (!this.bigPosApiUrl) {
        throw new Error('Big POS API not configured');
      }

      // Get access token
      const token = await this.getBigPOSToken();

      // Create form data
      const FormData = require('form-data');
      const formData = new FormData();
      formData.append('document', documentBuffer, fileName);
      formData.append('type', documentType);
      formData.append('loanId', loanId);
      
      if (metadata.description) {
        formData.append('notes', metadata.description);
      }

      const response = await axios.post(
        `${this.bigPosApiUrl}/api/documents/upload`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            ...formData.getHeaders()
          }
        }
      );

      logger.info('Document uploaded to Big POS', {
        loanId,
        documentId: response.data.documentId,
        fileName
      });

      return {
        success: true,
        posSystem: 'big_pos',
        posDocumentId: response.data.documentId,
        response: response.data
      };
    } catch (error) {
      logger.error('Error uploading to Big POS:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Upload document to Encompass Consumer Connect
   */
  async uploadToEncompass(loanId, documentBuffer, fileName, documentType, metadata = {}) {
    try {
      if (!this.encompassApiUrl) {
        throw new Error('Encompass API not configured');
      }

      // Get access token
      const token = await this.getEncompassToken();

      // Convert buffer to base64
      const base64Content = documentBuffer.toString('base64');

      const payload = {
        title: fileName,
        documentType: documentType,
        file: {
          name: fileName,
          content: base64Content
        },
        description: metadata.description || ''
      };

      const response = await axios.post(
        `${this.encompassApiUrl}/encompass/v1/loans/${loanId}/documents`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info('Document uploaded to Encompass', {
        loanId,
        documentId: response.data.id,
        fileName
      });

      return {
        success: true,
        posSystem: 'encompass',
        encompassDocId: response.data.id,
        response: response.data
      };
    } catch (error) {
      logger.error('Error uploading to Encompass:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get Blend access token
   */
  async getBlendToken() {
    if (this.blendToken) {
      return this.blendToken;
    }

    if (!this.blendClientId || !this.blendClientSecret) {
      throw new Error('Blend credentials not configured');
    }

    try {
      const response = await axios.post(
        `${this.blendApiUrl}/v1/oauth/token`,
        {
          grant_type: 'client_credentials',
          client_id: this.blendClientId,
          client_secret: this.blendClientSecret
        }
      );

      this.blendToken = response.data.access_token;
      
      // Clear token before expiry
      setTimeout(() => {
        this.blendToken = null;
      }, (response.data.expires_in - 300) * 1000);

      return this.blendToken;
    } catch (error) {
      logger.error('Error getting Blend token:', error);
      throw error;
    }
  }

  /**
   * Get Big POS access token
   */
  async getBigPOSToken() {
    if (this.bigPosToken) {
      return this.bigPosToken;
    }

    if (!this.bigPosClientId || !this.bigPosClientSecret) {
      throw new Error('Big POS credentials not configured');
    }

    try {
      const response = await axios.post(
        `${this.bigPosApiUrl}/oauth/token`,
        {
          grant_type: 'client_credentials',
          client_id: this.bigPosClientId,
          client_secret: this.bigPosClientSecret
        }
      );

      this.bigPosToken = response.data.access_token;
      
      // Clear token before expiry
      setTimeout(() => {
        this.bigPosToken = null;
      }, (response.data.expires_in - 300) * 1000);

      return this.bigPosToken;
    } catch (error) {
      logger.error('Error getting Big POS token:', error);
      throw error;
    }
  }

  /**
   * Get Encompass access token
   */
  async getEncompassToken() {
    if (this.encompassToken) {
      return this.encompassToken;
    }

    if (!this.encompassClientId || !this.encompassClientSecret) {
      throw new Error('Encompass credentials not configured');
    }

    try {
      const response = await axios.post(
        `${this.encompassApiUrl}/oauth2/v1/token`,
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.encompassClientId,
          client_secret: this.encompassClientSecret
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      this.encompassToken = response.data.access_token;
      
      // Clear token before expiry
      setTimeout(() => {
        this.encompassToken = null;
      }, (response.data.expires_in - 300) * 1000);

      return this.encompassToken;
    } catch (error) {
      logger.error('Error getting Encompass token:', error);
      throw error;
    }
  }
}

module.exports = new POSUploadService();
