/**
 * In-memory rate limiter middleware.
 *
 * Tracks request counts per IP in a simple Map and rejects requests that
 * exceed the configured threshold within the sliding window.
 *
 * Usage:
 *   const { rateLimiter } = require('./middleware/rateLimiter');
 *   router.post('/login', rateLimiter({ windowMs: 15 * 60 * 1000, max: 10 }), handler);
 */

const createStore = () => {
  const hits = new Map();

  // Periodically purge expired entries to avoid memory leaks
  const CLEANUP_INTERVAL = 60 * 1000; // 1 minute
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (now > entry.resetTime) {
        hits.delete(key);
      }
    }
  }, CLEANUP_INTERVAL);
  // Allow the process to exit even if the timer is still running
  if (timer.unref) timer.unref();

  return {
    increment(key, windowMs) {
      const now = Date.now();
      const existing = hits.get(key);

      if (!existing || now > existing.resetTime) {
        const entry = { count: 1, resetTime: now + windowMs };
        hits.set(key, entry);
        return entry;
      }

      existing.count += 1;
      return existing;
    },
  };
};

const defaultStore = createStore();

/**
 * @param {Object} options
 * @param {number} options.windowMs  - Time window in milliseconds (default 15 min)
 * @param {number} options.max       - Max requests per window (default 100)
 * @param {string} [options.message] - Response message when rate-limited
 */
const rateLimiter = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000,
    max = 100,
    message = 'Too many requests, please try again later',
  } = options;

  const store = defaultStore;

  return (req, res, next) => {
    const key = req.ip;
    const entry = store.increment(key, windowMs);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - entry.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000));

    if (entry.count > max) {
      return res.status(429).json({ error: message });
    }

    return next();
  };
};

module.exports = { rateLimiter };
