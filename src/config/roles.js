// Role constants used across the API and in tokens
const roles = {
  BORROWER: 'borrower',
  LO_TPO: 'loan_officer_tpo',
  LO_RETAIL: 'loan_officer_retail',
  BROKER: 'broker',
  BRANCH_MANAGER: 'branch_manager',
  REALTOR: 'realtor',
  ADMIN: 'admin',
};

// Capability strings kept intentionally high-level to match the web/mobile guide
const roleCapabilities = {
  [roles.BORROWER]: [
    'loan:read:self',
    'loan:update:self',
    'document:upload',
    'document:download',
    'rates:view',
    'alerts:manage',
    'messages:send',
  ],
  [roles.LO_RETAIL]: [
    'loan:read',
    'loan:update',
    'loan:create',
    'document:upload',
    'document:download',
    'rates:view',
    'rates:lock',
    'alerts:manage',
    'dashboard:view',
    'webhooks:ingest',
  ],
  [roles.LO_TPO]: [
    'loan:read',
    'loan:update',
    'loan:create',
    'document:upload',
    'document:download',
    'rates:view',
    'rates:lock',
    'alerts:manage',
    'dashboard:view',
    'webhooks:ingest',
  ],
  [roles.BROKER]: [
    'loan:read',
    'loan:create',
    'document:upload',
    'document:download',
    'rates:view',
    'alerts:manage',
  ],
  [roles.BRANCH_MANAGER]: [
    'loan:read',
    'loan:update',
    'loan:create',
    'document:download',
    'rates:view',
    'rates:lock',
    'alerts:manage',
    'dashboard:view',
    'users:manage:branch',
  ],
  [roles.REALTOR]: [
    'loan:read:shared',
    'messages:send',
    'rates:view',
  ],
  [roles.ADMIN]: [
    'loan:read',
    'loan:update',
    'loan:create',
    'document:upload',
    'document:download',
    'rates:view',
    'rates:lock',
    'alerts:manage',
    'webhooks:ingest',
    'users:manage',
    'dashboard:view',
    'audit:read',
  ],
};

const hasCapability = (role, capability) => {
  const caps = roleCapabilities[role] || [];
  return caps.includes(capability);
};

module.exports = {
  ...roles,
  roles,
  roleCapabilities,
  hasCapability,
};

