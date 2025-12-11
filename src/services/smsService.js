const twilio = require('twilio');
const logger = require('../utils/logger');

class SMSService {
  constructor() {
    this.client = null;
    this.fromNumber = null;
    this.initialize();
  }

  /**
   * Initialize Twilio client
   */
  initialize() {
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      this.fromNumber = process.env.TWILIO_PHONE_NUMBER;

      if (!accountSid || !authToken || !this.fromNumber) {
        logger.warn('Twilio credentials not configured. SMS service will be disabled.');
        return;
      }

      this.client = twilio(accountSid, authToken);
      logger.info('SMS service initialized');
    } catch (error) {
      logger.error('Failed to initialize SMS service:', error);
    }
  }

  /**
   * Send preapproval letter download link via SMS
   */
  async sendPreapprovalLink(phoneNumber, letterData, downloadUrl) {
    try {
      if (!this.client) {
        throw new Error('SMS service not initialized. Please configure Twilio credentials.');
      }

      // Format phone number
      const formattedPhone = this.formatPhoneNumber(phoneNumber);

      const message = this.generateSMSMessage(letterData, downloadUrl);

      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: formattedPhone
      });

      logger.info('Preapproval letter SMS sent', {
        sid: result.sid,
        to: formattedPhone,
        letterNumber: letterData.letterNumber
      });

      return {
        success: true,
        messageSid: result.sid,
        status: result.status
      };
    } catch (error) {
      logger.error('Failed to send SMS:', error);
      throw error;
    }
  }

  /**
   * Send preapproval notification SMS
   */
  async sendPreapprovalNotification(phoneNumber, letterData) {
    try {
      if (!this.client) {
        throw new Error('SMS service not initialized. Please configure Twilio credentials.');
      }

      const formattedPhone = this.formatPhoneNumber(phoneNumber);

      const message = `Congratulations! Your mortgage pre-approval for ${this.formatCurrency(letterData.loanData.loanAmount)} is ready. Letter #${letterData.letterNumber}. Check your FAHM app for details. - First Alliance Home Mortgage`;

      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: formattedPhone
      });

      logger.info('Preapproval notification SMS sent', {
        sid: result.sid,
        to: formattedPhone,
        letterNumber: letterData.letterNumber
      });

      return {
        success: true,
        messageSid: result.sid,
        status: result.status
      };
    } catch (error) {
      logger.error('Failed to send notification SMS:', error);
      throw error;
    }
  }

  /**
   * Generate SMS message with download link
   */
  generateSMSMessage(letterData, downloadUrl) {
    const amount = this.formatCurrency(letterData.loanData.loanAmount);
    const borrowerName = letterData.borrowerData.primaryBorrower.name.split(' ')[0]; // First name only

    return `Hi ${borrowerName}! Your mortgage pre-approval for ${amount} is ready (Letter #${letterData.letterNumber}). Download it here: ${downloadUrl} - First Alliance Home Mortgage`;
  }

  /**
   * Format phone number to E.164 format
   */
  formatPhoneNumber(phoneNumber) {
    // Remove all non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '');

    // Add country code if not present
    if (cleaned.length === 10) {
      cleaned = `1${cleaned}`;
    }

    // Add + prefix
    if (!cleaned.startsWith('+')) {
      cleaned = `+${cleaned}`;
    }

    return cleaned;
  }

  /**
   * Validate phone number format
   */
  isValidPhoneNumber(phoneNumber) {
    const cleaned = phoneNumber.replace(/\D/g, '');
    return cleaned.length === 10 || cleaned.length === 11;
  }

  /**
   * Format currency
   */
  formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  /**
   * Send SMS message
   * Generic method for sending any SMS
   */
  async sendSMS(to, body, options = {}) {
    try {
      if (!this.client) {
        throw new Error('SMS service not initialized. Please configure Twilio credentials.');
      }

      const formattedPhone = this.formatPhoneNumber(to);

      const messageData = {
        body,
        from: options.from || this.fromNumber,
        to: formattedPhone
      };

      // Add status callback URL if provided
      if (options.statusCallback) {
        messageData.statusCallback = options.statusCallback;
      }

      // Add media URL if provided (for MMS)
      if (options.mediaUrl) {
        messageData.mediaUrl = Array.isArray(options.mediaUrl) ? options.mediaUrl : [options.mediaUrl];
      }

      const result = await this.client.messages.create(messageData);

      logger.info('SMS sent successfully', {
        sid: result.sid,
        to: formattedPhone,
        status: result.status
      });

      return {
        success: true,
        sid: result.sid,
        status: result.status,
        numSegments: result.numSegments,
        price: result.price,
        priceUnit: result.priceUnit,
        dateSent: result.dateSent
      };
    } catch (error) {
      logger.error('Failed to send SMS:', error);
      throw error;
    }
  }

  /**
   * Validate Twilio webhook signature
   * Ensures webhook requests actually come from Twilio
   */
  validateWebhookSignature(url, params, signature) {
    try {
      if (!this.client) {
        throw new Error('SMS service not initialized');
      }

      const authToken = process.env.TWILIO_AUTH_TOKEN;
      return twilio.validateRequest(authToken, signature, url, params);
    } catch (error) {
      logger.error('Failed to validate webhook signature:', error);
      return false;
    }
  }

  /**
   * Get message details from Twilio
   */
  async getMessageDetails(messageSid) {
    try {
      if (!this.client) {
        throw new Error('SMS service not initialized');
      }

      const message = await this.client.messages(messageSid).fetch();

      return {
        sid: message.sid,
        status: message.status,
        direction: message.direction,
        from: message.from,
        to: message.to,
        body: message.body,
        numSegments: message.numSegments,
        numMedia: message.numMedia,
        price: message.price,
        priceUnit: message.priceUnit,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage,
        dateSent: message.dateSent,
        dateCreated: message.dateCreated,
        dateUpdated: message.dateUpdated
      };
    } catch (error) {
      logger.error('Failed to fetch message details:', error);
      throw error;
    }
  }

  /**
   * Send 2-way SMS with thread tracking
   */
  async send2WaySMS(to, body, threadId, options = {}) {
    try {
      // Add thread ID to message for tracking
      const messageOptions = {
        ...options,
        statusCallback: options.statusCallback || `${process.env.API_BASE_URL}/api/v1/sms/webhook/status`
      };

      const result = await this.sendSMS(to, body, messageOptions);

      logger.info('2-way SMS sent with thread tracking', {
        sid: result.sid,
        threadId,
        to
      });

      return result;
    } catch (error) {
      logger.error('Failed to send 2-way SMS:', error);
      throw error;
    }
  }
}

module.exports = new SMSService();
