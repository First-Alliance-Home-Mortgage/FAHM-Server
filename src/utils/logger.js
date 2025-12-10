const levels = ['error', 'warn', 'info', 'debug'];

const levelIndex = (level) => levels.indexOf(level);

const currentLevel = process.env.LOG_LEVEL || 'info';

const log = (level, message, meta = {}) => {
  if (levelIndex(level) <= levelIndex(currentLevel)) {
    const payload = {
      level,
      message,
      ...meta,
      timestamp: new Date().toISOString(),
    };
    console.log(JSON.stringify(payload));
  }
};

module.exports = {
  error: (msg, meta) => log('error', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  info: (msg, meta) => log('info', msg, meta),
  debug: (msg, meta) => log('debug', msg, meta),
};

