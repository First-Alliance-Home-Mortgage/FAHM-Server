jest.mock('../../src/services/blendPOSService', () => ({
  verifyWebhookSignature: jest.fn(),
  processWebhookEvent: jest.fn().mockResolvedValue({ shouldSyncCRM: false, shouldSyncEncompass: false }),
}));

jest.mock('../../src/services/bigPOSService', () => ({
  verifyWebhookSignature: jest.fn(),
  processWebhookEvent: jest.fn().mockResolvedValue({ shouldSyncCRM: false, shouldSyncEncompass: false }),
}));

jest.mock('../../src/models/LoanApplication');
jest.mock('../../src/models/User');

const createError = require('http-errors');
const posController = require('../../src/controllers/posController');
const blendPOSService = require('../../src/services/blendPOSService');
const bigPOSService = require('../../src/services/bigPOSService');

const makeRes = () => {
  const res = { json: jest.fn().mockReturnValue(this), status: jest.fn().mockReturnValue(this) };
  res.status.mockImplementation((code) => {
    res.statusCode = code;
    return res;
  });
  return res;
};

describe('posController webhooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects Blend webhook without signature', async () => {
    const req = { get: jest.fn().mockReturnValue(undefined), body: {} };
    const res = makeRes();
    const next = jest.fn();

    await posController.handleBlendWebhook(req, res, next);

    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(401);
    expect(blendPOSService.processWebhookEvent).not.toHaveBeenCalled();
  });

  it('processes Blend webhook when signature valid', async () => {
    blendPOSService.verifyWebhookSignature.mockReturnValue(true);
    const req = { get: jest.fn().mockReturnValue('sig'), body: { eventType: 'application.submitted' } };
    const res = makeRes();
    const next = jest.fn();

    await posController.handleBlendWebhook(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ success: true, processed: true });
  });

  it('rejects Big POS webhook without signature', async () => {
    const req = { get: jest.fn().mockReturnValue(undefined), body: {} };
    const res = makeRes();
    const next = jest.fn();

    await posController.handleBigPOSWebhook(req, res, next);

    const err = next.mock.calls[0][0];
    expect(err.status).toBe(401);
    expect(bigPOSService.processWebhookEvent).not.toHaveBeenCalled();
  });
});
