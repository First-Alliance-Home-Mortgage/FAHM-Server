
// Capabilities are now stored in the database and referenced by role documents.
// This file provides role slug constants, role group helpers, and the hasCapability utility.
//
// Role slug constants MUST match the `slug` field in the Role collection (seeded by scripts/seedRoles.js).

// ── Role slug constants ─────────────────────────────────────────────────────
const ADMIN = 'admin';
const BRANCH_MANAGER = 'branch_manager';
const LO_RETAIL = 'loan_officer_retail';
const LO_TPO = 'loan_officer_tpo';
const BROKER = 'broker';
const REALTOR = 'realtor';
const BORROWER = 'borrower';

// ── Role groups (common combinations used in authorize() calls) ─────────────
const STAFF_ROLES = [ADMIN, LO_RETAIL, LO_TPO];
const ALL_LO_ROLES = [LO_RETAIL, LO_TPO];
const MANAGEMENT_ROLES = [ADMIN, BRANCH_MANAGER];
const INTERNAL_ROLES = [ADMIN, BRANCH_MANAGER, LO_RETAIL, LO_TPO];
const EXTERNAL_ROLES = [BROKER, REALTOR, BORROWER];
const ALL_ROLES = [ADMIN, BRANCH_MANAGER, LO_RETAIL, LO_TPO, BROKER, REALTOR, BORROWER];

// ── Capability checker ──────────────────────────────────────────────────────
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

// ── Flat array of valid role slug strings (for express-validator .isIn()) ────
const ROLE_SLUGS = [ADMIN, BRANCH_MANAGER, LO_RETAIL, LO_TPO, BROKER, REALTOR, BORROWER];

module.exports = {
  // Individual roles
  ADMIN,
  BRANCH_MANAGER,
  LO_RETAIL,
  LO_TPO,
  BROKER,
  REALTOR,
  BORROWER,
  // Flat slug array for validators (safe to use with Object.values won't pick this up wrong)
  ROLE_SLUGS,
  // Role groups
  STAFF_ROLES,
  ALL_LO_ROLES,
  MANAGEMENT_ROLES,
  INTERNAL_ROLES,
  EXTERNAL_ROLES,
  ALL_ROLES,
  // Utilities
  hasCapability,
};
