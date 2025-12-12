jest.mock('../../src/models/AuditLog');

const AuditLog = require('../../src/models/AuditLog');
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

  it('swallows errors and logs to console', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    AuditLog.create.mockRejectedValue(new Error('db down'));

    await audit({ action: 'test.action' });

    expect(consoleSpy).toHaveBeenCalledWith('audit log failed', 'db down');
    consoleSpy.mockRestore();
  });
});

