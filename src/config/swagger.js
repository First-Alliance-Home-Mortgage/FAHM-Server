const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'FAHM Server API',
      version: '1.0.0',
      description: 'REST API for FAHM mobile app - loan application management system with role-based access control',
      contact: {
        name: 'FAHM Development Team',
        email: 'dev@fahm.example.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:4000/api/v1',
        description: 'Development server',
      },
      {
        url: 'https://api.fahm.example.com/api/v1',
        description: 'Production server',
      },
    ],
    tags: [
      { name: 'Authentication', description: 'User authentication and registration' },
      { name: 'Users', description: 'User profile management' },
      { name: 'Loans', description: 'Loan application operations' },
      { name: 'Documents', description: 'Document upload and management' },
      { name: 'Notifications', description: 'User notification system' },
      { name: 'Calculator', description: 'Mortgage payment calculator' },
      { name: 'POS Integration', description: 'Point of Sale system integration' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token obtained from /auth/login or /auth/register',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '507f1f77bcf86cd799439011' },
            name: { type: 'string', example: 'Jane Doe' },
            email: { type: 'string', format: 'email', example: 'jane@example.com' },
            phone: { type: 'string', example: '5551234567' },
            role: {
              type: 'string',
              enum: ['borrower', 'loan_officer_tpo', 'loan_officer_retail', 'broker', 'branch_manager', 'realtor', 'admin'],
              example: 'borrower',
            },
            isActive: { type: 'boolean', example: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Milestone: {
          type: 'object',
          properties: {
            name: { type: 'string', example: 'Application Submitted' },
            status: {
              type: 'string',
              enum: ['pending', 'in_progress', 'completed'],
              example: 'completed',
            },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        LoanApplication: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '507f191e810c19729de860ea' },
            borrower: { $ref: '#/components/schemas/User' },
            assignedOfficer: { $ref: '#/components/schemas/User' },
            amount: { type: 'number', example: 250000 },
            propertyAddress: { type: 'string', example: '123 Main St, City, ST 12345' },
            status: {
              type: 'string',
              enum: ['application', 'processing', 'underwriting', 'closing', 'funded'],
              example: 'processing',
            },
            source: { type: 'string', enum: ['retail', 'tpo'], example: 'retail' },
            milestones: {
              type: 'array',
              items: { $ref: '#/components/schemas/Milestone' },
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Document: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '507f191e810c19729de860eb' },
            loan: { type: 'string', example: '507f191e810c19729de860ea' },
            uploadedBy: { $ref: '#/components/schemas/User' },
            name: { type: 'string', example: 'W2_2024.pdf' },
            type: {
              type: 'string',
              enum: ['pdf', 'png', 'jpg', 'jpeg'],
              example: 'pdf',
            },
            url: { type: 'string', example: 'https://storage.example.com/docs/w2_2024.pdf' },
            size: { type: 'integer', example: 245760 },
            hash: { type: 'string', example: 'sha256:abc123def456' },
            status: {
              type: 'string',
              enum: ['pending', 'synced'],
              example: 'pending',
            },
            scanned: { type: 'boolean', example: true },
            scannedAt: { type: 'string', format: 'date-time' },
            tempBlobExpiresAt: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Notification: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '507f191e810c19729de860ec' },
            user: { type: 'string', example: '507f1f77bcf86cd799439011' },
            type: {
              type: 'string',
              enum: ['info', 'status', 'rate_alert', 'message'],
              example: 'status',
            },
            title: { type: 'string', example: 'New Document Required' },
            body: { type: 'string', example: 'Please upload your recent pay stubs' },
            read: { type: 'boolean', example: false },
            metadata: { type: 'object', example: { loanId: '507f191e810c19729de860ea' } },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Error description' },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  msg: { type: 'string', example: 'Validation error message' },
                  param: { type: 'string', example: 'fieldName' },
                  location: { type: 'string', example: 'body' },
                },
              },
            },
            stack: { type: 'string', description: 'Stack trace (development only)' },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/routes/*.js'],
};

module.exports = swaggerJsdoc(options);
