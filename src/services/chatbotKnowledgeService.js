// ...existing code...
const encompassService = require('./encompassService');
const totalExpertService = require('./totalExpertService');
const optimalBlueService = require('./optimalBlueService');
const logger = require('../utils/logger');
const LoanApplication = require('../models/LoanApplication');
const User = require('../models/User');

class ChatbotKnowledgeService {
  constructor() {
    // FAQ knowledge base with embeddings (in production, store in Azure Cognitive Search or vector DB)
    this.faqData = [
      {
        category: 'programs',
        question: 'What loan programs does FAHM offer?',
        answer: 'FAHM offers Conventional, FHA, VA, USDA, and Jumbo loan programs. Each program has different requirements for credit score, down payment, and property type. Conventional loans typically require 3-20% down and a 620+ credit score. FHA loans allow as little as 3.5% down with a 580+ score. VA loans are available for eligible veterans with no down payment. USDA loans are for rural properties with no down payment.',
        keywords: ['programs', 'loan types', 'conventional', 'fha', 'va', 'usda', 'jumbo']
      },
      {
        category: 'eligibility',
        question: 'What credit score do I need?',
        answer: 'Minimum credit scores vary by program: Conventional loans typically require 620+, FHA loans 580+ (3.5% down) or 500+ (10% down), VA loans 580-620 depending on lender, USDA loans 640+, and Jumbo loans 700+. Higher credit scores generally qualify for better interest rates.',
        keywords: ['credit score', 'fico', 'minimum score', 'eligibility', 'credit requirements']
      },
      {
        category: 'eligibility',
        question: 'How much down payment do I need?',
        answer: 'Down payment requirements vary by loan type: Conventional loans require 3-20%, FHA loans 3.5-10%, VA loans 0% for eligible veterans, USDA loans 0% for rural properties, and Jumbo loans typically 10-20%. Higher down payments often result in better rates and lower monthly payments.',
        keywords: ['down payment', 'deposit', 'money down', 'upfront cost']
      },
      {
        category: 'process',
        question: 'How long does the loan process take?',
        answer: 'The typical mortgage process takes 30-45 days from application to closing. Timeline breakdown: Pre-approval (1-3 days), Home search (varies), Purchase contract, Full application and processing (7-10 days), Underwriting (7-14 days), Final approval and clear to close (3-5 days), Closing. Factors affecting timeline include appraisal scheduling, document submission speed, and underwriting workload.',
        keywords: ['timeline', 'how long', 'process time', 'closing time', 'days to close']
      },
      {
        category: 'process',
        question: 'What are the steps in the mortgage process?',
        answer: 'Mortgage process steps: 1) Pre-approval - Submit income, assets, credit for initial approval. 2) Home shopping - Work with realtor to find property. 3) Purchase contract - Make offer and negotiate. 4) Full application - Complete detailed loan application. 5) Processing - Loan processor collects and verifies documents. 6) Underwriting - Underwriter reviews file and may request conditions. 7) Appraisal - Property appraisal ordered and completed. 8) Clear to close - Final approval issued. 9) Closing - Sign documents and receive keys.',
        keywords: ['steps', 'process', 'stages', 'milestones', 'what happens', 'workflow']
      },
      {
        category: 'documents',
        question: 'What documents do I need?',
        answer: 'Standard documentation includes: Income verification (pay stubs from last 2 months, W-2s from last 2 years, tax returns if self-employed), Asset verification (bank statements from last 2 months for all accounts), Identity (government-issued ID), Credit (authorization form), Property (purchase contract, homeowners insurance). Additional documents may be needed based on your specific situation.',
        keywords: ['documents', 'paperwork', 'what do i need', 'requirements', 'documentation']
      },
      {
        category: 'documents',
        question: 'How do I upload documents?',
        answer: 'You can upload documents directly in the FAHM mobile app: 1) Go to Documents section, 2) Select your loan, 3) Choose document type, 4) Take photo or select file, 5) Upload. Accepted formats: PDF, PNG, JPG. Files sync automatically to your loan file. You\'ll receive confirmation when your loan officer reviews them.',
        keywords: ['upload', 'submit', 'send documents', 'document upload', 'how to upload']
      },
      {
        category: 'rates',
        question: 'What are current mortgage rates?',
        answer: 'Current rates vary daily based on market conditions, loan type, credit score, down payment, and property type. Typical ranges (as of now): Conventional 30-year: 6.5-7.5%, FHA 30-year: 6.0-7.0%, VA 30-year: 6.0-7.0%, 15-year loans: typically 0.5-1% lower than 30-year. For personalized rate quote, use the Rate Calculator in the app or contact your loan officer.',
        keywords: ['rates', 'interest rate', 'current rates', 'what rate', 'apr']
      },
      {
        category: 'rates',
        question: 'What is APR and how is it different from interest rate?',
        answer: 'Interest rate is the cost to borrow money, shown as a percentage. APR (Annual Percentage Rate) includes the interest rate PLUS other costs like origination fees, discount points, and mortgage insurance, expressed as a yearly rate. APR gives you a more complete picture of loan costs. For example, a loan might have a 6.5% interest rate but a 6.8% APR due to fees.',
        keywords: ['apr', 'annual percentage rate', 'interest vs apr', 'rate difference']
      },
      {
        category: 'fees',
        question: 'What are closing costs?',
        answer: 'Closing costs typically range from 2-5% of loan amount and include: Lender fees (origination, underwriting, processing), Third-party fees (appraisal, credit report, title insurance, title search, survey, attorney fees), Prepaid items (property taxes, homeowners insurance, HOA dues), Escrow deposits (taxes and insurance reserves). You\'ll receive a Loan Estimate within 3 days of application showing estimated costs.',
        keywords: ['closing costs', 'fees', 'how much', 'costs', 'expenses']
      },
      {
        category: 'closing',
        question: 'What happens at closing?',
        answer: 'At closing, you\'ll: 1) Review and sign final loan documents (promissory note, deed of trust/mortgage, closing disclosure), 2) Provide certified funds for down payment and closing costs, 3) Receive keys to your new home. The closing typically takes 1-2 hours. Bring government-issued ID and certified funds (wire transfer or cashier\'s check). After closing, the lender funds the loan and you officially own the property.',
        keywords: ['closing', 'settlement', 'final step', 'signing', 'what happens at closing']
      },
      {
        category: 'programs',
        question: 'What is an FHA loan?',
        answer: 'FHA loans are government-insured mortgages offered through approved lenders like FAHM. Benefits: Low down payment (3.5% with 580+ credit score), flexible credit requirements (minimum 500 score with 10% down), lower closing costs. Requirements: Upfront mortgage insurance premium (1.75% of loan), annual mortgage insurance, property must meet FHA standards, loan limits vary by county. Ideal for first-time buyers or those with limited down payment funds.',
        keywords: ['fha', 'fha loan', 'government loan', 'low down payment']
      },
      {
        category: 'programs',
        question: 'What is a VA loan?',
        answer: 'VA loans are guaranteed by the Department of Veterans Affairs for eligible service members, veterans, and surviving spouses. Benefits: No down payment required, no monthly mortgage insurance, competitive interest rates, limited closing costs, no prepayment penalty. Eligibility: Must meet service requirements and obtain Certificate of Eligibility (COE). Funding fee applies (waived for disabled veterans). Property must meet VA minimum standards.',
        keywords: ['va', 'va loan', 'veteran', 'military', 'no down payment']
      },
      {
        category: 'eligibility',
        question: 'Can I qualify if I am self-employed?',
        answer: 'Yes! Self-employed borrowers can qualify for mortgages. Requirements: Typically 2 years of self-employment history, 2 years of personal and business tax returns, Year-to-date profit and loss statement, CPA-prepared financials (for some programs), Stable or increasing income trend. Lenders calculate qualifying income by averaging your net income (after expenses) over 2 years. Some programs have more flexible documentation options.',
        keywords: ['self-employed', '1099', 'business owner', 'contractor', 'freelance']
      },
      {
        category: 'process',
        question: 'What is pre-approval and why do I need it?',
        answer: 'Pre-approval is a lender\'s conditional commitment to loan you a specific amount based on verified income, assets, and credit. Benefits: Shows sellers you\'re a serious buyer, strengthens your offer in competitive markets, identifies potential issues early, speeds up final approval process, helps you know your budget. Pre-approval typically valid for 60-90 days. To get pre-approved, submit income docs, asset statements, and authorize credit check.',
        keywords: ['pre-approval', 'preapproval', 'pre approval', 'pre qualified', 'approval letter']
      }
    ];
  }

  /**
   * Search FAQ knowledge base using semantic similarity
   * @param {String} query - User's question
   * @param {String} category - Optional category filter
   * @returns {Promise<Object>} - Best matching FAQ entry
   */
  async searchFAQ(query, category = null) {
    try {
      // Filter by category if provided
      let searchPool = this.faqData;
      if (category) {
        searchPool = this.faqData.filter(faq => faq.category === category);
      }

      // Simple keyword matching (in production, use embeddings and vector similarity)
      const queryLower = query.toLowerCase();
      const scored = searchPool.map(faq => {
        let score = 0;
        
        // Check keywords
        faq.keywords.forEach(keyword => {
          if (queryLower.includes(keyword.toLowerCase())) {
            score += 2;
          }
        });

        // Check question similarity
        const questionWords = faq.question.toLowerCase().split(' ');
        questionWords.forEach(word => {
          if (word.length > 3 && queryLower.includes(word)) {
            score += 1;
          }
        });

        return { ...faq, score };
      });

      // Sort by score and return best match
      scored.sort((a, b) => b.score - a.score);

      if (scored[0].score > 0) {
        return {
          success: true,
          faq: scored[0],
          confidence: scored[0].score > 5 ? 'high' : scored[0].score > 2 ? 'medium' : 'low'
        };
      }

      return {
        success: false,
        message: 'No matching FAQ found'
      };
    } catch (error) {
      logger.error('FAQ search error:', error);
      throw error;
    }
  }

  /**
   * Get loan status from Encompass
   * @param {String} loanId - Loan application ID
   * @returns {Promise<Object>} - Loan status data
   */
  async getLoanStatus(loanId) {
    try {
      const loan = await LoanApplication.findById(loanId)
        .populate('borrower', 'name email phone')
        .populate('assignedOfficer', 'name email phone nmls');

      if (!loan) {
        return {
          success: false,
          message: 'Loan not found'
        };
      }

      // Fetch live data from Encompass if available
      let encompassData = null;
      if (loan.encompassLoanId) {
        try {
          encompassData = await encompassService.getLoanDetails(loan.encompassLoanId);
        } catch (err) {
          logger.warn(`Could not fetch Encompass data for loan ${loanId}:`, err.message);
        }
      }

      return {
        success: true,
        loan: {
          id: loan._id,
          status: loan.status,
          loanAmount: loan.loanAmount,
          propertyAddress: loan.propertyAddress,
          milestones: loan.milestones,
          borrower: loan.borrower,
          assignedOfficer: loan.assignedOfficer,
          encompassData: encompassData ? {
            status: encompassData.status,
            loanNumber: encompassData.loanNumber,
            currentMilestone: encompassData.currentMilestone
          } : null
        }
      };
    } catch (error) {
      logger.error('Get loan status error:', error);
      throw error;
    }
  }

  /**
   * Get CRM data from Total Expert
   * @param {String} contactId - CRM contact ID or email
   * @returns {Promise<Object>} - CRM contact data
   */
  async getCRMData(contactId) {
    try {
      // Try finding user by ID or email
      let user;
      if (contactId.includes('@')) {
        user = await User.findOne({ email: contactId });
      } else {
        user = await User.findById(contactId);
      }

      if (!user) {
        return {
          success: false,
          message: 'Contact not found'
        };
      }

      // Fetch CRM data if available
      let crmData = null;
      if (user.totalExpertContactId) {
        try {
          crmData = await totalExpertService.getContactEngagement(user.totalExpertContactId);
        } catch (err) {
          logger.warn(`Could not fetch CRM data for contact ${contactId}:`, err.message);
        }
      }

      return {
        success: true,
        contact: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          crmData: crmData ? {
            engagementScore: crmData.engagementScore,
            activeJourneys: crmData.activeJourneys,
            lastActivity: crmData.lastActivityDate
          } : null
        }
      };
    } catch (error) {
      logger.error('Get CRM data error:', error);
      throw error;
    }
  }

  /**
   * Get POS application data
   * @param {String} applicationId - POS application ID
   * @returns {Promise<Object>} - POS application data
   */
  async getPOSData(applicationId) {
    try {
      // In production, integrate with Blend/Big POS API
      // For now, return mock data
      return {
        success: true,
        application: {
          id: applicationId,
          status: 'in_progress',
          completionPercentage: 75,
          lastUpdated: new Date(),
          pendingDocuments: ['W-2 (2023)', 'Bank Statement (November)'],
          message: 'POS integration pending - contact your loan officer for application status'
        }
      };
    } catch (error) {
      logger.error('Get POS data error:', error);
      throw error;
    }
  }

  /**
   * Get current rates from Optimal Blue
   * @param {Object} scenario - Loan scenario (productType, loanTerm, loanAmount, creditScore, ltv)
   * @returns {Promise<Object>} - Rate data
   */
  async getRateData(scenario) {
    try {
      const rateData = await optimalBlueService.getRateSheet(
        scenario.productType,
        scenario.loanTerm,
        scenario.loanAmount || 300000,
        scenario.creditScore || 740,
        scenario.ltv || 80
      );

      if (!rateData || rateData.length === 0) {
        return {
          success: false,
          message: 'No rates available for this scenario'
        };
      }

      const bestRate = rateData[0];
      return {
        success: true,
        rate: {
          productType: scenario.productType,
          loanTerm: scenario.loanTerm,
          interestRate: bestRate.rate,
          apr: bestRate.apr,
          points: bestRate.points,
          monthlyPayment: bestRate.monthlyPayment,
          lockPeriod: bestRate.lockPeriod,
          asOf: new Date()
        }
      };
    } catch (error) {
      logger.error('Get rate data error:', error);
      throw error;
    }
  }

  /**
   * Calculate mortgage payment
   * @param {Object} params - Calculation parameters
   * @returns {Object} - Payment calculation
   */
  calculateMortgage(params) {
    const { loanAmount, interestRate, loanTerm, propertyTax = 0, insurance = 0, hoa = 0 } = params;

    // Calculate monthly payment (principal + interest)
    const monthlyRate = interestRate / 100 / 12;
    const numPayments = loanTerm * 12;
    const principalInterest = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
                              (Math.pow(1 + monthlyRate, numPayments) - 1);

    // Total monthly payment
    const totalPayment = principalInterest + propertyTax + insurance + hoa;

    return {
      success: true,
      calculation: {
        loanAmount,
        interestRate,
        loanTerm,
        principalAndInterest: Math.round(principalInterest * 100) / 100,
        propertyTax,
        insurance,
        hoa,
        totalMonthlyPayment: Math.round(totalPayment * 100) / 100,
        totalInterestPaid: Math.round((principalInterest * numPayments - loanAmount) * 100) / 100
      }
    };
  }

  /**
   * Execute function call from OpenAI
   * @param {String} functionName - Function to execute
   * @param {Object} args - Function arguments
   * @returns {Promise<Object>} - Function result
   */
  async executeFunction(functionName, args) {
    try {
      switch (functionName) {
        case 'getLoanStatus':
          return await this.getLoanStatus(args.loanId);
        
        case 'getCRMData':
          return await this.getCRMData(args.contactId);
        
        case 'getPOSData':
          return await this.getPOSData(args.applicationId);
        
        case 'getRateData':
          return await this.getRateData(args);
        
        case 'calculateMortgage':
          return this.calculateMortgage(args);
        
        case 'searchFAQ':
          return await this.searchFAQ(args.query, args.category);
        
        case 'escalateToHuman':
          return {
            success: true,
            escalation: {
              reason: args.reason,
              urgency: args.urgency || 'medium',
              preferredMethod: args.preferredMethod || 'in_app_chat'
            }
          };
        
        default:
          return {
            success: false,
            message: `Unknown function: ${functionName}`
          };
      }
    } catch (error) {
      logger.error(`Function execution error (${functionName}):`, error);
      return {
        success: false,
        message: error.message
      };
    }
  }
}

module.exports = new ChatbotKnowledgeService();
