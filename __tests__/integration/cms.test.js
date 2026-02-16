const request = require('supertest');
const app = require('../../src/app');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { jwtSecret } = require('../../src/config/env');
const User = require('../../src/models/User');

const Screen = require('../../src/models/Screen');
const NavigationConfig = require('../../src/models/NavigationConfig');
const FeatureFlag = require('../../src/models/FeatureFlag');
const ComponentRegistryItem = require('../../src/models/ComponentRegistryItem');

describe('CMS API integration', () => {
  let adminToken;

  beforeAll(() => {
    const admin = {
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

  it('lists screens', async () => {
    const screens = [{ slug: 'dashboard', title: 'Dashboard' }];
    jest.spyOn(Screen, 'find').mockReturnValue({ lean: jest.fn().mockResolvedValue(screens) });
    const res = await request(app)
      .get('/api/v1/cms/screens')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(screens);
  });

  it('creates a screen', async () => {
    const payload = {
      slug: 'dashboard',
      title: 'Dashboard',
      route: '/dashboard',
      navigation: { type: 'tab', icon: 'home', order: 1 },
    };
    const created = { _id: 's1', ...payload, roles: [], tenant_scope: [], components: [], status: 'draft', version: 1 };
    jest.spyOn(Screen, 'create').mockResolvedValue({ toObject: () => created });
    const res = await request(app)
      .post('/api/v1/cms/screens')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);
    expect(res.statusCode).toBe(201);
    expect(res.body.slug).toBe('dashboard');
  });

  it('publishes a screen', async () => {
    const screenDoc = {
      toObject: () => ({ slug: 'dashboard', status: 'published', version: 2 }),
      save: jest.fn().mockResolvedValue(),
      status: 'draft',
      version: 1,
    };
    jest.spyOn(Screen, 'findOne').mockResolvedValue(screenDoc);
    const res = await request(app)
      .post('/api/v1/cms/screens/dashboard/publish')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('published');
  });

  it('upserts navigation configs', async () => {
    const updated = { type: 'drawer', role: 'admin', items: [{ screen_slug: 'dashboard', order: 1 }] };
    jest.spyOn(NavigationConfig, 'findOneAndUpdate').mockResolvedValue({ toObject: () => updated });
    const res = await request(app)
      .put('/api/v1/cms/navigation-configs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send([updated]);
    expect(res.statusCode).toBe(200);
    expect(res.body[0].role).toBe('admin');
  });

  it('upserts feature flags', async () => {
    const updated = { key: 'new_ui', enabled: true, roles: ['admin'], min_app_version: '1.0.0' };
    jest.spyOn(FeatureFlag, 'findOneAndUpdate').mockResolvedValue({ toObject: () => updated });
    const res = await request(app)
      .put('/api/v1/cms/feature-flags')
      .set('Authorization', `Bearer ${adminToken}`)
      .send([updated]);
    expect(res.statusCode).toBe(200);
    expect(res.body[0].key).toBe('new_ui');
  });

  it('toggles a feature flag', async () => {
    const flagDoc = { toObject: () => ({ key: 'new_ui', enabled: false }), save: jest.fn().mockResolvedValue(), enabled: true };
    jest.spyOn(FeatureFlag, 'findOne').mockResolvedValue(flagDoc);
    const res = await request(app)
      .patch('/api/v1/cms/feature-flags/new_ui')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ enabled: false });
    expect(res.statusCode).toBe(200);
    expect(res.body.enabled).toBe(false);
  });

  it('lists component registry', async () => {
    const items = [{ type: 'button', status: 'active' }];
    jest.spyOn(ComponentRegistryItem, 'find').mockReturnValue({ lean: jest.fn().mockResolvedValue(items) });
    const res = await request(app)
      .get('/api/v1/cms/component-registry')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body[0].type).toBe('button');
  });
});
