const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initialize();
  }

  /**
   * Initialize email transporter
   */
  initialize() {
    try {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

      logger.info('Email service initialized');
    } catch (error) {
      logger.error('Failed to initialize email service:', error);
    }
  }

  /**
   * Send preapproval letter via email
   */
  async sendPreapprovalLetter(recipient, letterData, pdfBuffer) {
    try {
      if (!this.transporter) {
        throw new Error('Email transporter not initialized');
      }

      const mailOptions = {
        from: process.env.SMTP_FROM || '"First Alliance Home Mortgage" <noreply@fahm.com>',
        to: recipient,
        subject: `Your Mortgage Pre-Approval Letter - ${letterData.letterNumber}`,
        html: this.generateEmailHTML(letterData),
        attachments: [
          {
            filename: `Preapproval_Letter_${letterData.letterNumber}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf'
          }
        ]
      };

      const info = await this.transporter.sendMail(mailOptions);

      logger.info('Preapproval letter email sent', {
        messageId: info.messageId,
        recipient,
        letterNumber: letterData.letterNumber
      });

      return {
        success: true,
        messageId: info.messageId
      };
    } catch (error) {
      logger.error('Failed to send preapproval letter email:', error);
      throw error;
    }
  }

  /**
   * Send download link via email
   */
  async sendDownloadLink(recipient, letterData, downloadUrl) {
    try {
      if (!this.transporter) {
        throw new Error('Email transporter not initialized');
      }

      const mailOptions = {
        from: process.env.SMTP_FROM || '"First Alliance Home Mortgage" <noreply@fahm.com>',
        to: recipient,
        subject: `Your Mortgage Pre-Approval Letter - ${letterData.letterNumber}`,
        html: this.generateDownloadLinkHTML(letterData, downloadUrl)
      };

      const info = await this.transporter.sendMail(mailOptions);

      logger.info('Download link email sent', {
        messageId: info.messageId,
        recipient,
        letterNumber: letterData.letterNumber
      });

      return {
        success: true,
        messageId: info.messageId
      };
    } catch (error) {
      logger.error('Failed to send download link email:', error);
      throw error;
    }
  }

  /**
   * Generate email HTML with attached PDF
   */
  generateEmailHTML(letterData) {
    const primaryColor = letterData.branding?.primaryColor || '#003B5C';
    const secondaryColor = letterData.branding?.secondaryColor || '#FF6B35';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: ${primaryColor}; color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; background-color: #f9f9f9; }
          .button { 
            display: inline-block; 
            padding: 12px 30px; 
            background-color: ${secondaryColor}; 
            color: white; 
            text-decoration: none; 
            border-radius: 5px; 
            margin: 20px 0;
          }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
          .highlight { background-color: #fff; padding: 15px; margin: 15px 0; border-left: 4px solid ${secondaryColor}; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Congratulations!</h1>
            <p>Your Mortgage Pre-Approval is Ready</p>
          </div>
          
          <div class="content">
            <h2>Dear ${letterData.borrowerData.primaryBorrower.name},</h2>
            
            <p>Great news! Your mortgage pre-approval letter has been generated and is attached to this email.</p>
            
            <div class="highlight">
              <strong>Pre-Approval Amount:</strong> ${this.formatCurrency(letterData.loanData.loanAmount)}<br>
              <strong>Loan Type:</strong> ${this.formatLoanType(letterData.loanData.loanType)}<br>
              <strong>Letter Number:</strong> ${letterData.letterNumber}<br>
              <strong>Valid Until:</strong> ${new Date(letterData.expirationDate).toLocaleDateString()}
            </div>
            
            <p>This pre-approval letter demonstrates to sellers that you're a serious buyer with verified financing. You can now:</p>
            
            <ul>
              <li>Share this letter with real estate agents</li>
              <li>Submit offers on properties with confidence</li>
              <li>Negotiate more effectively</li>
            </ul>
            
            <p><strong>Next Steps:</strong></p>
            <ol>
              <li>Review the attached pre-approval letter</li>
              <li>Share it with your real estate agent</li>
              <li>Start shopping for your dream home!</li>
            </ol>
            
            <p>If you have any questions or need assistance, please don't hesitate to contact your loan officer:</p>
            
            <div class="highlight">
              <strong>${letterData.signatures?.loanOfficerName || 'Your Loan Officer'}</strong><br>
              ${letterData.signatures?.loanOfficerTitle || 'Senior Loan Officer'}<br>
              NMLS #${letterData.signatures?.loanOfficerNMLS || '000000'}<br>
              ${letterData.borrowerData.primaryBorrower.email || ''}<br>
              ${letterData.borrowerData.primaryBorrower.phone || ''}
            </div>
          </div>
          
          <div class="footer">
            <p>First Alliance Home Mortgage | ${letterData.signatures?.companyNMLS || 'NMLS #00000'}</p>
            <p style="font-size: 10px; color: #999;">
              This email and its attachments are confidential and intended solely for the recipient.
              If you received this in error, please delete it immediately.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate email HTML with download link
   */
  generateDownloadLinkHTML(letterData, downloadUrl) {
    const primaryColor = letterData.branding?.primaryColor || '#003B5C';
    const secondaryColor = letterData.branding?.secondaryColor || '#FF6B35';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: ${primaryColor}; color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; background-color: #f9f9f9; }
          .button { 
            display: inline-block; 
            padding: 12px 30px; 
            background-color: ${secondaryColor}; 
            color: white; 
            text-decoration: none; 
            border-radius: 5px; 
            margin: 20px 0;
          }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
          .highlight { background-color: #fff; padding: 15px; margin: 15px 0; border-left: 4px solid ${secondaryColor}; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📄 Your Pre-Approval Letter</h1>
            <p>Ready to Download</p>
          </div>
          
          <div class="content">
            <h2>Dear ${letterData.borrowerData.primaryBorrower.name},</h2>
            
            <p>Your mortgage pre-approval letter is ready for download.</p>
            
            <div class="highlight">
              <strong>Pre-Approval Amount:</strong> ${this.formatCurrency(letterData.loanData.loanAmount)}<br>
              <strong>Letter Number:</strong> ${letterData.letterNumber}<br>
              <strong>Valid Until:</strong> ${new Date(letterData.expirationDate).toLocaleDateString()}
            </div>
            
            <p style="text-align: center;">
              <a href="${downloadUrl}" class="button">Download Your Pre-Approval Letter</a>
            </p>
            
            <p style="font-size: 12px; color: #666;">
              This link will expire in 24 hours for security purposes. If you need a new link, please contact your loan officer.
            </p>
          </div>
          
          <div class="footer">
            <p>First Alliance Home Mortgage | ${letterData.signatures?.companyNMLS || 'NMLS #00000'}</p>
          </div>
        </div>
      </body>
      </html>
    `;
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
   * Format loan type
   */
  formatLoanType(type) {
    const types = {
      conventional: 'Conventional',
      fha: 'FHA',
      va: 'VA',
      usda: 'USDA',
      jumbo: 'Jumbo'
    };
    return types[type] || type;
  }
}

module.exports = new EmailService();
