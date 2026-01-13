const request = require('supertest');
const app = require('../../src/app');
const mongoose = require('mongoose');
const User = require('../../src/models/User');
const jwt = require('jsonwebtoken');
// ...existing code...
const path = require('path');
const { jwtSecret } = require('../../src/config/env');

// Mock Azure Blob uploads to avoid external dependency during tests
jest.mock('../../src/services/azureBlobService', () => ({
  uploadFile: jest.fn().mockResolvedValue({ blobUrl: 'https://example.com/test-photo.jpg' }),
}));

describe('POST /api/v1/users/profile-picture', () => {
  let user;
  let token;

  beforeAll(async () => {
    // Create a fake user object without hitting the database
    user = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Test User',
      email: 'testuser@example.com',
      isActive: true,
      role: 'borrower',
      photo: null,
    };

    // Stub User model methods used by auth and controller
    jest.spyOn(User, 'findById').mockReturnValue({
      select: () => Promise.resolve(user),
    });
    jest
      .spyOn(User, 'findByIdAndUpdate')
      .mockImplementation((_id, update) => Promise.resolve({ ...user, photo: update.photo }));

    token = jwt.sign({ sub: user._id }, jwtSecret, { expiresIn: '1h' });
  });

  afterAll(async () => {
    jest.restoreAllMocks();
  });

  it('should upload a profile picture and update user', async () => {
    const jpegBuffer = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
      0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
      0x00, 0x01, 0x00, 0x00, 0xff, 0xd9
    ]);
    const res = await request(app)
      .post('/api/v1/users/profile-picture')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', jpegBuffer, 'test.jpg');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.photoUrl).toMatch(/^https?:\/\//);
    expect(res.body.user.photo).toBe(res.body.photoUrl);
  });

  it('should reject non-image files', async () => {
    const txtBuffer = Buffer.from('plain text content', 'utf8');
    const res = await request(app)
      .post('/api/v1/users/profile-picture')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', txtBuffer, 'test.txt');
    expect(res.statusCode).toBe(400);
  });
});
