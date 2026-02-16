const dotenv = require('dotenv');
const logger = require('../utils/logger');

dotenv.config();

const required = [
  'MONGO_URI',
  'JWT_SECRET',
];

// Important but environment-specific keys that we warn on (not fatal for local dev)
const recommended = [
  'AZURE_STORAGE_CONNECTION_STRING',
  'AZURE_BLOB_CONTAINER',
  'OPTIMAL_BLUE_CLIENT_ID',
  'OPTIMAL_BLUE_CLIENT_SECRET',
  'TOTAL_EXPERT_API_KEY',
  'TOTAL_EXPERT_API_URL',
  'ENCOMPASS_API_URL',
  'ENCOMPASS_CLIENT_ID',
  'ENCOMPASS_CLIENT_SECRET',
  'ENCOMPASS_INSTANCE_ID',
  'ENCOMPASS_USERNAME',
  'ENCOMPASS_PASSWORD',
  'ENCOMPASS_WEBHOOK_SECRET',
  'POS_API_URL',
  'XACTUS_API_URL',
  'REDIS_URL',
  'SENTRY_DSN',
  'OTEL_EXPORTER_OTLP_ENDPOINT',
  'CORS_ORIGINS',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_PHONE_NUMBER',
  'SMTP_HOST',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM',
  'SMTP_PORT',
  'API_BASE_URL',
];

// Fail fast on missing required env vars (skip in test environment)
if (process.env.NODE_ENV !== 'test') {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}. Set them in .env.`);
  }
}

recommended.forEach((key) => {
  if (!process.env[key]) {
    logger.warn(`Missing recommended env var ${key}. Set it in .env.`);
  }
});

module.exports = {
  port: Number(process.env.PORT || 4000),
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  refreshTokenExpiryDays: Number(process.env.REFRESH_TOKEN_EXPIRATION_DAYS || 30),
  logLevel: process.env.LOG_LEVEL || 'info',
  storage: {
    azureConnectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
    container: process.env.AZURE_BLOB_CONTAINER || 'loan-documents',
    presignExpiryMinutes: Number(process.env.STORAGE_PRESIGN_EXPIRY_MINUTES || 30),
  },
  redis: {
    url: process.env.REDIS_URL,
  },
  telemetry: {
    sentryDsn: process.env.SENTRY_DSN,
    otelEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  },
  security: {
    corsOrigins: process.env.CORS_ORIGINS || '*',
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER,
  },
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || '"First Alliance Home Mortgage" <noreply@fahm.com>',
  },
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:4000',
  integrations: {
    encompass: process.env.ENCOMPASS_API_URL,
    encompassClientId: process.env.ENCOMPASS_CLIENT_ID,
    encompassClientSecret: process.env.ENCOMPASS_CLIENT_SECRET,
    encompassInstanceId: process.env.ENCOMPASS_INSTANCE_ID,
    encompassUsername: process.env.ENCOMPASS_USERNAME,
    encompassPassword: process.env.ENCOMPASS_PASSWORD,
    encompassGrantType: process.env.ENCOMPASS_GRANT_TYPE || 'password',
    encompassWebhookSecret: process.env.ENCOMPASS_WEBHOOK_SECRET,
    totalExpert: process.env.TOTAL_EXPERT_API_URL,
    totalExpertApiKey: process.env.TOTAL_EXPERT_API_KEY,
    pos: process.env.POS_API_URL,
    xactus: process.env.XACTUS_API_URL,
    optimalBlue: process.env.OPTIMAL_BLUE_API_URL,
    optimalBlueClientId: process.env.OPTIMAL_BLUE_CLIENT_ID,
    optimalBlueClientSecret: process.env.OPTIMAL_BLUE_CLIENT_SECRET,
    blendBaseUrl: process.env.BLEND_BASE_URL,
    blendClientId: process.env.BLEND_CLIENT_ID,
    blendClientSecret: process.env.BLEND_CLIENT_SECRET,
  },
};

