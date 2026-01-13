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
      role: 'admin',
      isActive: true,
    };
    jest.spyOn(User, 'findById').mockReturnValue({ select: jest.fn().mockResolvedValue(admin) });
    adminToken = jwt.sign({ sub: admin._id }, jwtSecret, { expiresIn: '1h' });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('updates current user profile', async () => {
    const updated = { ...admin, name: 'Admin User' };
    jest.spyOn(User, 'findByIdAndUpdate').mockReturnValue({ select: jest.fn().mockResolvedValue(updated) });
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
      sort: function() { return this; },
      skip: function() { return this; },
      limit: function() { return this; },
      lean: jest.fn().mockResolvedValue([{ _id: 'u1' }]),
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
    jest.spyOn(User, 'findOne').mockResolvedValue(null);
    jest.spyOn(User, 'create').mockResolvedValue({ _id: 'u2', ...payload });
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);
    expect(res.statusCode).toBe(201);
    expect(res.body.user.email).toBe('john@example.com');
  });

  it('updates a user (admin)', async () => {
    jest.spyOn(User, 'findByIdAndUpdate').mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: 'u2', name: 'Jane' }) });
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
