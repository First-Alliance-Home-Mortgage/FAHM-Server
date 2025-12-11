const logger = require('../utils/logger');

const notFound = (req, res, next) => {
  res.status(404);
  next(new Error(`Not Found - ${req.originalUrl}`));
};

const errorHandler = (err, req, res, _next) => {
  // Prefer explicit error status from http-errors; fall back to response status or 500.
  const status = err.status || err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500);
  const logPayload = { path: req.originalUrl };
  if (status >= 500) {
    logPayload.stack = err.stack;
    logger.error(err.message, logPayload);
  } else {
    // For 4xx, keep noise low; emit at debug only.
    logger.debug(err.message, logPayload);
  }
  res.status(status).json({
    message: err.message || 'Server error',
    errors: err.errors,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
};

module.exports = { notFound, errorHandler };

