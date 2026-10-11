const request = require('supertest');
const app = require('../index');
const db = require('../db/database');
const config = require('../config');
const seed = require('../db/seed');

describe('Public Registration API (POST /api/auth/register)', () => {
  beforeEach(async () => {
    await seed();
  });

  const validRegistration = {
    name: 'New Registered User',
    email: 'new.user@taskflow.io',
    password: 'securePassword123'
  };

  test('1. Successful registration creates EMPLOYEE account and returns session tokens', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(validRegistration);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.email).toBe('new.user@taskflow.io');
    expect(res.body.user.name).toBe('New Registered User');
    expect(res.body.user.role).toBe('EMPLOYEE');
    expect(res.body.user.teamId).toBeNull();
    expect(res.body.user.passwordHash).toBeUndefined();

    // Verify refresh cookie set
    const cookies = res.headers['set-cookie'];
    expect(cookies.some(c => c.startsWith(`${config.AUTH_REFRESH_COOKIE}=`))).toBe(true);
  });

  test('2. Email is normalized to lowercase and trimmed', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: ' Normalized User ',
        email: '  NORMALIZED.USER@taskflow.io ',
        password: 'securePassword123'
      });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('normalized.user@taskflow.io');
    expect(res.body.user.name).toBe('Normalized User');
  });

  test('3. Duplicate email registration is rejected with HTTP 409', async () => {
    // Attempt duplicate registration for Sarah (already in seed)
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Sarah Duplicate',
        email: 'sarah.jenkins@taskflow.io',
        password: 'securePassword123'
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('already exists');
  });

  test('4. Weak or short password (< 8 chars) is rejected with HTTP 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Weak Password User',
        email: 'weak.user@taskflow.io',
        password: 'short'
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid input data');
    expect(res.body.details).toContain('8 characters');
  });

  test('5. Missing required fields are rejected with HTTP 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'missing.name@taskflow.io'
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid input data');
  });

  test('6. Attempts to register as MANAGER or LEADER are strictly forced to EMPLOYEE', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Hacker User',
        email: 'hacker.role@taskflow.io',
        password: 'securePassword123',
        role: 'MANAGER' // Client attempts role escalation
      });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('EMPLOYEE'); // Forced on server
  });

  test('7. Attempts to supply teamId or companyId are strictly forced to null', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Team Forger',
        email: 'team.forger@taskflow.io',
        password: 'securePassword123',
        teamId: 'team-prod',
        companyId: 'comp-override'
      });

    expect(res.status).toBe(201);
    expect(res.body.user.teamId).toBeNull(); // Forced to null
    expect(res.body.user.companyId).toBeNull();
  });

  test('8. Password hashes are stored securely and never returned in responses', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Secure Storage User',
        email: 'secure.storage@taskflow.io',
        password: 'securePassword123'
      });

    expect(res.status).toBe(201);
    expect(res.body.user.passwordHash).toBeUndefined();

    // Check DB record directly to verify Argon2id hash stored
    const dbUser = db.findOne('users', u => u.email === 'secure.storage@taskflow.io');
    expect(dbUser).toBeDefined();
    expect(dbUser.passwordHash).toBeDefined();
    expect(dbUser.passwordHash).not.toBe('securePassword123');
    expect(dbUser.passwordHash).toContain('$argon2id$');
  });

  test('9. Newly registered user cannot access other users tasks or privileged endpoints', async () => {
    // 1. Register new user
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Unassigned User',
        email: 'unassigned.user@taskflow.io',
        password: 'securePassword123'
      });

    const token = regRes.body.accessToken;

    // 2. Attempt to view tasks (should return empty list since user has 0 assigned tasks)
    const tasksRes = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${token}`);

    expect(tasksRes.status).toBe(200);
    expect(tasksRes.body).toEqual([]);

    // 3. Attempt to access privileged manager endpoint (should fail 403)
    const promoteRes = await request(app)
      .put('/api/users/u-emp-eng1/team')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'MANAGER' });

    expect(promoteRes.status).toBe(403);
  });
});
