const request = require('supertest');
const app = require('../../src/app');
const mongoose = require('mongoose');
const User = require('../../src/models/User');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { jwtSecret } = require('../../src/config/env');

describe('POST /api/v1/users/profile-picture', () => {
  let user;
  let token;

  beforeAll(async () => {
    user = await User.create({
      name: 'Test User',
      email: 'testuser@example.com',
      password: 'Password123!',
      isActive: true,
    });
    token = jwt.sign({ sub: user._id }, jwtSecret, { expiresIn: '1h' });
  });

  afterAll(async () => {
    await User.deleteMany({ email: 'testuser@example.com' });
    await mongoose.connection.close();
  });

  it('should upload a profile picture and update user', async () => {
    const imagePath = path.join(__dirname, '../fixtures/test-profile.jpg');
    const res = await request(app)
      .post('/api/v1/users/profile-picture')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', imagePath);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.photoUrl).toMatch(/^https?:\/\//);
    expect(res.body.user.photo).toBe(res.body.photoUrl);
  });

  it('should reject non-image files', async () => {
    const filePath = path.join(__dirname, '../fixtures/test.txt');
    const res = await request(app)
      .post('/api/v1/users/profile-picture')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', filePath);
    expect(res.statusCode).toBe(400);
  });
});
