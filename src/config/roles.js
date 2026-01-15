
// Capabilities are now stored in the database and referenced by role documents.
// This file only provides role constants and the hasCapability utility.

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
  hasCapability,
};

