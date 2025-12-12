describe('logger', () => {
  const originalLogLevel = process.env.LOG_LEVEL;
  let consoleSpy;

  beforeEach(() => {
    jest.resetModules();
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.LOG_LEVEL = originalLogLevel;
    consoleSpy.mockRestore();
  });

  const loadLogger = (level) => {
    process.env.LOG_LEVEL = level;
    jest.resetModules();
    // eslint-disable-next-line global-require
    return require('../../src/utils/logger');
  };

  it('emits log when level is enabled', () => {
    const logger = loadLogger('debug');
    logger.info('hello', { foo: 'bar' });

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(payload).toMatchObject({ level: 'info', message: 'hello', foo: 'bar' });
  });

  it('skips log when below configured level', () => {
    const logger = loadLogger('error');
    logger.debug('should not log');

    expect(consoleSpy).not.toHaveBeenCalled();
  });
});

