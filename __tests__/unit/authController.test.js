jest.mock('../../src/models/User');
jest.mock('../../src/services/tokenService');
jest.mock('../../src/utils/audit', () => ({ audit: jest.fn() }));
jest.mock('express-validator', () => ({
  validationResult: jest.fn(),
}));
jest.mock('../../src/services/refreshTokenService');

// ...existing code...
const User = require('../../src/models/User');
const tokenService = require('../../src/services/tokenService');
const refreshTokenService = require('../../src/services/refreshTokenService');
const { audit } = require('../../src/utils/audit');
const { validationResult } = require('express-validator');
const authController = require('../../src/controllers/authController');

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

const makeNext = () => jest.fn();

describe('authController.register', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    validationResult.mockReturnValue({ isEmpty: () => true });
    refreshTokenService.createToken.mockResolvedValue({ token: 'refresh123' });
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
    expect(refreshTokenService.createToken).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1' })
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      token: 'token123',
      refreshToken: 'refresh123',
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
    refreshTokenService.createToken.mockResolvedValue({ token: 'refresh456' });
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
    expect(refreshTokenService.createToken).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1' })
    );
    expect(res.json).toHaveBeenCalledWith({
      token: 'token456',
      refreshToken: 'refresh456',
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

describe('authController.refresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    validationResult.mockReturnValue({ isEmpty: () => true });
  });

  it('rotates refresh token and returns new tokens', async () => {
    const req = { body: { refreshToken: 'oldToken' } };
    const res = makeRes();
    const next = makeNext();
    refreshTokenService.rotateToken.mockResolvedValue({ userId: 'u1', refreshToken: 'newRefresh' });
    User.findById.mockResolvedValue({ _id: 'u1', role: 'borrower', email: 'user@example.com', name: 'User' });
    tokenService.sign.mockReturnValue('newAccess');

    await authController.refresh(req, res, next);

    expect(refreshTokenService.rotateToken).toHaveBeenCalledWith(
      expect.objectContaining({ tokenValue: 'oldToken' })
    );
    expect(User.findById).toHaveBeenCalledWith('u1');
    expect(res.json).toHaveBeenCalledWith({ token: 'newAccess', refreshToken: 'newRefresh' });
    expect(next).not.toHaveBeenCalled();
  });
});

describe('authController.logout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    validationResult.mockReturnValue({ isEmpty: () => true });
  });

  it('revokes provided refresh token and returns 204', async () => {
    const req = {
      user: { _id: 'user123' },
      body: { refreshToken: 'tokenABC' },
      headers: { 'user-agent': 'jest' },
    };
    const res = makeRes();
    const next = makeNext();
    refreshTokenService.revokeToken.mockResolvedValue({ user: 'user123' });

    await authController.logout(req, res, next);

    expect(refreshTokenService.revokeToken).toHaveBeenCalledWith(
      'tokenABC',
      'user_logout',
      expect.any(Object)
    );
    expect(refreshTokenService.revokeTokensForUser).not.toHaveBeenCalled();
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.logout', entityId: 'user123' }),
      req,
    );
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('revokes all tokens for user when none provided', async () => {
    const req = { user: { _id: 'user123' }, body: {}, headers: {} };
    const res = makeRes();
    const next = makeNext();

    await authController.logout(req, res, next);

    expect(refreshTokenService.revokeTokensForUser).toHaveBeenCalledWith('user123', 'user_logout_all');
    expect(res.status).toHaveBeenCalledWith(204);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for invalid refresh token', async () => {
    const req = {
      user: { _id: 'user123' },
      body: { refreshToken: 'badToken' },
      headers: {},
    };
    const res = makeRes();
    const next = makeNext();
    refreshTokenService.revokeToken.mockResolvedValue(null);

    await authController.logout(req, res, next);

    const err = next.mock.calls[0][0];
    expect(err.status).toBe(401);
    expect(err.message).toBe('Invalid refresh token');
  });

  it('requires authentication', async () => {
    const req = { body: {}, headers: {} };
    const res = makeRes();
    const next = makeNext();

    await authController.logout(req, res, next);

    const err = next.mock.calls[0][0];
    expect(err.status).toBe(401);
    expect(err.message).toBe('Authentication required');
  });
});

