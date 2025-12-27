const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/env');

const sign = (user) => {
  const subject = user._id || user.id;
  return jwt.sign(
    {
      sub: subject,
      role: user.role,
      email: user.email,
    },
    jwtSecret,
    { expiresIn: '12h' }
  );
};

module.exports = { sign };

