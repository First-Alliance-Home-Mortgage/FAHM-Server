const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../src/app');
const User = require('../src/models/User');
const LoanApplication = require('../src/models/LoanApplication');
const AuditLog = require('../src/models/AuditLog');
const tokenService = require('../src/services/tokenService');
const defaults = require('../src/config/defaults');

describe('Phase 1 endpoints', () => {
  let mongo;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'testsecret';
    mongo = await MongoMemoryServer.create();
    const uri = mongo.getUri();
    await mongoose.connect(uri);
  });

  afterEach(async () => {
    await mongoose.connection.db.dropDatabase();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  const makeUserAndToken = async (role = 'borrower') => {
    const user = await User.create({
      name: `${role}-user`,
      email: `${role}@example.com`,
      password: 'password123',
      role,
    });
    const token = tokenService.sign(user);
    return { user, token };
  };

  const auth = (token) => ({ Authorization: `Bearer ${token}` });

  describe('Documents', () => {
    test('rejects unsupported type and missing hash/size over limit', async () => {
      const { user, token } = await makeUserAndToken();
      const loan = await LoanApplication.create({ borrower: user._id, amount: 200000 });

      const resBadType = await request(app)
        .post('/api/v1/documents')
        .set(auth(token))
        .send({ loan: loan._id, name: 'doc', type: 'exe', url: 'http://x', size: 1000, hash: 'abc' });
      expect(resBadType.status).toBe(400);

      const resNoHash = await request(app)
        .post('/api/v1/documents')
        .set(auth(token))
        .send({ loan: loan._id, name: 'doc', type: 'pdf', url: 'http://x', size: 1000 });
      expect(resNoHash.status).toBe(400);

      const resTooBig = await request(app)
        .post('/api/v1/documents')
        .set(auth(token))
        .send({
          loan: loan._id,
          name: 'doc',
          type: 'pdf',
          url: 'http://x',
          size: defaults.upload.maxSizeBytes + 1,
          hash: 'abc',
        });
      expect(resTooBig.status).toBe(400);
    });

    test('deduplicates by hash per loan', async () => {
      const { user, token } = await makeUserAndToken();
      const loan = await LoanApplication.create({ borrower: user._id, amount: 200000 });

      const payload = {
        loan: loan._id,
        name: 'doc1',
        type: 'pdf',
        url: 'http://x/doc1.pdf',
        size: 1024,
        hash: 'hash-1',
      };

      const first = await request(app).post('/api/v1/documents').set(auth(token)).send(payload);
      expect(first.status).toBe(201);

      const dup = await request(app).post('/api/v1/documents').set(auth(token)).send(payload);
      expect(dup.status).toBe(409);
    });

    test('creates audit log on upload', async () => {
      const { user, token } = await makeUserAndToken();
      const loan = await LoanApplication.create({ borrower: user._id, amount: 200000 });
      const payload = {
        loan: loan._id,
        name: 'doc1',
        type: 'pdf',
        url: 'http://x/doc1.pdf',
        size: 1024,
        hash: 'hash-1',
      };
      const res = await request(app).post('/api/v1/documents').set(auth(token)).send(payload);
      expect(res.status).toBe(201);
      const auditCount = await AuditLog.countDocuments({ action: 'document.upload' });
      expect(auditCount).toBe(1);
    });
  });

  describe('Notifications', () => {
    test('quiet hours block send unless forceSend', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2024-01-01T22:00:00Z')); // 10pm UTC
      const { token } = await makeUserAndToken();
      const suppressed = await request(app)
        .post('/api/v1/notifications')
        .set(auth(token))
        .send({ title: 't1', body: 'b1' });
      expect(suppressed.status).toBe(429);

      const forced = await request(app)
        .post('/api/v1/notifications')
        .set(auth(token))
        .send({ title: 't2', body: 'b2', forceSend: true });
      expect(forced.status).toBe(201);
      jest.useRealTimers();
    });

    test('throttles after limit per 24h', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2024-01-02T12:00:00Z'));
      const { token } = await makeUserAndToken();
      const sends = [];
      for (let i = 0; i < defaults.notifications.throttlePerEventPerDay; i += 1) {
        sends.push(
          request(app)
            .post('/api/v1/notifications')
            .set(auth(token))
            .send({ title: `t${i}`, body: 'b' })
        );
      }
      const results = await Promise.all(sends);
      results.forEach((r) => expect(r.status).toBe(201));

      const blocked = await request(app)
        .post('/api/v1/notifications')
        .set(auth(token))
        .send({ title: 'overflow', body: 'b' });
      expect(blocked.status).toBe(429);
      jest.useRealTimers();
    });
  });

  describe('POS handoff', () => {
    test('rate limits handoff token mints', async () => {
      const { token } = await makeUserAndToken('loan_officer_retail');
      const attempts = [];
      for (let i = 0; i < defaults.pos.maxMintsPerMinute; i += 1) {
        attempts.push(
          request(app).post('/api/v1/pos/handoff').set(auth(token)).send({ loanId: '123' })
        );
      }
      const ok = await Promise.all(attempts);
      ok.forEach((r) => expect(r.status).toBe(200));
      const blocked = await request(app).post('/api/v1/pos/handoff').set(auth(token)).send({ loanId: '123' });
      expect(blocked.status).toBe(429);
    });
  });

  describe('Calculator', () => {
    test('computes monthly totals', async () => {
      const { token } = await makeUserAndToken();
      const res = await request(app)
        .post('/api/v1/calculator')
        .set(auth(token))
        .send({ amount: 300000, rate: 6, termYears: 30, taxesAnnual: 3600, insuranceAnnual: 1200, hoaMonthly: 50 });
      expect(res.status).toBe(200);
      expect(res.body.totalMonthly).toBeGreaterThan(0);
      expect(res.body.monthlyPrincipalAndInterest).toBeGreaterThan(0);
    });
  });
});

