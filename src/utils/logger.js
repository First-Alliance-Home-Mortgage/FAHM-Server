const levels = ['error', 'warn', 'info', 'debug'];

const levelIndex = (level) => levels.indexOf(level);

const currentLevel = process.env.LOG_LEVEL || 'info';

const safeMeta = (meta) => {
  if (!meta || typeof meta !== 'object') return {};
  const out = {};
  for (const [key, val] of Object.entries(meta)) {
    if (val instanceof Error) {
      out[key] = { message: val.message, stack: val.stack };
    } else {
      out[key] = val;
    }
  }
  return out;
};

const log = (level, message, meta = {}) => {
  if (levelIndex(level) > levelIndex(currentLevel)) {
    return;
  }

  try {
    const payload = JSON.stringify({ level, message, timestamp: new Date().toISOString(), ...safeMeta(meta) });
    console.log(payload);
  } catch {
    console.log(JSON.stringify({ level, message, timestamp: new Date().toISOString() }));
  }
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

