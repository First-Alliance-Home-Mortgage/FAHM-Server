const asyncHandler = require('../../src/utils/asyncHandler');

describe('asyncHandler', () => {
  it('calls the wrapped function with req, res, next', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const req = {};
    const res = {};
    const next = jest.fn();

    const wrapped = asyncHandler(fn);
    await wrapped(req, res, next);

    expect(fn).toHaveBeenCalledWith(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });

  it('forwards errors to next', async () => {
    const error = new Error('boom');
    const fn = jest.fn().mockRejectedValue(error);
    const next = jest.fn();

    const wrapped = asyncHandler(fn);
    await wrapped({}, {}, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

