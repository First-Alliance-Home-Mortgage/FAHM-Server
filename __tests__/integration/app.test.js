const request = require('supertest');
const app = require('../../src/app');

describe('app integration', () => {
  it('responds to health check', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('returns JSON 404 with error details for unknown routes', async () => {
    const res = await request(app).get('/unknown-path');

    expect(res.status).toBe(404);
    expect(res.body.message).toContain('Not Found - /unknown-path');
    expect(res.body.stack).toBeDefined();
  });
});

