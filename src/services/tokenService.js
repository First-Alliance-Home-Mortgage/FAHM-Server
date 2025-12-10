const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/env');

const sign = (user) =>
  jwt.sign(
    {
      sub: user._id,
      role: user.role,
      email: user.email,
    },
    jwtSecret,
    { expiresIn: '12h' }
  );

module.exports = { sign };

