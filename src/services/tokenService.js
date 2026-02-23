const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/env');

const sign = (user) => {
  const subject = user._id || user.id;

  // Extract role slug from populated role object, or fall back to raw value
  const roleSlug = user.role?.slug || user.role?.name || user.role;

  return jwt.sign(
    {
      sub: subject,
      role: roleSlug,
      email: user.email,
    },
    jwtSecret,
    { expiresIn: '12h' }
  );
};

module.exports = { sign };

