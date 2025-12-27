jest.mock('twilio', () => ({ validateRequest: jest.fn() }));
jest.mock('../../src/models/User');
jest.mock('../../src/models/LoanApplication');
jest.mock('../../src/models/SMSMessage', () => {
  return function SMSMessage(doc) {
    Object.assign(this, doc);
    this.save = jest.fn().mockResolvedValue(this);
    this.syncToEncompass = jest.fn().mockResolvedValue();
  };
});

const twilio = require('twilio');
const smsController = require('../../src/controllers/smsController');

const xmlOk = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

const makeRes = () => {
  const res = { headers: {}, statusCode: 200 };
  res.type = jest.fn().mockReturnValue(res);
  res.status = jest.fn().mockImplementation((code) => { res.statusCode = code; return res; });
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

describe('smsController Twilio webhooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TWILIO_AUTH_TOKEN = 'test-token';
  });

  it('rejects inbound webhook with invalid signature', async () => {
    twilio.validateRequest.mockReturnValue(false);
    const req = {
      protocol: 'https',
      get: jest.fn().mockReturnValue(undefined),
      originalUrl: '/api/v1/sms/webhook/receive',
      body: {},
    };
    const res = makeRes();

    await smsController.receiveWebhook(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send).toHaveBeenCalledWith(xmlOk);
  });

  it('accepts inbound webhook with valid signature', async () => {
    twilio.validateRequest.mockReturnValue(true);
    const req = {
      protocol: 'https',
      get: jest.fn().mockReturnValue('sig'),
      originalUrl: '/api/v1/sms/webhook/receive',
      body: { MessageSid: 'sid', From: '+1', To: '+2', Body: 'Hi' },
    };
    const res = makeRes();

    await smsController.receiveWebhook(req, res, jest.fn());

    expect(res.send).toHaveBeenCalledWith(xmlOk);
  });
});
