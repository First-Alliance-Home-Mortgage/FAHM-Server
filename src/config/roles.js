
// Capabilities are now stored in the database and referenced by role documents.
// This file provides role slug constants and the hasCapability utility.

// Role slug constants — must match the `slug` field in the Role collection.
const ADMIN = 'admin';
const BRANCH_MANAGER = 'branch_manager';
const LO_RETAIL = 'loan_officer_retail';
const LO_TPO = 'loan_officer_tpo';
const BROKER = 'broker';
const REALTOR = 'realtor';
const BORROWER = 'borrower';

const hasCapability = (roleOrRoleObject, capability) => {
  // Only check capabilities from the role object (populated from DB)
  if (roleOrRoleObject && Array.isArray(roleOrRoleObject.capabilities)) {
    const required = (capability || '').toLowerCase().trim();
    return roleOrRoleObject.capabilities.some(cap => {
      if (!cap || typeof cap.name !== 'string') return false;
      const current = cap.name.toLowerCase().trim();
      return current === required;
    });
  }
  return false;
};

module.exports = {
  ADMIN,
  BRANCH_MANAGER,
  LO_RETAIL,
  LO_TPO,
  BROKER,
  REALTOR,
  BORROWER,
  hasCapability,
};

