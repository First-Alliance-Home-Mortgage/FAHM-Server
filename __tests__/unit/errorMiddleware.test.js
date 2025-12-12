jest.mock('../../src/utils/logger', () => ({
  error: jest.fn(),
  debug: jest.fn(),
}));

const { notFound, errorHandler } = require('../../src/middleware/error');
const logger = require('../../src/utils/logger');

const createRes = (statusCode = 200) => {
  const res = {
    statusCode,
    json: jest.fn(),
  };
  res.status = jest.fn().mockImplementation((code) => {
    res.statusCode = code;
    return res;
  });
  return res;
};

describe('middleware/error', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('notFound sets 404 and forwards error', () => {
    const req = { originalUrl: '/missing' };
    const res = createRes();
    const next = jest.fn();

    notFound(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toContain('Not Found - /missing');
  });

  it('errorHandler responds with 404 and logs at debug for client errors', () => {
    const req = { originalUrl: '/missing' };
    const res = createRes(404);
    const err = new Error('Not found');

    errorHandler(err, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Not found',
        errors: undefined,
      }),
    );
    expect(logger.debug).toHaveBeenCalledWith('Not found', { path: '/missing' });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('errorHandler responds with 500 and logs at error for server errors', () => {
    const req = { originalUrl: '/boom' };
    const res = createRes();
    const err = new Error('Crash');
    err.status = 500;

    errorHandler(err, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Crash',
      }),
    );
    expect(logger.error).toHaveBeenCalledWith('Crash', expect.objectContaining({ path: '/boom' }));
  });
});

