const axios = require('axios');
const logger = require('../utils/logger');

class AzureOpenAIService {
  constructor() {
    this.endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    this.apiKey = process.env.AZURE_OPENAI_API_KEY;
    this.deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4';
    this.apiVersion = '2024-02-15-preview';
    this.embeddingDeployment = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || 'text-embedding-ada-002';
    
    if (!this.endpoint || !this.apiKey) {
      logger.warn('Azure OpenAI credentials not configured - chatbot will use fallback responses');
    }
  }

  /**
   * Generate chat completion with Azure OpenAI
   * @param {Array} messages - Array of message objects with role and content
   * @param {Array} functions - Array of function definitions for function calling
   * @param {Object} options - Additional options (temperature, max_tokens, etc.)
   * @returns {Promise<Object>} - Chat completion response
   */
  async getChatCompletion(messages, functions = null, options = {}) {
    if (!this.endpoint || !this.apiKey) {
      throw new Error('Azure OpenAI not configured');
    }

    const url = `${this.endpoint}/openai/deployments/${this.deploymentName}/chat/completions?api-version=${this.apiVersion}`;

    const payload = {
      messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.max_tokens || 800,
      top_p: options.top_p || 0.95,
      frequency_penalty: options.frequency_penalty || 0,
      presence_penalty: options.presence_penalty || 0,
      stop: options.stop || null
    };

    if (functions && functions.length > 0) {
      payload.functions = functions;
      payload.function_call = options.function_call || 'auto';
    }

    try {
      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.apiKey
        },
        timeout: 30000
      });

      return response.data;
    } catch (error) {
      logger.error('Azure OpenAI chat completion error:', error.response?.data || error.message);
      throw new Error(`Chat completion failed: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Generate embeddings for semantic search
   * @param {String} text - Text to embed
   * @returns {Promise<Array>} - Embedding vector
   */
  async getEmbedding(text) {
    if (!this.endpoint || !this.apiKey) {
      throw new Error('Azure OpenAI not configured');
    }

    const url = `${this.endpoint}/openai/deployments/${this.embeddingDeployment}/embeddings?api-version=${this.apiVersion}`;

    try {
      const response = await axios.post(url, {
        input: text
      }, {
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.apiKey
        },
        timeout: 15000
      });

      return response.data.data[0].embedding;
    } catch (error) {
      logger.error('Azure OpenAI embedding error:', error.response?.data || error.message);
      throw new Error(`Embedding generation failed: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Build system prompt based on user context
   * @param {Object} context - User context (role, loan, etc.)
   * @returns {String} - System prompt
   */
  buildSystemPrompt(context) {
    const basePrompt = `You are FAHM AI Assistant, a helpful mortgage loan assistant for First Alliance Home Mortgage.

Your role is to:
- Answer frequently asked questions about mortgage programs, rates, and processes
- Look up loan status and milestones for borrowers
- Provide program guidance and eligibility requirements
- Calculate mortgage payments and scenarios
- Escalate complex issues to human loan officers when needed

Guidelines:
- Be friendly, professional, and concise
- Use simple language, avoid jargon when possible
- Always verify you have current data before providing loan-specific information
- If you don't know something or need clarification, ask the user or suggest escalation
- For sensitive topics (credit, income, denials), be empathetic and offer to connect with a loan officer
- Never make up information - if you don't have data, say so clearly

User Context:
- Role: ${context.userRole || 'borrower'}
${context.currentLoanId ? `- Active Loan ID: ${context.currentLoanId}` : ''}
${context.preferredLanguage ? `- Language: ${context.preferredLanguage}` : ''}

When using functions to fetch live data:
- Use getLoanStatus for borrower loan inquiries
- Use getCRMData for contact and engagement information
- Use getRateData for current rates and pricing
- Use searchFAQ for policy and guideline questions
- Use calculateMortgage for payment calculations
- Use escalateToHuman when the user requests help or the issue is beyond your capability`;

    return basePrompt;
  }

  /**
   * Define available functions for function calling
   * @returns {Array} - Function definitions
   */
  getFunctionDefinitions() {
    return [
      {
        name: 'getLoanStatus',
        description: 'Retrieve current loan status, milestones, and assigned contacts from Encompass LOS',
        parameters: {
          type: 'object',
          properties: {
            loanId: {
              type: 'string',
              description: 'The loan application ID'
            }
          },
          required: ['loanId']
        }
      },
      {
        name: 'getCRMData',
        description: 'Get borrower contact information, engagement history, and marketing journey status from Total Expert CRM',
        parameters: {
          type: 'object',
          properties: {
            contactId: {
              type: 'string',
              description: 'The CRM contact ID or user email'
            }
          },
          required: ['contactId']
        }
      },
      {
        name: 'getPOSData',
        description: 'Retrieve Point of Sale application data, document status, and completion percentage',
        parameters: {
          type: 'object',
          properties: {
            applicationId: {
              type: 'string',
              description: 'The POS application ID'
            }
          },
          required: ['applicationId']
        }
      },
      {
        name: 'getRateData',
        description: 'Get current mortgage rates and pricing from Optimal Blue for specific loan scenario',
        parameters: {
          type: 'object',
          properties: {
            productType: {
              type: 'string',
              enum: ['conventional', 'fha', 'va', 'usda', 'jumbo'],
              description: 'Loan product type'
            },
            loanTerm: {
              type: 'number',
              enum: [10, 15, 20, 25, 30],
              description: 'Loan term in years'
            },
            loanAmount: {
              type: 'number',
              description: 'Loan amount in dollars'
            },
            creditScore: {
              type: 'number',
              description: 'Borrower credit score (300-850)'
            },
            ltv: {
              type: 'number',
              description: 'Loan-to-value ratio (0-100)'
            }
          },
          required: ['productType', 'loanTerm']
        }
      },
      {
        name: 'calculateMortgage',
        description: 'Calculate monthly mortgage payment including principal, interest, taxes, insurance, and HOA',
        parameters: {
          type: 'object',
          properties: {
            loanAmount: {
              type: 'number',
              description: 'Loan amount in dollars'
            },
            interestRate: {
              type: 'number',
              description: 'Annual interest rate as percentage (e.g., 6.5 for 6.5%)'
            },
            loanTerm: {
              type: 'number',
              description: 'Loan term in years'
            },
            propertyTax: {
              type: 'number',
              description: 'Monthly property tax'
            },
            insurance: {
              type: 'number',
              description: 'Monthly homeowners insurance'
            },
            hoa: {
              type: 'number',
              description: 'Monthly HOA fees'
            }
          },
          required: ['loanAmount', 'interestRate', 'loanTerm']
        }
      },
      {
        name: 'searchFAQ',
        description: 'Search FAQ knowledge base for mortgage program guidelines, eligibility requirements, and process information',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The question or topic to search for'
            },
            category: {
              type: 'string',
              enum: ['programs', 'eligibility', 'process', 'documents', 'rates', 'fees', 'closing'],
              description: 'FAQ category to narrow search'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'escalateToHuman',
        description: 'Escalate conversation to a human loan officer via Teams or in-app chat',
        parameters: {
          type: 'object',
          properties: {
            reason: {
              type: 'string',
              description: 'Reason for escalation'
            },
            urgency: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              description: 'Urgency level'
            },
            preferredMethod: {
              type: 'string',
              enum: ['teams', 'in_app_chat', 'sms', 'email'],
              description: 'Preferred escalation method'
            }
          },
          required: ['reason']
        }
      }
    ];
  }

  /**
   * Format conversation history for OpenAI API
   * @param {Array} messages - Array of message objects from ChatbotSession
   * @param {Number} limit - Max messages to include
   * @returns {Array} - Formatted messages for OpenAI
   */
  formatConversationHistory(messages, limit = 10) {
    const recentMessages = messages.slice(-limit);
    
    return recentMessages.map(msg => {
      const formatted = {
        role: msg.role,
        content: msg.content
      };

      if (msg.functionCall) {
        formatted.function_call = {
          name: msg.functionCall.name,
          arguments: msg.functionCall.arguments
        };
      }

      if (msg.functionResponse) {
        formatted.name = msg.functionResponse.name;
        formatted.content = msg.functionResponse.content;
      }

      return formatted;
    });
  }

  /**
   * Generate fallback response when OpenAI is unavailable
   * @param {String} userMessage - User's message
   * @returns {String} - Fallback response
   */
  generateFallbackResponse(userMessage) {
    const lowerMessage = userMessage.toLowerCase();

    // Simple keyword matching for common queries
    if (lowerMessage.includes('rate') || lowerMessage.includes('interest')) {
      return "I'm unable to fetch live rate data at the moment. For current mortgage rates, please contact your loan officer or visit our rates page. Typical rates for conventional 30-year loans range from 6.5% to 7.5% depending on credit score and down payment.";
    }

    if (lowerMessage.includes('status') || lowerMessage.includes('loan')) {
      return "I'm currently unable to access loan status information. Please contact your assigned loan officer directly for the most up-to-date information on your loan application.";
    }

    if (lowerMessage.includes('payment') || lowerMessage.includes('calculate')) {
      return "I can help with payment calculations, but I'm experiencing connectivity issues. As a general estimate, a $300,000 loan at 7% for 30 years would have a principal and interest payment of about $1,995/month (not including taxes, insurance, or HOA fees).";
    }

    if (lowerMessage.includes('document') || lowerMessage.includes('upload')) {
      return "For document upload questions, please use the Documents section of the app or contact your loan officer. Common documents needed include: pay stubs (last 2 months), W-2s (last 2 years), bank statements (last 2 months), and tax returns (last 2 years).";
    }

    if (lowerMessage.includes('preapproval') || lowerMessage.includes('pre-approval')) {
      return "To get pre-approved, you'll typically need to provide income verification, credit authorization, and asset documentation. Your loan officer can start this process and typically provide a pre-approval letter within 24-48 hours.";
    }

    // Default fallback
    return "I apologize, but I'm currently experiencing technical difficulties and can't provide detailed assistance. Would you like me to connect you with a loan officer who can help? You can also try asking your question again in a moment.";
  }
}

module.exports = new AzureOpenAIService();
