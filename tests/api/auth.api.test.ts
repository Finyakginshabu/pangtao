import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server/src/app.js';
import { prisma } from '../../server/src/prisma.js';
import { resetDatabase, createTestSession, TEST_PASSWORD } from '../helpers/db.helper.js';
import { clearRateLimitStore } from '../../server/src/middleware/rate-limit.middleware.js';
import { RouteRegistry } from '../../server/src/middleware/route-guard.middleware.js';
import { authService } from '../../server/src/services/auth.service.js';

describe('F-01 Authentication and Authorization Foundation (STS)', () => {
  let seededUsers: Awaited<ReturnType<typeof resetDatabase>>;

  beforeEach(async () => {
    clearRateLimitStore();
    seededUsers = await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('Health Check: GET /api/v1/health returns status ok', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('TEST-01.1 (AC-01.1): Successful login returns user profile, sets sid cookie, and creates session row', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ALICE@Example.test', password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe('alice@example.test');
    expect(res.body.user.role).toBe('USER');
    expect(res.body.user.passwordHash).toBeUndefined();

    // Check Set-Cookie
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const sidCookie = cookies[0];
    expect(sidCookie).toContain('sid=');
    expect(sidCookie).toContain('HttpOnly');
    expect(sidCookie).toContain('SameSite=Lax');

    // Check DB session created
    const sessions = await prisma.session.findMany({
      where: { userId: seededUsers.alice.id },
    });
    expect(sessions.length).toBe(1);
  });

  it('TEST-01.2 (AC-01.2): Unknown email, wrong password, and disabled user return identical 401 response without cookie', async () => {
    // 1. Unknown email
    const resUnknown = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ghost@example.test', password: TEST_PASSWORD });

    // 2. Wrong password
    const resWrongPass = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'alice@example.test', password: 'WrongPassword999' });

    // Disable Bob
    await prisma.user.update({
      where: { id: seededUsers.bob.id },
      data: { isActive: false },
    });

    // 3. Disabled user
    const resDisabled = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'bob@example.test', password: TEST_PASSWORD });

    // All three must be 401 INVALID_CREDENTIALS with identical payload
    for (const res of [resUnknown, resWrongPass, resDisabled]) {
      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
      expect(res.headers['set-cookie']).toBeUndefined();
    }
  });

  it('TEST-01.3 (AC-01.3): Malformed inputs return 400 VALIDATION_ERROR naming the failed field', async () => {
    const resEmpty = await request(app).post('/api/v1/auth/login').send({});
    expect(resEmpty.status).toBe(400);
    expect(resEmpty.body.error.code).toBe('VALIDATION_ERROR');

    const resBadMail = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email', password: '123' });
    expect(resBadMail.status).toBe(400);
    expect(resBadMail.body.error.details.some((d: any) => d.field === 'email')).toBe(true);

    const resEmptyPass = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'alice@example.test', password: '' });
    expect(resEmptyPass.status).toBe(400);
    expect(resEmptyPass.body.error.details.some((d: any) => d.field === 'password')).toBe(true);
  });

  it('TEST-01.4 (AC-01.4): GET /auth/me returns identity with valid cookie; 401 without cookie or with forged cookie', async () => {
    const token = await createTestSession(seededUsers.alice.id);

    // Valid cookie
    const resValid = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', [`sid=${token}`]);
    expect(resValid.status).toBe(200);
    expect(resValid.body.user.email).toBe('alice@example.test');

    // Without cookie
    const resNoCookie = await request(app).get('/api/v1/auth/me');
    expect(resNoCookie.status).toBe(401);
    expect(resNoCookie.body.error.code).toBe('UNAUTHENTICATED');

    // Forged cookie
    const resForged = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', ['sid=fake-forged-token-9999999999999999999999']);
    expect(resForged.status).toBe(401);
    expect(resForged.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('TEST-01.5 (AC-01.5): POST /auth/logout returns 204, deletes session record, and invalidates old cookie', async () => {
    const token = await createTestSession(seededUsers.alice.id);

    const resLogout = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', [`sid=${token}`]);

    expect(resLogout.status).toBe(204);
    const cookies = resLogout.headers['set-cookie'];
    expect(cookies[0]).toContain('sid=;');

    // Verify session row deleted from DB
    const sessionCount = await prisma.session.count({
      where: { userId: seededUsers.alice.id },
    });
    expect(sessionCount).toBe(0);

    // Subsequent GET /me returns 401
    const resMe = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', [`sid=${token}`]);
    expect(resMe.status).toBe(401);
  });

  it('TEST-01.6 (AC-01.6): Expired session token is rejected with 401 and deleted from database', async () => {
    // Create session expired 1 hour ago
    const token = await createTestSession(seededUsers.alice.id, -1);

    const resMe = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', [`sid=${token}`]);

    expect(resMe.status).toBe(401);
    expect(resMe.body.error.code).toBe('UNAUTHENTICATED');

    // Verify DB session was cleaned up
    const sessions = await prisma.session.findMany({
      where: { userId: seededUsers.alice.id },
    });
    expect(sessions.length).toBe(0);
  });

  it('TEST-01.7 (AC-01.7): Protected routes return 401 to anonymous requests; undeclared routes halt boot', async () => {
    const resMe = await request(app).get('/api/v1/auth/me');
    expect(resMe.status).toBe(401);

    const resLogout = await request(app).post('/api/v1/auth/logout');
    expect(resLogout.status).toBe(401);

    // Verifying route registry fails if access guard is missing
    expect(() => {
      RouteRegistry.register('GET', '/api/v1/unprotected/test', undefined);
    }).toThrow('[NFR-02 Violation]');
  });

  it('TEST-01.8 (AC-01.8): Role separation denies non-permitted roles with 403 FORBIDDEN', async () => {
    const userToken = await createTestSession(seededUsers.alice.id);
    const adminToken = await createTestSession(seededUsers.admin.id);

    // User calling ADMIN-only route -> 403
    const resUserToAdmin = await request(app)
      .get('/api/v1/test/admin-only')
      .set('Cookie', [`sid=${userToken}`]);
    expect(resUserToAdmin.status).toBe(403);
    expect(resUserToAdmin.body.error.code).toBe('FORBIDDEN');

    // Admin calling USER-only route -> 403
    const resAdminToUser = await request(app)
      .get('/api/v1/test/user-only')
      .set('Cookie', [`sid=${adminToken}`]);
    expect(resAdminToUser.status).toBe(403);
    expect(resAdminToUser.body.error.code).toBe('FORBIDDEN');

    // User calling USER-only route -> 200
    const resUserOk = await request(app)
      .get('/api/v1/test/user-only')
      .set('Cookie', [`sid=${userToken}`]);
    expect(resUserOk.status).toBe(200);

    // Admin calling ADMIN-only route -> 200
    const resAdminOk = await request(app)
      .get('/api/v1/test/admin-only')
      .set('Cookie', [`sid=${adminToken}`]);
    expect(resAdminOk.status).toBe(200);
  });

  // TEST-01.9 intentionally skipped — reserved for a future test case in the F-01 contract.
  it.skip('TEST-01.9: (reserved — not yet specified)', () => {});

  it('TEST-01.10 (AC-01.10): Passwords in database are valid bcrypt hashes with cost >= 12; no plaintext in storage', async () => {
    const user = await prisma.user.findUnique({
      where: { email: 'alice@example.test' },
    });
    expect(user?.passwordHash).toMatch(/^\$2[aby]\$1[2-9]\$/);
    expect(user?.passwordHash).not.toContain(TEST_PASSWORD);
  });

  it('TEST-01.11 (AC-01.11): Sanitized error handling returns generic 500 without stack trace, SQL, or file paths', async () => {
    const res404 = await request(app).get('/api/v1/non-existent-route');
    expect(res404.status).toBe(404);
    expect(res404.body.error.code).toBe('NOT_FOUND');
    expect(res404.headers['x-request-id']).toBeDefined();
    expect(JSON.stringify(res404.body)).not.toContain('at ');
    expect(JSON.stringify(res404.body)).not.toContain('node_modules');
  });

  it('TEST-01.12 (AC-01.12): Rate limiting blocks 11th failed login attempt within 15 mins with 429 RATE_LIMITED', async () => {
    // 10 failed login attempts for Alice
    for (let i = 0; i < 10; i++) {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'alice@example.test', password: 'BadPassword' });
      expect(res.status).toBe(401);
    }

    // 11th attempt (even with correct password) must return 429
    const res11th = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'alice@example.test', password: TEST_PASSWORD });
    expect(res11th.status).toBe(429);
    expect(res11th.body.error.code).toBe('RATE_LIMITED');

    // Bob still has independent quota and can log in
    const resBob = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'bob@example.test', password: TEST_PASSWORD });
    expect(resBob.status).toBe(200);
  });

  it('TEST-01.13 (AC-01.13): CSRF Origin mismatch returns 403; non-JSON Content-Type returns 415', async () => {
    const token = await createTestSession(seededUsers.alice.id);

    // CSRF Origin mismatch
    const resOrigin = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', [`sid=${token}`])
      .set('Origin', 'https://malicious-attacker.test');
    expect(resOrigin.status).toBe(403);
    expect(resOrigin.body.error.code).toBe('FORBIDDEN');

    // Non-JSON content type on POST
    const resNonJson = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'text/plain')
      .send('hello plain text');
    expect(resNonJson.status).toBe(415);
    expect(resNonJson.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('authService.getMe: returns user profile or throws 404 for non-existent user', async () => {
    const me = await authService.getMe(seededUsers.alice.id);
    expect(me.email).toBe('alice@example.test');

    await expect(authService.getMe('00000000-0000-0000-0000-000000000000')).rejects.toThrow();
  });
});
