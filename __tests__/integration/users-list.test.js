const request = require('supertest');
const app = require('../../src/app');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { jwtSecret } = require('../../src/config/env');
const User = require('../../src/models/User');

describe('Users list filters/pagination', () => {
  let adminToken;
  let admin;

  beforeAll(() => {
    admin = {
      _id: new mongoose.Types.ObjectId(),
      role: { name: 'admin', slug: 'admin', capabilities: [] },
      isActive: true,
    };
    const populateStub = jest.fn().mockResolvedValue(admin);
    const selectStub = jest.fn().mockReturnValue({ populate: populateStub });
    jest.spyOn(User, 'findById').mockReturnValue({ select: selectStub });
    adminToken = jwt.sign({ sub: admin._id }, jwtSecret, { expiresIn: '1h' });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('returns paginated users with filters applied', async () => {
    jest.spyOn(User, 'countDocuments').mockResolvedValue(42);
    const chain = {
      select: function() { return this; },
      populate: function() { return this; },
      sort: function() { return this; },
      skip: function() { return this; },
      limit: jest.fn().mockResolvedValue([{ _id: 'u1', name: 'Alice' }]),
    };
    jest.spyOn(User, 'find').mockReturnValue(chain);

    const res = await request(app)
      .get('/api/v1/users?role=borrower&active=true&q=ali&page=2&limit=10&sort=-createdAt')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.page).toBe(2);
    expect(res.body.pageSize).toBe(10);
    expect(res.body.total).toBe(42);
    expect(res.body.users.length).toBeGreaterThan(0);
  });
});
