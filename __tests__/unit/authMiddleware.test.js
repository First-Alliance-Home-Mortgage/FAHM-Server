jest.mock('../../src/models/User');
jest.mock('jsonwebtoken');

// ...existing code...
const jwt = require('jsonwebtoken');
const User = require('../../src/models/User');
const { authenticate, authorize } = require('../../src/middleware/auth');

const makeRes = () => ({});
const makeNext = () => jest.fn();

describe('middleware/auth.authenticate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects when no bearer token is provided', async () => {
    const req = { headers: {} };
    const res = makeRes();
    const next = makeNext();

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    const err = next.mock.calls[0][0];
    expect(err.status).toBe(401);
    expect(err.message).toBe('Authentication required');
  });

  it('rejects invalid tokens', async () => {
    const req = { headers: { authorization: 'Bearer badtoken' } };
    const res = makeRes();
    const next = makeNext();
    jwt.verify.mockImplementation(() => { throw new Error('boom'); });

    await authenticate(req, res, next);

    const err = next.mock.calls[0][0];
    expect(err.status).toBe(401);
    expect(err.message).toBe('Invalid token');
  });

  it('attaches user on success', async () => {
    const user = { _id: 'u1', role: { name: 'borrower', slug: 'borrower', capabilities: [] }, isActive: true };
    const req = { headers: { authorization: 'Bearer good' } };
    const res = makeRes();
    const next = makeNext();
    jwt.verify.mockReturnValue({ sub: 'u1' });
    const populateStub = jest.fn().mockResolvedValue(user);
    const selectStub = jest.fn().mockReturnValue({ populate: populateStub });
    User.findById.mockReturnValue({ select: selectStub });

    await authenticate(req, res, next);

    expect(jwt.verify).toHaveBeenCalledWith('good', expect.any(String));
    expect(req.user).toEqual(user);
    expect(next).toHaveBeenCalledWith(); // next called with no args
  });

  it('handles missing user record', async () => {
    const req = { headers: { authorization: 'Bearer good' } };
    const res = makeRes();
    const next = makeNext();
    jwt.verify.mockReturnValue({ sub: 'missing' });
    const populateStub = jest.fn().mockResolvedValue(null);
    const selectStub = jest.fn().mockReturnValue({ populate: populateStub });
    User.findById.mockReturnValue({ select: selectStub });

    await authenticate(req, res, next);

    const err = next.mock.calls[0][0];
    expect(err.status).toBe(401);
    expect(err.message).toBe('User not found');
  });

  it('rejects inactive users', async () => {
    const user = { _id: 'u1', role: { name: 'borrower', slug: 'borrower', capabilities: [] }, isActive: false };
    const req = { headers: { authorization: 'Bearer good' } };
    const res = makeRes();
    const next = makeNext();
    jwt.verify.mockReturnValue({ sub: 'u1' });
    const populateStub = jest.fn().mockResolvedValue(user);
    const selectStub = jest.fn().mockReturnValue({ populate: populateStub });
    User.findById.mockReturnValue({ select: selectStub });

    await authenticate(req, res, next);

    const err = next.mock.calls[0][0];
    expect(err.status).toBe(403);
    expect(err.message).toBe('User is inactive');
  });
});

describe('middleware/auth.authorize', () => {
  it('requires authentication', () => {
    const req = {};
    const res = makeRes();
    const next = makeNext();

    authorize({ roles: ['admin'] })(req, res, next);

    const err = next.mock.calls[0][0];
    expect(err.status).toBe(401);
  });

  it('rejects when role not allowed', () => {
    const req = { user: { role: { name: 'borrower', slug: 'borrower', capabilities: [] } } };
    const res = makeRes();
    const next = makeNext();

    authorize({ roles: ['admin'] })(req, res, next);

    const err = next.mock.calls[0][0];
    expect(err.status).toBe(403);
    expect(err.message).toBe('Forbidden');
  });

  it('passes when role allowed', () => {
    const req = { user: { role: { name: 'admin', slug: 'admin', capabilities: [] } } };
    const res = makeRes();
    const next = makeNext();

    authorize({ roles: ['admin'] })(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('passes when capability allowed', () => {
    const capObj = { name: 'loan:read:self' };
    const req = { user: { role: { name: 'borrower', slug: 'borrower', capabilities: [capObj] } } };
    const res = makeRes();
    const next = makeNext();

    authorize({ capabilities: ['loan:read:self'] })(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('rejects when capability missing', () => {
    const req = { user: { role: { name: 'borrower', slug: 'borrower', capabilities: [] } } };
    const res = makeRes();
    const next = makeNext();

    authorize({ capabilities: ['rates:lock'] })(req, res, next);

    const err = next.mock.calls[0][0];
    expect(err.status).toBe(403);
    expect(err.message).toBe('Insufficient permissions');
  });
});

