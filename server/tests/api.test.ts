import request from 'supertest';
import { app } from '../src/index';
import { prisma } from '../src/prisma/client';

jest.setTimeout(10000);

describe('API Endpoints Smoke & Auth Tests', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('GET /health should return 200 and healthy status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  });

  it('POST /api/auth/admin/login with invalid code should return 401', async () => {
    const res = await request(app)
      .post('/api/auth/admin/login')
      .send({ code: 'WRONG_CODE' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/auth/admin/login with valid code should return 200 and JWT token', async () => {
    const res = await request(app)
      .post('/api/auth/admin/login')
      .send({ code: 'TPC-SUPER-2026' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
  });

  it('GET /api/sync/status should return sync stats', async () => {
    const res = await request(app).get('/api/sync/status');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('pending');
  });
});
