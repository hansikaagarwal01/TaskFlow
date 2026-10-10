process.env.NODE_ENV = 'test';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../index');
const db = require('../db/database');
const config = require('../config');
const seed = require('../db/seed');

describe('TaskFlow Authentication & Security Suite (Phase 1)', () => {
  beforeAll(async () => {
    await seed();
  });

  const validCredentials = {
    email: 'sarah.jenkins@taskflow.io',
    password: 'password123'
  };

  describe('1. Login Endpoint (POST /api/auth/login)', () => {
    test('Successful login returns accessToken, safe user info, and sets HttpOnly refresh cookie', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send(validCredentials);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe(validCredentials.email);

      // Password hash and token hash must NOT be in body
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(res.body.user.tokenHash).toBeUndefined();
      expect(res.body.refreshToken).toBeUndefined();

      // Check cookie
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const refreshCookie = cookies.find(c => c.startsWith(`${config.AUTH_REFRESH_COOKIE}=`));
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toContain('HttpOnly');
    });

    test('Invalid password returns generic 401 without revealing password mistake', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: validCredentials.email, password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid email or password.');
    });

    test('Invalid email returns generic 401 without revealing account absence', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@taskflow.io', password: 'password123' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid email or password.');
    });

    test('Missing credentials returns 400 validation error', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid input data');
    });
  });

  describe('2. Access Token Authentication', () => {
    let accessToken;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send(validCredentials);
      accessToken = res.body.accessToken;
    });

    test('Access token allows access to GET /api/auth/me', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(validCredentials.email);
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    test('Protected endpoint rejects request without Authorization header', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Authentication required');
    });

    test('Protected endpoint rejects malformed token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.jwt.string');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid or expired authentication');
    });

    test('Protected endpoint rejects expired access token', async () => {
      const expiredToken = jwt.sign(
        { sub: 'u-mgr-1', role: 'MANAGER', type: 'access' },
        config.JWT_ACCESS_SECRET,
        { expiresIn: '-1s' }
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid or expired authentication');
    });
  });

  describe('3. Refresh Token & Session Management', () => {
    let refreshCookie;
    let accessToken;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send(validCredentials);
      
      const cookies = res.headers['set-cookie'];
      refreshCookie = cookies ? cookies.find(c => c.startsWith(`${config.AUTH_REFRESH_COOKIE}=`)) : null;
      accessToken = res.body.accessToken;
    });

    test('Refresh endpoint issues new access token and rotates refresh cookie', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [refreshCookie]);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');

      // Verify new cookie returned and is different from original refreshCookie
      const newCookies = res.headers['set-cookie'];
      const newRefreshCookie = newCookies.find(c => c.startsWith(`${config.AUTH_REFRESH_COOKIE}=`));
      expect(newRefreshCookie).toBeDefined();
      expect(newRefreshCookie).not.toBe(refreshCookie);
    });

    test('Missing refresh cookie returns 401', async () => {
      const res = await request(app).post('/api/auth/refresh');
      expect(res.status).toBe(401);
    });

    test('Rotated old refresh token fails and revokes all user sessions (reuse detection)', async () => {
      // 1. Perform refresh to rotate token
      const refreshRes = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [refreshCookie]);
      expect(refreshRes.status).toBe(200);

      // 2. Try to present the OLD refreshCookie again
      const reuseRes = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [refreshCookie]);
      expect(reuseRes.status).toBe(401);

      // 3. Verify that the NEW refresh token (from step 1) is now also revoked due to reuse detection
      const newCookie = refreshRes.headers['set-cookie'].find(c => c.startsWith(`${config.AUTH_REFRESH_COOKIE}=`));
      const subsequentRes = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [newCookie]);
      expect(subsequentRes.status).toBe(401);
    });
  });

  describe('4. Logout and Session Invalidation', () => {
    test('Logout clears refresh cookie and revokes session', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send(validCredentials);
      const refreshCookie = loginRes.headers['set-cookie'].find(c => c.startsWith(`${config.AUTH_REFRESH_COOKIE}=`));

      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', [refreshCookie]);

      expect(logoutRes.status).toBe(200);

      // Confirm cookie is cleared
      const logoutCookies = logoutRes.headers['set-cookie'];
      expect(logoutCookies.some(c => c.includes(`${config.AUTH_REFRESH_COOKIE}=;`))).toBe(true);

      // Refreshing with cleared cookie fails
      const refreshRes = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [refreshCookie]);
      expect(refreshRes.status).toBe(401);
    });

    test('Logout-all revokes all sessions for the authenticated user', async () => {
      const login1 = await request(app).post('/api/auth/login').send(validCredentials);
      expect(login1.status).toBe(200);
      const token1 = login1.body.accessToken;

      const login2 = await request(app).post('/api/auth/login').send(validCredentials);
      expect(login2.status).toBe(200);
      const cookie2 = login2.headers['set-cookie'].find(c => c.startsWith(`${config.AUTH_REFRESH_COOKIE}=`));

      // Call logout-all using token1
      const logoutAllRes = await request(app)
        .post('/api/auth/logout-all')
        .set('Authorization', `Bearer ${token1}`);

      expect(logoutAllRes.status).toBe(200);

      // Refresh using cookie2 should now fail
      const refreshRes = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [cookie2]);
      expect(refreshRes.status).toBe(401);
    });
  });

  describe('5. Session Management Endpoints', () => {
    let accessToken;
    let refreshCookie;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send(validCredentials);
      accessToken = res.body.accessToken;
      const cookies = res.headers['set-cookie'];
      refreshCookie = cookies ? cookies.find(c => c.startsWith(`${config.AUTH_REFRESH_COOKIE}=`)) : null;
    });

    test('GET /api/auth/sessions returns active user sessions without token hashes', async () => {
      const res = await request(app)
        .get('/api/auth/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', [refreshCookie]);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      
      const session = res.body[0];
      expect(session).toHaveProperty('id');
      expect(session.tokenHash).toBeUndefined();
    });

    test('User can revoke their own session', async () => {
      const sessionsRes = await request(app)
        .get('/api/auth/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', [refreshCookie]);
      
      const targetSessionId = sessionsRes.body[0].id;

      const deleteRes = await request(app)
        .delete(`/api/auth/sessions/${targetSessionId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(deleteRes.status).toBe(200);
    });

    test('User cannot revoke another user session', async () => {
      // Login as leader user
      const leaderLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: 'alex.rivera@taskflow.io', password: 'password123' });
      expect(leaderLogin.status).toBe(200);
      const leaderToken = leaderLogin.body.accessToken;

      // Get Sarah's session ID
      const sarahSessions = await request(app)
        .get('/api/auth/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', [refreshCookie]);
      const sarahSessionId = sarahSessions.body[0].id;

      // Leader attempts to delete Sarah's session
      const deleteRes = await request(app)
        .delete(`/api/auth/sessions/${sarahSessionId}`)
        .set('Authorization', `Bearer ${leaderToken}`);

      expect(deleteRes.status).toBe(403);
    });
  });

  describe('6. Security Headers & CORS', () => {
    test('Helmet headers are present on responses', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    });
  });
});
