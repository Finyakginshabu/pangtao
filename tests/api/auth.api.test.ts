import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { app, createApp } from '../../server/src/app.js';
import { prisma } from '../../server/src/prisma.js';
import { resetDatabase, createTestSession, TEST_PASSWORD } from '../helpers/db.helper.js';
import { clearRateLimitStore } from '../../server/src/middleware/rate-limit.middleware.js';
import {
  access,
  assertRoutesGuarded,
  getDeclaredRoutes,
  mountRouter,
} from '../../server/src/middleware/route-guard.middleware.js';
import { authService } from '../../server/src/services/auth.service.js';

// State-changing requests must carry an Origin (NFR-10). Browsers send it automatically;
// in tests we act as the Vite dev origin, which the server accepts outside production.
const TEST_ORIGIN = 'http://localhost:3000';
const post = (url: string) => request(app).post(url).set('Origin', TEST_ORIGIN);

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
    const res = await post('/api/v1/auth/login').send({ email: 'ALICE@Example.test', password: TEST_PASSWORD });

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
    const resUnknown = await post('/api/v1/auth/login').send({ email: 'ghost@example.test', password: TEST_PASSWORD });

    // 2. Wrong password
    const resWrongPass = await post('/api/v1/auth/login').send({ email: 'alice@example.test', password: 'not-the-password' });

    // Disable Bob
    await prisma.user.update({
      where: { id: seededUsers.bob.id },
      data: { isActive: false },
    });

    // 3. Disabled user
    const resDisabled = await post('/api/v1/auth/login').send({ email: 'bob@example.test', password: TEST_PASSWORD });

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
    const resEmpty = await post('/api/v1/auth/login').send({});
    expect(resEmpty.status).toBe(400);
    expect(resEmpty.body.error.code).toBe('VALIDATION_ERROR');

    const resBadMail = await post('/api/v1/auth/login').send({ email: 'not-an-email', password: '123' });
    expect(resBadMail.status).toBe(400);
    expect(resBadMail.body.error.details.some((d: any) => d.field === 'email')).toBe(true);

    const resEmptyPass = await post('/api/v1/auth/login').send({ email: 'alice@example.test', password: '' });
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

  it('TEST-01.5 (AC-01.5): POST /auth/logout returns 204, clears the cookie with Max-Age=0, deletes the session, and invalidates the old cookie', async () => {
    const token = await createTestSession(seededUsers.alice.id);

    const resLogout = await post('/api/v1/auth/logout').set('Cookie', [`sid=${token}`]);

    expect(resLogout.status).toBe(204);
    const cleared = resLogout.headers['set-cookie'][0];
    expect(cleared).toMatch(/^sid=;/);
    expect(cleared).toContain('Max-Age=0');
    expect(cleared).toContain('Path=/');
    expect(cleared).toContain('HttpOnly');
    expect(cleared).toContain('SameSite=Lax');

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

  it('TEST-01.7 (AC-01.7): Every registered protected route returns 401 to anonymous requests; an undeclared route halts app creation', async () => {
    // 1. Iterate the route table the server actually mounted (NFR-02 route-list test).
    const routes = getDeclaredRoutes(app);
    expect(routes).toEqual(
      expect.arrayContaining([
        { method: 'GET', path: '/api/v1/health', access: 'public' },
        { method: 'POST', path: '/api/v1/auth/login', access: 'public' },
        { method: 'POST', path: '/api/v1/auth/logout', access: 'authenticated' },
        { method: 'GET', path: '/api/v1/auth/me', access: 'authenticated' },
      ])
    );

    const protectedRoutes = routes.filter((r) => r.access !== 'public');
    expect(protectedRoutes.length).toBeGreaterThan(0);
    for (const route of protectedRoutes) {
      const url = route.path.replace(/:[^/]+/g, '00000000-0000-0000-0000-000000000000');
      const method = route.method.toLowerCase() as 'get' | 'post' | 'patch' | 'put' | 'delete';
      const res = await request(app)[method](url).set('Origin', TEST_ORIGIN);
      expect(res.status, `${route.method} ${route.path}`).toBe(401);
      expect(res.body, `${route.method} ${route.path}`).toEqual({
        error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
      });
    }

    // 2. A route mounted without access(...) makes the startup assertion throw.
    const rogueApp = express();
    const rogueRouter = express.Router();
    rogueRouter.get('/leak', (_req, res) => {
      res.json({ secret: true });
    });
    mountRouter(rogueApp, '/api/v1/rogue', rogueRouter);
    expect(() => assertRoutesGuarded(rogueApp)).toThrow(/\[NFR-02 Violation\].*GET \/api\/v1\/rogue\/leak/);

    // 3. The guard must be the FIRST handler: a handler running before it is still a violation.
    const lateGuardApp = express();
    const lateGuardRouter = express.Router();
    lateGuardRouter.get('/late', (_req, _res, next) => next(), access('USER'), (_req, res) => {
      res.json({});
    });
    mountRouter(lateGuardApp, '/api/v1/late', lateGuardRouter);
    expect(() => assertRoutesGuarded(lateGuardApp)).toThrow('[NFR-02 Violation]');

    // 4. A router mounted outside mountRouter() cannot be verified and is rejected too.
    const unmountedApp = express();
    unmountedApp.use('/api/v1/x', express.Router().get('/y', access('public'), (_req, res) => {
      res.json({});
    }));
    expect(() => assertRoutesGuarded(unmountedApp)).toThrow('[NFR-02 Violation]');
  });

  // Sprint 1 placeholder (contract f-01 v1.1): /api/v1/test/* fixture routes stand in for the
  // User-only (/accounts, F-03) and Admin-only (/admin/users, F-02) endpoints until those exist.
  it('TEST-01.8 (AC-01.8): Role separation denies non-permitted roles with 403 FORBIDDEN', async () => {
    const userToken = await createTestSession(seededUsers.alice.id);
    const adminToken = await createTestSession(seededUsers.admin.id);

    // User calling ADMIN-only route -> 403
    const resUserToAdmin = await request(app)
      .get('/api/v1/test/admin-only')
      .set('Cookie', [`sid=${userToken}`]);
    expect(resUserToAdmin.status).toBe(403);
    expect(resUserToAdmin.body).toEqual({
      error: { code: 'FORBIDDEN', message: 'You do not have permission to access this resource' },
    });

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

  // TEST-01.9 / AC-01.9 (cross-user record → 404) is verified by TEST-07.4 per contract f-01 v1.1:
  // no financial record exists until F-05, so the check moved to F-07 (Transaction History).

  it('TEST-01.10 (AC-01.10): Passwords in database are valid bcrypt hashes with cost >= 12; no plaintext in storage', async () => {
    const user = await prisma.user.findUnique({
      where: { email: 'alice@example.test' },
    });
    expect(user?.passwordHash).toMatch(/^\$2[aby]\$1[2-9]\$/);
    expect(user?.passwordHash).not.toContain(TEST_PASSWORD);
  });

  it('TEST-01.11 (AC-01.11): A forced internal exception returns a sanitized 500 INTERNAL_ERROR with X-Request-Id and no stack trace, SQL, or file paths', async () => {
    const res = await request(app).get('/api/v1/test/crash');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected internal error occurred. Please contact support.',
      },
    });
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);

    const raw = res.text;
    for (const leak of ['SELECT', 'sessions', 'prisma', 'relation', '.ts:', 'C:\\', 'node_modules', '    at ', 'Error:']) {
      expect(raw, `response leaks "${leak}"`).not.toContain(leak);
    }
  });

  it('TEST-01.12 (AC-01.12): Rate limiting blocks 11th failed login attempt within 15 mins with 429 RATE_LIMITED', async () => {
    // 10 failed login attempts for Alice
    for (let i = 0; i < 10; i++) {
      const res = await post('/api/v1/auth/login').send({ email: 'alice@example.test', password: 'not-the-password' });
      expect(res.status).toBe(401);
    }

    // 11th attempt (even with correct password) must return 429
    const res11th = await post('/api/v1/auth/login').send({ email: 'alice@example.test', password: TEST_PASSWORD });
    expect(res11th.status).toBe(429);
    expect(res11th.body.error.code).toBe('RATE_LIMITED');

    // Bob has an independent quota (same IP, different email): his wrong-password attempt is
    // evaluated normally (401, as the STS specifies) rather than blocked with 429...
    const resBobWrong = await post('/api/v1/auth/login').send({ email: 'bob@example.test', password: 'not-the-password' });
    expect(resBobWrong.status).toBe(401);
    expect(resBobWrong.body.error.code).toBe('INVALID_CREDENTIALS');

    // ...and he can still log in successfully.
    const resBob = await post('/api/v1/auth/login').send({ email: 'bob@example.test', password: TEST_PASSWORD });
    expect(resBob.status).toBe(200);
  });

  // Sprint 1 placeholder (contract f-01 v1.1): exercised on /auth/logout and /auth/login until
  // POST /transactions exists (F-05), where the same guard applies unchanged.
  it('TEST-01.13 (AC-01.13): Missing or mismatched Origin returns 403; non-JSON or missing Content-Type on a body returns 415; nothing changes', async () => {
    const token = await createTestSession(seededUsers.alice.id);
    const aliceSessions = () => prisma.session.count({ where: { userId: seededUsers.alice.id } });

    // CSRF: mismatched Origin
    const resOrigin = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', [`sid=${token}`])
      .set('Origin', 'https://malicious-attacker.test');
    expect(resOrigin.status).toBe(403);
    expect(resOrigin.body.error.code).toBe('FORBIDDEN');

    // CSRF: missing Origin
    const resNoOrigin = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', [`sid=${token}`]);
    expect(resNoOrigin.status).toBe(403);
    expect(resNoOrigin.body.error.code).toBe('FORBIDDEN');

    // Neither rejected logout touched the session.
    expect(await aliceSessions()).toBe(1);

    // Non-JSON Content-Type
    const resNonJson = await post('/api/v1/auth/login')
      .set('Content-Type', 'text/plain')
      .send(`{"email":"alice@example.test","password":"${TEST_PASSWORD}"}`);
    expect(resNonJson.status).toBe(415);
    expect(resNonJson.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');

    // Body without any Content-Type
    const resNoType = await post('/api/v1/auth/login')
      .unset('Content-Type')
      .send(Buffer.from(`{"email":"alice@example.test","password":"${TEST_PASSWORD}"}`));
    expect(resNoType.status).toBe(415);
    expect(resNoType.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');

    // The rejected logins created no session.
    expect(await aliceSessions()).toBe(1);
  });

  it('authService.getMe: returns user profile or throws 404 for non-existent user', async () => {
    const me = await authService.getMe(seededUsers.alice.id);
    expect(me.email).toBe('alice@example.test');

    await expect(authService.getMe('00000000-0000-0000-0000-000000000000')).rejects.toThrow();
  });
});

describe('Deployment configuration (system-sds §1, §8)', () => {
  it('Test-only fixture routes are not mounted outside NODE_ENV=test', async () => {
    const prodLikeApp = createApp({ enableTestRoutes: false, webDistDir: null });

    expect(getDeclaredRoutes(prodLikeApp).some((r) => r.path.startsWith('/api/v1/test'))).toBe(false);
    for (const url of ['/api/v1/test/admin-only', '/api/v1/test/user-only', '/api/v1/test/crash']) {
      const res = await request(prodLikeApp).get(url);
      expect(res.status, url).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    }
  });

  it('Serves the built web app with an index.html fallback while unknown /api paths stay JSON 404', async () => {
    const distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pangtao-web-'));
    fs.writeFileSync(path.join(distDir, 'index.html'), '<!doctype html><div id="root"></div>');
    fs.mkdirSync(path.join(distDir, 'assets'));
    fs.writeFileSync(path.join(distDir, 'assets', 'app.js'), 'console.log(1);');

    try {
      const webApp = createApp({ enableTestRoutes: false, webDistDir: distDir });

      const root = await request(webApp).get('/');
      expect(root.status).toBe(200);
      expect(root.text).toContain('<div id="root">');

      const deepLink = await request(webApp).get('/transactions/123');
      expect(deepLink.status).toBe(200);
      expect(deepLink.text).toContain('<div id="root">');

      const asset = await request(webApp).get('/assets/app.js');
      expect(asset.status).toBe(200);
      expect(asset.text).toContain('console.log(1)');

      const unknownApi = await request(webApp).get('/api/v1/does-not-exist');
      expect(unknownApi.status).toBe(404);
      expect(unknownApi.body.error.code).toBe('NOT_FOUND');

      const health = await request(webApp).get('/api/v1/health');
      expect(health.body.status).toBe('ok');
    } finally {
      fs.rmSync(distDir, { recursive: true, force: true });
    }
  });
});
