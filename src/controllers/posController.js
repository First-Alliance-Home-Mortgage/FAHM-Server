const jwt = require('jsonwebtoken');
const createError = require('http-errors');
const { jwtSecret } = require('../config/env');
const defaults = require('../config/defaults');
const { audit } = require('../utils/audit');

// simple in-memory rate limit for token mints per user per minute
const mintWindow = new Map();

function withinRateLimit(userId) {
  const now = Date.now();
  const windowStart = now - 60 * 1000;
  const events = mintWindow.get(userId) || [];
  const recent = events.filter((t) => t >= windowStart);
  recent.push(now);
  mintWindow.set(userId, recent);
  return recent.length <= defaults.pos.maxMintsPerMinute;
}

exports.createHandoff = async (req, res, next) => {
  try {
    if (!withinRateLimit(req.user._id.toString())) {
      return next(createError(429, 'Too many POS handoff requests, try again shortly'));
    }

    const payload = {
      sub: req.user._id.toString(),
      loan: req.body.loanId,
      role: req.user.role,
    };
    const token = jwt.sign(payload, jwtSecret, { expiresIn: `${defaults.pos.tokenTtlMinutes}m` });
    const deepLink = `${defaults.pos.deepLinkBase}?token=${encodeURIComponent(token)}`;

    await audit(
      {
        action: 'pos.handoff',
        entityType: 'POS',
        metadata: { loan: req.body.loanId, deepLinkBase: defaults.pos.deepLinkBase },
      },
      req
    );

    return res.json({ token, deepLink, expiresInMinutes: defaults.pos.tokenTtlMinutes });
  } catch (err) {
    await audit(
      {
        action: 'pos.handoff',
        entityType: 'POS',
        status: 'error',
        metadata: { message: err.message },
      },
      req
    );
    return next(err);
  }
};

