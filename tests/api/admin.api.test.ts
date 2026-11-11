import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server/src/app.js';
import { prisma } from '../../server/src/prisma.js';
import { resetDatabase, createTestSession, TEST_PASSWORD } from '../helpers/db.helper.js';
import { clearRateLimitStore } from '../../server/src/middleware/rate-limit.middleware.js';

// State-changing requests must carry an Origin (NFR-10); act as the Vite dev origin.
const TEST_ORIGIN = 'http://localhost:3000';
const get = (url: string) => request(app).get(url).set('Origin', TEST_ORIGIN);
const patch = (url: string) => request(app).patch(url).set('Origin', TEST_ORIGIN);
const post = (url: string) => request(app).post(url).set('Origin', TEST_ORIGIN);

// AC-02.1: the profile payload exposes these fields and nothing else.
const PROFILE_FIELDS = ['createdAt', 'displayName', 'email', 'id', 'isActive', 'role'];

describe('F-02 Admin User Management (STS)', () => {
  let seededUsers: Awaited<ReturnType<typeof resetDatabase>>;
  let adminToken: string;
  let aliceToken: string;

  beforeEach(async () => {
    clearRateLimitStore();
    seededUsers = await resetDatabase();
    adminToken = await createTestSession(seededUsers.admin.id);
    aliceToken = await createTestSession(seededUsers.alice.id);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('TEST-02.1 (AC-02.1): Admin lists all users with profile-only fields, ordered by display name', async () => {
    const res = await get('/api/v1/admin/users?limit=10&offset=0').set('Cookie', [`sid=${adminToken}`]);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.limit).toBe(10);
    expect(res.body.offset).toBe(0);
    expect(res.body.items.map((u: { email: string }) => u.email)).toEqual([
      'alice@example.test',
      'bob@example.test',
      'admin@example.test',
    ]);

    for (const item of res.body.items) {
      expect(Object.keys(item).sort()).toEqual(PROFILE_FIELDS);
    }

    // BR-02: no password hash and no financial data in the payload.
    for (const forbidden of ['passwordHash', 'balance', 'accounts', 'transactions']) {
      expect(res.text).not.toContain(forbidden);
    }
  });

  it('Contract §2.1: limit defaults to 50, is capped at 100, and rejects invalid pagination', async () => {
    const defaults = await get('/api/v1/admin/users').set('Cookie', [`sid=${adminToken}`]);
    expect(defaults.status).toBe(200);
    expect(defaults.body.limit).toBe(50);
    expect(defaults.body.offset).toBe(0);

    const tooLarge = await get('/api/v1/admin/users?limit=101').set('Cookie', [`sid=${adminToken}`]);
    expect(tooLarge.status).toBe(400);
    expect(tooLarge.body.error.code).toBe('VALIDATION_ERROR');

    const zero = await get('/api/v1/admin/users?limit=0').set('Cookie', [`sid=${adminToken}`]);
    expect(zero.status).toBe(400);
    expect(zero.body.error.code).toBe('VALIDATION_ERROR');

    const negativeOffset = await get('/api/v1/admin/users?offset=-1').set('Cookie', [`sid=${adminToken}`]);
    expect(negativeOffset.status).toBe(400);
    expect(negativeOffset.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('TEST-02.2 (AC-02.2): User callers receive 403 and anonymous callers 401 on every admin endpoint', async () => {
    const aliceGet = await get('/api/v1/admin/users').set('Cookie', [`sid=${aliceToken}`]);
    expect(aliceGet.status).toBe(403);
    expect(aliceGet.body.error.code).toBe('FORBIDDEN');

    const alicePatch = await patch(`/api/v1/admin/users/${seededUsers.bob.id}`)
      .set('Cookie', [`sid=${aliceToken}`])
      .send({ isActive: false });
    expect(alicePatch.status).toBe(403);
    expect(alicePatch.body.error.code).toBe('FORBIDDEN');

    const anonymousGet = await get('/api/v1/admin/users');
    expect(anonymousGet.status).toBe(401);
    expect(anonymousGet.body.error.code).toBe('UNAUTHENTICATED');

    const anonymousPatch = await patch(`/api/v1/admin/users/${seededUsers.bob.id}`).send({ isActive: false });
    expect(anonymousPatch.status).toBe(401);
    expect(anonymousPatch.body.error.code).toBe('UNAUTHENTICATED');

    // Zero modifications occurred.
    const bob = await prisma.user.findUnique({ where: { id: seededUsers.bob.id } });
    expect(bob?.isActive).toBe(true);
  });

  it('TEST-02.3 (AC-02.3): Disabling a user returns 200 and blocks subsequent login with 401 INVALID_CREDENTIALS', async () => {
    const res = await patch(`/api/v1/admin/users/${seededUsers.alice.id}`)
      .set('Cookie', [`sid=${adminToken}`])
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.user.isActive).toBe(false);
    expect(Object.keys(res.body.user).sort()).toEqual(PROFILE_FIELDS);

    const login = await post('/api/v1/auth/login').send({
      email: 'alice@example.test',
      password: TEST_PASSWORD,
    });
    expect(login.status).toBe(401);
    expect(login.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('TEST-02.4 (AC-02.4): Disabling a user purges all of their sessions in the same transaction; old cookies get 401', async () => {
    expect(await prisma.session.count({ where: { userId: seededUsers.alice.id } })).toBeGreaterThan(0);

    const res = await patch(`/api/v1/admin/users/${seededUsers.alice.id}`)
      .set('Cookie', [`sid=${adminToken}`])
      .send({ isActive: false });
    expect(res.status).toBe(200);

    expect(await prisma.session.count({ where: { userId: seededUsers.alice.id } })).toBe(0);

    const me = await request(app).get('/api/v1/auth/me').set('Cookie', [`sid=${aliceToken}`]);
    expect(me.status).toBe(401);
    expect(me.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('TEST-02.5 (AC-02.5): Re-enabling a disabled user restores login and session establishment', async () => {
    await patch(`/api/v1/admin/users/${seededUsers.alice.id}`)
      .set('Cookie', [`sid=${adminToken}`])
      .send({ isActive: false });

    const res = await patch(`/api/v1/admin/users/${seededUsers.alice.id}`)
      .set('Cookie', [`sid=${adminToken}`])
      .send({ isActive: true });
    expect(res.status).toBe(200);
    expect(res.body.user.isActive).toBe(true);

    const login = await post('/api/v1/auth/login').send({
      email: 'alice@example.test',
      password: TEST_PASSWORD,
    });
    expect(login.status).toBe(200);
    expect(login.headers['set-cookie']?.[0]).toContain('sid=');
  });

  it('TEST-02.6 (AC-02.6): An Administrator cannot disable their own account (409 CANNOT_DISABLE_SELF)', async () => {
    const res = await patch(`/api/v1/admin/users/${seededUsers.admin.id}`)
      .set('Cookie', [`sid=${adminToken}`])
      .send({ isActive: false });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CANNOT_DISABLE_SELF');

    const admin = await prisma.user.findUnique({ where: { id: seededUsers.admin.id } });
    expect(admin?.isActive).toBe(true);

    // The Administrator remains authenticated.
    const me = await request(app).get('/api/v1/auth/me').set('Cookie', [`sid=${adminToken}`]);
    expect(me.status).toBe(200);
  });

  it('TEST-02.7 (AC-02.7): Missing users are 404; malformed UUIDs and invalid payloads are 400 VALIDATION_ERROR', async () => {
    const missing = await patch('/api/v1/admin/users/9f8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d')
      .set('Cookie', [`sid=${adminToken}`])
      .send({ isActive: false });
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');

    const malformed = await patch('/api/v1/admin/users/abc-123')
      .set('Cookie', [`sid=${adminToken}`])
      .send({ isActive: false });
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe('VALIDATION_ERROR');

    const wrongType = await patch(`/api/v1/admin/users/${seededUsers.bob.id}`)
      .set('Cookie', [`sid=${adminToken}`])
      .send({ isActive: 'no' });
    expect(wrongType.status).toBe(400);
    expect(wrongType.body.error.code).toBe('VALIDATION_ERROR');

    const unexpectedField = await patch(`/api/v1/admin/users/${seededUsers.bob.id}`)
      .set('Cookie', [`sid=${adminToken}`])
      .send({ isActive: false, role: 'ADMIN' });
    expect(unexpectedField.status).toBe(400);
    expect(unexpectedField.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('Contract §2.1: a non-JSON Content-Type on PATCH returns 415 UNSUPPORTED_MEDIA_TYPE', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/users/${seededUsers.bob.id}`)
      .set('Cookie', [`sid=${adminToken}`])
      .set('Origin', TEST_ORIGIN)
      .set('Content-Type', 'text/plain')
      .send('{"isActive":false}');

    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('TEST-02.9 (AC-02.9): Disabling twice and re-enabling an active user are idempotent', async () => {
    const first = await patch(`/api/v1/admin/users/${seededUsers.bob.id}`)
      .set('Cookie', [`sid=${adminToken}`])
      .send({ isActive: false });
    expect(first.status).toBe(200);
    expect(first.body.user.isActive).toBe(false);

    const second = await patch(`/api/v1/admin/users/${seededUsers.bob.id}`)
      .set('Cookie', [`sid=${adminToken}`])
      .send({ isActive: false });
    expect(second.status).toBe(200);
    expect(second.body.user.isActive).toBe(false);
    expect(await prisma.session.count({ where: { userId: seededUsers.bob.id } })).toBe(0);

    const reEnableActive = await patch(`/api/v1/admin/users/${seededUsers.alice.id}`)
      .set('Cookie', [`sid=${adminToken}`])
      .send({ isActive: true });
    expect(reEnableActive.status).toBe(200);
    expect(reEnableActive.body.user.isActive).toBe(true);
  });
});
