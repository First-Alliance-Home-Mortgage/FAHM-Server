jest.mock('../../src/models/User');
jest.mock('../../src/services/tokenService');
jest.mock('../../src/utils/audit', () => ({ audit: jest.fn() }));
jest.mock('express-validator', () => ({
  validationResult: jest.fn(),
}));

const createError = require('http-errors');
const User = require('../../src/models/User');
const tokenService = require('../../src/services/tokenService');
const { audit } = require('../../src/utils/audit');
const { validationResult } = require('express-validator');
const authController = require('../../src/controllers/authController');

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const makeNext = () => jest.fn();

describe('authController.register', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    validationResult.mockReturnValue({ isEmpty: () => true });
  });

  it('creates user and returns token', async () => {
    const req = {
      body: { name: 'Jane', email: 'j@e.com', password: 'pw12345', role: 'borrower', phone: '123' },
    };
    const res = makeRes();
    const next = makeNext();
    const createdUser = { _id: 'u1', name: 'Jane', email: 'j@e.com', role: 'borrower', phone: '123' };
    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue(createdUser);
    tokenService.sign.mockReturnValue('token123');

    await authController.register(req, res, next);

    expect(User.findOne).toHaveBeenCalledWith({ email: 'j@e.com' });
    expect(User.create).toHaveBeenCalled();
    expect(tokenService.sign).toHaveBeenCalledWith(createdUser);
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.register', entityId: 'u1' }),
      req,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      token: 'token123',
      user: { id: 'u1', name: 'Jane', email: 'j@e.com', role: 'borrower', phone: '123' },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 409 when email exists', async () => {
    const req = { body: { email: 'exists@example.com' } };
    const res = makeRes();
    const next = makeNext();
    User.findOne.mockResolvedValue({ _id: 'u1' });

    await authController.register(req, res, next);

    const err = next.mock.calls[0][0];
    expect(err.status).toBe(409);
    expect(err.message).toBe('Email already registered');
  });
});

describe('authController.login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    validationResult.mockReturnValue({ isEmpty: () => true });
  });

  it('returns token on successful login', async () => {
    const req = { body: { email: 'user@example.com', password: 'pw' } };
    const res = makeRes();
    const next = makeNext();
    const user = {
      _id: 'u1',
      name: 'User',
      email: 'user@example.com',
      role: 'borrower',
      comparePassword: jest.fn().mockResolvedValue(true),
    };

    const selectMock = jest.fn().mockResolvedValue(user);
    User.findOne.mockReturnValue({ select: selectMock });
    tokenService.sign.mockReturnValue('token456');

    await authController.login(req, res, next);

    expect(User.findOne).toHaveBeenCalledWith({ email: 'user@example.com' });
    expect(user.comparePassword).toHaveBeenCalledWith('pw');
    expect(res.json).toHaveBeenCalledWith({
      token: 'token456',
      user: { id: 'u1', name: 'User', email: 'user@example.com', role: 'borrower' },
    });
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.login', entityId: 'u1' }),
      req,
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects invalid credentials', async () => {
    const req = { body: { email: 'bad@example.com', password: 'pw' } };
    const res = makeRes();
    const next = makeNext();
    User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

    await authController.login(req, res, next);

    const err = next.mock.calls[0][0];
    expect(err.status).toBe(401);
    expect(err.message).toBe('Invalid credentials');
  });
});

