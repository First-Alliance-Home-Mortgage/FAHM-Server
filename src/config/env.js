const dotenv = require('dotenv');

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
  'POS_API_URL',
  'XACTUS_API_URL',
  'REDIS_URL',
  'SENTRY_DSN',
  'OTEL_EXPORTER_OTLP_ENDPOINT',
  'CORS_ORIGINS',
  'TWILIO_AUTH_TOKEN',
];

[...required, ...recommended].forEach((key) => {
  if (!process.env[key]) {
    console.warn(`[env] Missing ${required.includes(key) ? 'required' : 'recommended'} env var ${key}. Set it in .env.`);
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
  integrations: {
    encompass: process.env.ENCOMPASS_API_URL,
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

