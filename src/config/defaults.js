const roles = require('./roles');

const MB = 1024 * 1024;

module.exports = {
  upload: {
    maxSizeBytes: 20 * MB,
    allowedTypes: ['pdf', 'png', 'jpg', 'jpeg'],
    tempBlobRetentionHours: 24,
    duplicateHashAlgorithm: 'sha256',
  },
  pos: {
    tokenTtlMinutes: 15,
    maxMintsPerMinute: 3,
    deepLinkBase: process.env.POS_DEEP_LINK_BASE || 'https://pos.example.com/deeplink',
  },
  sessions: {
    accessTtlMinutes: 60,
    refreshTtlDays: 7,
    idleTimeoutMinutes: 30,
    mfaRequiredRoles: [
      roles.ADMIN,
      roles.BRANCH_MANAGER,
      roles.LO_TPO,
      roles.LO_RETAIL,
      roles.BROKER,
      roles.REALTOR,
    ],
  },
  notifications: {
    quietHours: { start: 21, end: 8 }, // 9p–8a local server time
    throttlePerEventPerDay: 5,
    retryLimit: 3,
  },
  audit: {
    retentionMonths: 12,
  },
};

