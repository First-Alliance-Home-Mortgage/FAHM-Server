const axios = require('axios');
const logger = require('../utils/logger');

class XactusService {
  constructor() {
    this.baseURL = process.env.XACTUS_API_URL || 'https://api.xactus.com';
    this.clientId = process.env.XACTUS_CLIENT_ID;
    this.clientSecret = process.env.XACTUS_CLIENT_SECRET;
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

      logger.info('Requesting new Xactus access token');

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
      logger.error('Failed to get Xactus access token', { error: error.message });
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
   * Request tri-merge credit report
   */
  async requestTriMergeReport(borrowerData) {
    try {
      const client = await this.getClient();
      
      const payload = {
        borrower: {
          first_name: borrowerData.firstName,
          last_name: borrowerData.lastName,
          ssn: borrowerData.ssn,
          date_of_birth: borrowerData.dateOfBirth,
          current_address: {
            street: borrowerData.address.street,
            city: borrowerData.address.city,
            state: borrowerData.address.state,
            zip: borrowerData.address.zip
          }
        },
        report_type: 'tri_merge',
        purpose: borrowerData.purpose || 'mortgage',
        include_scores: true,
        include_tradelines: true,
        include_inquiries: true,
        include_public_records: true
      };

      logger.info('Requesting tri-merge credit report from Xactus', {
        borrower: `${borrowerData.firstName} ${borrowerData.lastName}`
      });

      const response = await client.post('/v1/credit/reports', payload);

      return {
        xactusReportId: response.data.report_id,
        transactionId: response.data.transaction_id,
        status: response.data.status,
        reportData: this.transformCreditReport(response.data)
      };
    } catch (error) {
      logger.error('Failed to request tri-merge report from Xactus', { 
        error: error.message,
        borrower: `${borrowerData.firstName} ${borrowerData.lastName}`
      });
      throw error;
    }
  }

  /**
   * Get existing credit report by ID
   */
  async getCreditReport(reportId) {
    try {
      const client = await this.getClient();
      const response = await client.get(`/v1/credit/reports/${reportId}`);
      
      return this.transformCreditReport(response.data);
    } catch (error) {
      logger.error(`Failed to get credit report ${reportId} from Xactus`, { 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Request soft pull credit check
   */
  async requestSoftPull(borrowerData) {
    try {
      const client = await this.getClient();
      
      const payload = {
        borrower: {
          first_name: borrowerData.firstName,
          last_name: borrowerData.lastName,
          ssn: borrowerData.ssn,
          date_of_birth: borrowerData.dateOfBirth
        },
        report_type: 'soft_pull',
        purpose: 'prequalification'
      };

      const response = await client.post('/v1/credit/reports', payload);

      return {
        xactusReportId: response.data.report_id,
        transactionId: response.data.transaction_id,
        status: response.data.status,
        reportData: this.transformCreditReport(response.data)
      };
    } catch (error) {
      logger.error('Failed to request soft pull from Xactus', { error: error.message });
      throw error;
    }
  }

  /**
   * Reissue existing credit report (refresh)
   */
  async reissueReport(reportId) {
    try {
      const client = await this.getClient();
      const response = await client.post(`/v1/credit/reports/${reportId}/reissue`);
      
      return {
        xactusReportId: response.data.report_id,
        transactionId: response.data.transaction_id,
        status: response.data.status,
        reportData: this.transformCreditReport(response.data)
      };
    } catch (error) {
      logger.error(`Failed to reissue credit report ${reportId}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Transform Xactus credit report to FAHM format
   */
  transformCreditReport(xactusData) {
    const scores = this.extractScores(xactusData.credit_scores || []);
    const tradelines = this.extractTradelines(xactusData.tradelines || []);
    const publicRecords = this.extractPublicRecords(xactusData.public_records || []);
    const inquiries = this.extractInquiries(xactusData.inquiries || []);
    const summary = this.calculateSummary(tradelines, xactusData);

    return {
      xactusReportId: xactusData.report_id,
      reportType: this.mapReportType(xactusData.report_type),
      status: xactusData.status === 'completed' ? 'completed' : 'pending',
      scores,
      midScore: this.calculateMidScore(scores),
      tradelines,
      publicRecords,
      inquiries,
      summary,
      rawData: xactusData
    };
  }

  /**
   * Extract and format credit scores from all three bureaus
   */
  extractScores(xactusScores) {
    return xactusScores.map(score => ({
      bureau: this.mapBureau(score.bureau),
      score: score.value,
      scoreModel: score.model || 'FICO',
      factors: score.factors || []
    }));
  }

  /**
   * Extract and format tradelines
   */
  extractTradelines(xactusTradelines) {
    return xactusTradelines.map(trade => ({
      creditorName: trade.creditor_name,
      accountNumber: trade.account_number ? `****${trade.account_number.slice(-4)}` : null,
      accountType: this.mapAccountType(trade.account_type),
      balance: trade.balance || 0,
      creditLimit: trade.credit_limit || 0,
      monthlyPayment: trade.monthly_payment || 0,
      paymentStatus: this.mapPaymentStatus(trade.payment_status),
      openDate: trade.open_date ? new Date(trade.open_date) : null,
      lastPaymentDate: trade.last_payment_date ? new Date(trade.last_payment_date) : null,
      remarks: trade.remarks
    }));
  }

  /**
   * Extract public records
   */
  extractPublicRecords(xactusRecords) {
    return xactusRecords.map(record => ({
      type: this.mapPublicRecordType(record.type),
      filingDate: record.filing_date ? new Date(record.filing_date) : null,
      amount: record.amount || 0,
      status: record.status,
      remarks: record.remarks
    }));
  }

  /**
   * Extract credit inquiries
   */
  extractInquiries(xactusInquiries) {
    return xactusInquiries.map(inquiry => ({
      bureau: this.mapBureau(inquiry.bureau),
      creditorName: inquiry.creditor_name,
      inquiryDate: inquiry.inquiry_date ? new Date(inquiry.inquiry_date) : null,
      inquiryType: inquiry.inquiry_type
    }));
  }

  /**
   * Calculate credit summary metrics
   */
  calculateSummary(tradelines, xactusData) {
    const openAccounts = tradelines.filter(t => t.paymentStatus !== 'closed').length;
    const totalDebt = tradelines.reduce((sum, t) => sum + t.balance, 0);
    const availableCredit = tradelines
      .filter(t => t.accountType === 'revolving')
      .reduce((sum, t) => sum + (t.creditLimit - t.balance), 0);
    const totalCreditLimit = tradelines
      .filter(t => t.accountType === 'revolving')
      .reduce((sum, t) => sum + t.creditLimit, 0);
    
    return {
      totalAccounts: tradelines.length,
      openAccounts,
      closedAccounts: tradelines.length - openAccounts,
      totalDebt,
      availableCredit,
      creditUtilization: totalCreditLimit > 0 ? (totalDebt / totalCreditLimit) * 100 : 0,
      oldestAccount: tradelines.length > 0 
        ? tradelines.reduce((oldest, t) => !oldest || t.openDate < oldest ? t.openDate : oldest, null)
        : null,
      recentInquiries: xactusData.inquiries ? xactusData.inquiries.length : 0
    };
  }

  /**
   * Calculate mid score from three bureau scores
   */
  calculateMidScore(scores) {
    if (scores.length !== 3) {
      return null;
    }
    const sortedScores = scores.map(s => s.score).sort((a, b) => a - b);
    return sortedScores[1]; // Return middle value
  }

  /**
   * Map Xactus bureau names to FAHM format
   */
  mapBureau(xactusBureau) {
    const mapping = {
      'Equifax': 'equifax',
      'Experian': 'experian',
      'TransUnion': 'transunion',
      'TU': 'transunion'
    };
    return mapping[xactusBureau] || xactusBureau.toLowerCase();
  }

  /**
   * Map account types
   */
  mapAccountType(xactusType) {
    const mapping = {
      'Revolving': 'revolving',
      'Installment': 'installment',
      'Mortgage': 'mortgage',
      'Auto': 'auto',
      'Student': 'student',
      'Open': 'other'
    };
    return mapping[xactusType] || 'other';
  }

  /**
   * Map payment status
   */
  mapPaymentStatus(xactusStatus) {
    const mapping = {
      'Current': 'current',
      'Past Due': 'past_due',
      'Charge Off': 'charge_off',
      'Collection': 'collection',
      'Closed': 'closed'
    };
    return mapping[xactusStatus] || 'current';
  }

  /**
   * Map public record types
   */
  mapPublicRecordType(xactusType) {
    const mapping = {
      'Bankruptcy': 'bankruptcy',
      'Tax Lien': 'tax_lien',
      'Judgment': 'judgment',
      'Foreclosure': 'foreclosure'
    };
    return mapping[xactusType] || xactusType.toLowerCase();
  }

  /**
   * Map report type
   */
  mapReportType(xactusType) {
    const mapping = {
      'tri_merge': 'tri_merge',
      'single_bureau': 'single_bureau',
      'soft_pull': 'soft_pull'
    };
    return mapping[xactusType] || 'tri_merge';
  }
}

module.exports = new XactusService();
