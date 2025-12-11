const SMSMessage = require('../models/SMSMessage');
const LoanApplication = require('../models/LoanApplication');
const User = require('../models/User');
const smsService = require('./smsService');
const logger = require('../utils/logger');

/**
 * SMS Notification Service
 * Automated SMS notifications for loan milestones, document requests, and reminders
 */
class SMSNotificationService {
  constructor() {
    this.notificationTemplates = {
      milestone_update: this.getMilestoneUpdateTemplate,
      document_request: this.getDocumentRequestTemplate,
      appointment_reminder: this.getAppointmentReminderTemplate,
      rate_alert: this.getRateAlertTemplate,
      application_started: this.getApplicationStartedTemplate,
      application_submitted: this.getApplicationSubmittedTemplate,
      underwriting_approved: this.getUnderwritingApprovedTemplate,
      clear_to_close: this.getClearToCloseTemplate,
      loan_funded: this.getLoanFundedTemplate
    };
  }

  /**
   * Send milestone update notification
   */
  async sendMilestoneUpdate(loanId, milestoneName, borrowerPhone, loanOfficer) {
    try {
      const loan = await LoanApplication.findById(loanId).populate('borrower');
      if (!loan) {
        throw new Error('Loan not found');
      }

      const borrower = loan.borrower;
      const template = this.notificationTemplates.milestone_update.call(this, {
        borrowerName: borrower.name,
        milestoneName,
        loanAmount: loan.amount,
        propertyAddress: loan.propertyAddress,
        loanOfficerName: loanOfficer?.name || 'your loan officer'
      });

      const smsMessage = new SMSMessage({
        from: process.env.TWILIO_PHONE_NUMBER,
        to: borrowerPhone,
        body: template.body,
        direction: 'outbound',
        messageType: 'milestone_update',
        sender: loanOfficer?._id,
        recipient: borrower._id,
        loan: loanId,
        status: 'queued',
        compliance: {
          purpose: 'loan_update',
          consentObtained: true,
          tcpaCompliant: true
        }
      });

      await smsMessage.save();

      // Send via Twilio
      const twilioResponse = await smsService.sendSMS(borrowerPhone, template.body);
      await smsMessage.markAsSent({
        messageSid: twilioResponse.sid,
        numSegments: twilioResponse.numSegments,
        price: twilioResponse.price,
        priceUnit: twilioResponse.priceUnit
      });

      logger.info('Milestone update SMS sent', {
        loanId,
        milestoneName,
        messageId: smsMessage.messageId
      });

      return { success: true, messageId: smsMessage.messageId };
    } catch (error) {
      logger.error('Failed to send milestone update SMS:', error);
      throw error;
    }
  }

  /**
   * Send document request notification
   */
  async sendDocumentRequest(loanId, documentType, borrowerPhone, loanOfficer, dueDate) {
    try {
      const loan = await LoanApplication.findById(loanId).populate('borrower');
      if (!loan) {
        throw new Error('Loan not found');
      }

      const borrower = loan.borrower;
      const template = this.notificationTemplates.document_request.call(this, {
        borrowerName: borrower.name,
        documentType,
        dueDate: dueDate ? new Date(dueDate).toLocaleDateString() : 'as soon as possible',
        loanOfficerName: loanOfficer?.name || 'your loan officer'
      });

      const smsMessage = new SMSMessage({
        from: process.env.TWILIO_PHONE_NUMBER,
        to: borrowerPhone,
        body: template.body,
        direction: 'outbound',
        messageType: 'notification',
        sender: loanOfficer?._id,
        recipient: borrower._id,
        loan: loanId,
        status: 'queued',
        compliance: {
          purpose: 'document_request',
          consentObtained: true,
          tcpaCompliant: true
        }
      });

      await smsMessage.save();

      const twilioResponse = await smsService.sendSMS(borrowerPhone, template.body);
      await smsMessage.markAsSent({
        messageSid: twilioResponse.sid,
        numSegments: twilioResponse.numSegments,
        price: twilioResponse.price,
        priceUnit: twilioResponse.priceUnit
      });

      logger.info('Document request SMS sent', {
        loanId,
        documentType,
        messageId: smsMessage.messageId
      });

      return { success: true, messageId: smsMessage.messageId };
    } catch (error) {
      logger.error('Failed to send document request SMS:', error);
      throw error;
    }
  }

  /**
   * Send appointment reminder
   */
  async sendAppointmentReminder(loanId, appointmentDetails, borrowerPhone, loanOfficer) {
    try {
      const loan = await LoanApplication.findById(loanId).populate('borrower');
      if (!loan) {
        throw new Error('Loan not found');
      }

      const borrower = loan.borrower;
      const template = this.notificationTemplates.appointment_reminder.call(this, {
        borrowerName: borrower.name,
        appointmentType: appointmentDetails.type,
        appointmentDate: new Date(appointmentDetails.date).toLocaleDateString(),
        appointmentTime: new Date(appointmentDetails.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        loanOfficerName: loanOfficer?.name || 'your loan officer'
      });

      const smsMessage = new SMSMessage({
        from: process.env.TWILIO_PHONE_NUMBER,
        to: borrowerPhone,
        body: template.body,
        direction: 'outbound',
        messageType: 'reminder',
        sender: loanOfficer?._id,
        recipient: borrower._id,
        loan: loanId,
        status: 'queued',
        compliance: {
          purpose: 'appointment_reminder',
          consentObtained: true,
          tcpaCompliant: true
        }
      });

      await smsMessage.save();

      const twilioResponse = await smsService.sendSMS(borrowerPhone, template.body);
      await smsMessage.markAsSent({
        messageSid: twilioResponse.sid,
        numSegments: twilioResponse.numSegments,
        price: twilioResponse.price,
        priceUnit: twilioResponse.priceUnit
      });

      logger.info('Appointment reminder SMS sent', {
        loanId,
        appointmentType: appointmentDetails.type,
        messageId: smsMessage.messageId
      });

      return { success: true, messageId: smsMessage.messageId };
    } catch (error) {
      logger.error('Failed to send appointment reminder SMS:', error);
      throw error;
    }
  }

  /**
   * Send rate alert notification
   */
  async sendRateAlert(userId, rateAlertData) {
    try {
      const user = await User.findById(userId);
      if (!user || !user.phone) {
        throw new Error('User not found or phone number not available');
      }

      const template = this.notificationTemplates.rate_alert.call(this, {
        userName: user.name,
        productType: rateAlertData.productType,
        loanTerm: rateAlertData.loanTerm,
        currentRate: rateAlertData.currentRate,
        targetRate: rateAlertData.targetRate
      });

      const smsMessage = new SMSMessage({
        from: process.env.TWILIO_PHONE_NUMBER,
        to: user.phone,
        body: template.body,
        direction: 'outbound',
        messageType: 'alert',
        recipient: userId,
        status: 'queued',
        compliance: {
          purpose: 'marketing',
          consentObtained: true,
          tcpaCompliant: true
        }
      });

      await smsMessage.save();

      const twilioResponse = await smsService.sendSMS(user.phone, template.body);
      await smsMessage.markAsSent({
        messageSid: twilioResponse.sid,
        numSegments: twilioResponse.numSegments,
        price: twilioResponse.price,
        priceUnit: twilioResponse.priceUnit
      });

      logger.info('Rate alert SMS sent', {
        userId,
        messageId: smsMessage.messageId
      });

      return { success: true, messageId: smsMessage.messageId };
    } catch (error) {
      logger.error('Failed to send rate alert SMS:', error);
      throw error;
    }
  }

  /**
   * Send application started notification
   */
  async sendApplicationStarted(loanId, borrowerPhone, loanOfficer) {
    try {
      const loan = await LoanApplication.findById(loanId).populate('borrower');
      if (!loan) {
        throw new Error('Loan not found');
      }

      const borrower = loan.borrower;
      const template = this.notificationTemplates.application_started.call(this, {
        borrowerName: borrower.name,
        loanOfficerName: loanOfficer?.name || 'your loan officer',
        loanOfficerPhone: loanOfficer?.phone || process.env.TWILIO_PHONE_NUMBER
      });

      const smsMessage = new SMSMessage({
        from: process.env.TWILIO_PHONE_NUMBER,
        to: borrowerPhone,
        body: template.body,
        direction: 'outbound',
        messageType: 'notification',
        sender: loanOfficer?._id,
        recipient: borrower._id,
        loan: loanId,
        status: 'queued',
        compliance: {
          purpose: 'loan_update',
          consentObtained: true,
          tcpaCompliant: true
        }
      });

      await smsMessage.save();

      const twilioResponse = await smsService.sendSMS(borrowerPhone, template.body);
      await smsMessage.markAsSent({
        messageSid: twilioResponse.sid,
        numSegments: twilioResponse.numSegments,
        price: twilioResponse.price,
        priceUnit: twilioResponse.priceUnit
      });

      logger.info('Application started SMS sent', {
        loanId,
        messageId: smsMessage.messageId
      });

      return { success: true, messageId: smsMessage.messageId };
    } catch (error) {
      logger.error('Failed to send application started SMS:', error);
      throw error;
    }
  }

  /**
   * Template: Milestone Update
   */
  getMilestoneUpdateTemplate(data) {
    return {
      body: `Hi ${data.borrowerName.split(' ')[0]}! 🎉 Your loan has reached a new milestone: ${data.milestoneName}. We're making great progress on your ${this.formatCurrency(data.loanAmount)} mortgage for ${data.propertyAddress}. Questions? Contact ${data.loanOfficerName}. - FAHM`
    };
  }

  /**
   * Template: Document Request
   */
  getDocumentRequestTemplate(data) {
    return {
      body: `Hi ${data.borrowerName.split(' ')[0]}! We need ${data.documentType} to move your loan forward. Please upload by ${data.dueDate}. Log in to your FAHM app to upload securely. Need help? Call ${data.loanOfficerName}. - FAHM`
    };
  }

  /**
   * Template: Appointment Reminder
   */
  getAppointmentReminderTemplate(data) {
    return {
      body: `Hi ${data.borrowerName.split(' ')[0]}! Reminder: Your ${data.appointmentType} appointment is scheduled for ${data.appointmentDate} at ${data.appointmentTime} with ${data.loanOfficerName}. See you soon! - FAHM`
    };
  }

  /**
   * Template: Rate Alert
   */
  getRateAlertTemplate(data) {
    return {
      body: `Hi ${data.userName.split(' ')[0]}! 📉 Rate Alert: ${data.loanTerm}-year ${data.productType} rates just dropped to ${data.currentRate}% (your target: ${data.targetRate}%). Lock in your rate now in the FAHM app! - FAHM`
    };
  }

  /**
   * Template: Application Started
   */
  getApplicationStartedTemplate(data) {
    return {
      body: `Welcome to FAHM, ${data.borrowerName.split(' ')[0]}! 🏡 Your loan application has been started. ${data.loanOfficerName} is reviewing your information. Questions? Call ${data.loanOfficerPhone} or reply to this message. - FAHM`
    };
  }

  /**
   * Template: Application Submitted
   */
  getApplicationSubmittedTemplate(data) {
    return {
      body: `Great news, ${data.borrowerName.split(' ')[0]}! Your loan application has been submitted and is now in processing. We'll keep you updated every step of the way. - FAHM`
    };
  }

  /**
   * Template: Underwriting Approved
   */
  getUnderwritingApprovedTemplate(data) {
    return {
      body: `Congratulations, ${data.borrowerName.split(' ')[0]}! 🎊 Your loan has been approved by underwriting! We're now preparing for closing. Your ${data.loanOfficerName} will be in touch soon. - FAHM`
    };
  }

  /**
   * Template: Clear to Close
   */
  getClearToCloseTemplate(data) {
    return {
      body: `Exciting news, ${data.borrowerName.split(' ')[0]}! 🔑 You're Clear to Close! Your closing date is ${data.closingDate}. Review your Closing Disclosure in the FAHM app. Almost there! - FAHM`
    };
  }

  /**
   * Template: Loan Funded
   */
  getLoanFundedTemplate(data) {
    return {
      body: `Congratulations, ${data.borrowerName.split(' ')[0]}! 🏠🎉 Your loan has been funded! Welcome to homeownership! Thank you for choosing First Alliance Home Mortgage. We're here if you need us. - FAHM`
    };
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
   * Send bulk notifications
   * For batch processing of milestone updates
   */
  async sendBulkNotifications(notifications) {
    const results = {
      total: notifications.length,
      sent: 0,
      failed: 0,
      errors: []
    };

    for (const notification of notifications) {
      try {
        await this.sendMilestoneUpdate(
          notification.loanId,
          notification.milestoneName,
          notification.borrowerPhone,
          notification.loanOfficer
        );
        results.sent++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          loanId: notification.loanId,
          error: error.message
        });
      }
    }

    logger.info('Bulk notification sending completed', results);
    return results;
  }
}

module.exports = new SMSNotificationService();
