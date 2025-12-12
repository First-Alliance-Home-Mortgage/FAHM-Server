jest.mock('jsonwebtoken');

const jwt = require('jsonwebtoken');
const tokenService = require('../../src/services/tokenService');

describe('tokenService.sign', () => {
  const user = { _id: 'user123', role: 'admin', email: 'a@b.com' };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  it('signs JWT with expected payload and options', () => {
    jwt.sign.mockReturnValue('signed-token');

    const token = tokenService.sign(user);

    expect(jwt.sign).toHaveBeenCalledWith(
      {
        sub: 'user123',
        role: 'admin',
        email: 'a@b.com',
      },
      expect.any(String),
      { expiresIn: '12h' },
    );
    expect(token).toBe('signed-token');
  });
});

