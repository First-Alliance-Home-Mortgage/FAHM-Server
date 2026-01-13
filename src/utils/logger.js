const levels = ['error', 'warn', 'info', 'debug'];

const levelIndex = (level) => levels.indexOf(level);

const currentLevel = process.env.LOG_LEVEL || 'info';

const log = (level, message, meta = {}) => {
  if (levelIndex(level) > levelIndex(currentLevel)) {
    return;
  }

  const cleanMeta = { ...meta };
  const reqContext = cleanMeta.req;
  delete cleanMeta.req;

  const payload = {
    level,
    message,
    requestId: reqContext?.id,
    userId: reqContext?.user?._id,
    role: reqContext?.user?.role,
    ...cleanMeta,
    timestamp: new Date().toISOString(),
  };

  // Structured logging payload (can be piped to external logging service)
};

const child = (baseMeta = {}) => {
  const withMeta = (extra) => ({ ...baseMeta, ...extra });
  const api = {
    error: (msg, meta) => log('error', msg, withMeta(meta)),
    warn: (msg, meta) => log('warn', msg, withMeta(meta)),
    info: (msg, meta) => log('info', msg, withMeta(meta)),
    debug: (msg, meta) => log('debug', msg, withMeta(meta)),
  };
  api.child = (meta = {}) => child(withMeta(meta));
  return api;
};

module.exports = {
  error: (msg, meta) => log('error', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  info: (msg, meta) => log('info', msg, meta),
  debug: (msg, meta) => log('debug', msg, meta),
  child,
};

