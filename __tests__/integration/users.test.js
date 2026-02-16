const request = require('supertest');
const app = require('../../src/app');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { jwtSecret } = require('../../src/config/env');
const User = require('../../src/models/User');

describe('Users API integration', () => {
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

  it('updates current user profile', async () => {
    const updated = { ...admin, name: 'Admin User' };
    const populateStub = jest.fn().mockResolvedValue(updated);
    const selectStub = jest.fn().mockReturnValue({ populate: populateStub });
    jest.spyOn(User, 'findByIdAndUpdate').mockReturnValue({ select: selectStub });
    const res = await request(app)
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Admin User' });
    expect(res.statusCode).toBe(200);
    expect(res.body.user.name).toBe('Admin User');
  });

  it('lists users (admin)', async () => {
    jest.spyOn(User, 'countDocuments').mockResolvedValue(1);
    const chain = {
      select: function() { return this; },
      populate: function() { return this; },
      sort: function() { return this; },
      skip: function() { return this; },
      limit: jest.fn().mockResolvedValue([{ _id: 'u1' }]),
    };
    jest.spyOn(User, 'find').mockReturnValue(chain);
    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
  });

  it('creates a user (admin)', async () => {
    const payload = { name: 'John', email: 'john@example.com', password: 'secret123' };
    const created = { _id: 'u2', ...payload, populate: jest.fn().mockResolvedValue({ _id: 'u2', ...payload }) };
    jest.spyOn(User, 'findOne').mockResolvedValue(null);
    jest.spyOn(User, 'create').mockResolvedValue(created);
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);
    expect(res.statusCode).toBe(201);
    expect(res.body.user.email).toBe('john@example.com');
  });

  it('updates a user (admin)', async () => {
    const populateStub = jest.fn().mockResolvedValue({ _id: 'u2', name: 'Jane' });
    const selectStub = jest.fn().mockReturnValue({ populate: populateStub });
    jest.spyOn(User, 'findByIdAndUpdate').mockReturnValue({ select: selectStub });
    const res = await request(app)
      .patch('/api/v1/users/u2')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Jane' });
    expect(res.statusCode).toBe(200);
    expect(res.body.user.name).toBe('Jane');
  });

  it('soft deletes a user (admin)', async () => {
    jest.spyOn(User, 'findByIdAndUpdate').mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: 'u2', isActive: false }) });
    const res = await request(app)
      .delete('/api/v1/users/u2')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
