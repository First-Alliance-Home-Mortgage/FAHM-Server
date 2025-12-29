jest.mock('../../src/models/AuditLog');

const AuditLog = require('../../src/models/AuditLog');
const logger = require('../../src/utils/logger');
const { audit } = require('../../src/utils/audit');

describe('utils/audit', () => {
  const req = {
    user: { _id: 'user1' },
    ip: '1.2.3.4',
    headers: { 'user-agent': 'jest' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('persists audit entry with request context', async () => {
    AuditLog.create.mockResolvedValue({});

    await audit({ action: 'test.action', entityId: '123', metadata: { foo: 'bar' } }, req);

    expect(AuditLog.create).toHaveBeenCalledWith({
      action: 'test.action',
      entityType: undefined,
      entityId: '123',
      status: 'success',
      metadata: { foo: 'bar' },
      user: 'user1',
      ip: '1.2.3.4',
      userAgent: 'jest',
    });
  });

  it('swallows errors and logs a warning', async () => {
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    AuditLog.create.mockRejectedValue(new Error('db down'));

    await audit({ action: 'test.action' });

    expect(warnSpy).toHaveBeenCalledWith(
      'audit log failed',
      expect.objectContaining({ action: 'test.action', err: expect.any(Error) }),
    );
    warnSpy.mockRestore();
  });
});

