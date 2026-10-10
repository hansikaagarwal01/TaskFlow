process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../index');
const db = require('../db/database');
const seedDatabase = require('../db/seed');

describe('TaskFlow Phase 7 — Comprehensive Full-Stack Hardening Suite', () => {

  let managerToken, leaderEngToken, leaderProdToken, empEng1Token, empEng2Token;

  beforeAll(async () => {
    await seedDatabase();

    // Login Manager (sarah.jenkins@taskflow.io)
    const mgrRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sarah.jenkins@taskflow.io', password: 'password123' });
    managerToken = mgrRes.body.accessToken;

    // Login Engineering Leader (alex.rivera@taskflow.io)
    const ldrEngRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alex.rivera@taskflow.io', password: 'password123' });
    leaderEngToken = ldrEngRes.body.accessToken;

    // Login Product Leader (maya.lin@taskflow.io)
    const ldrProdRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'maya.lin@taskflow.io', password: 'password123' });
    leaderProdToken = ldrProdRes.body.accessToken;

    // Login Engineering Employee 1 (david.kim@taskflow.io - id: u-emp-eng1)
    const emp1Res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'david.kim@taskflow.io', password: 'password123' });
    empEng1Token = emp1Res.body.accessToken;

    // Login Engineering Employee 2 (elena.rostova@taskflow.io - id: u-emp-eng2)
    const emp2Res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'elena.rostova@taskflow.io', password: 'password123' });
    empEng2Token = emp2Res.body.accessToken;
  });

  // ==========================================
  // SECTION 1: AUTHENTICATION HARDENING
  // ==========================================
  describe('1. Authentication Edge Cases & Generic Error Security', () => {
    test('Login with malformed email format returns 400', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'notanemail', password: 'password123' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    test('Login with missing fields returns 400', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'sarah.jenkins@taskflow.io' });
      expect(res.status).toBe(400);
    });

    test('Login with non-existent email returns generic 401 error', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@taskflow.io', password: 'password123' });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid email or password.');
    });

    test('Login with wrong password returns identical generic 401 error', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'sarah.jenkins@taskflow.io', password: 'WrongPassword!' });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid email or password.');
    });

    test('Login sets HttpOnly cookie for refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'david.kim@taskflow.io', password: 'password123' });
      expect(res.status).toBe(200);
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some(c => c.includes('HttpOnly'))).toBe(true);
    });
  });

  // ==========================================
  // SECTION 2: RBAC & IDOR EXPLICIT HARDENING
  // ==========================================
  describe('2. RBAC & IDOR Explicit Parameter Forgery', () => {
    test('Leader attempting cross-team AI workload analysis is rejected with 403', async () => {
      // alex.rivera (leaderEng) belongs to team-eng, marcus.vance (u-emp-prod1) belongs to team-prod
      const res = await request(app)
        .get('/api/ai/workload/u-emp-prod1')
        .set('Authorization', 'Bearer ' + leaderEngToken);
      expect(res.status).toBe(403);
    });

    test('Leader attempting cross-team task risk analysis is rejected with 403', async () => {
      // task-103 belongs to team-prod
      const res = await request(app)
        .get('/api/ai/task-risk/task-103')
        .set('Authorization', 'Bearer ' + leaderEngToken);
      expect(res.status).toBe(403);
    });

    test('Employee attempting to view another employee task risk analysis is rejected with 403', async () => {
      // task-103 is assigned to u-emp-prod1, emp1 is u-emp-eng1
      const res = await request(app)
        .get('/api/ai/task-risk/task-103')
        .set('Authorization', 'Bearer ' + empEng1Token);
      expect(res.status).toBe(403);
    });

    test('POST /api/ai/rebalance rejects Leader cross-team rebalance attempt with 403', async () => {
      // leaderEng trying to rebalance task-103 (team-prod)
      const res = await request(app)
        .post('/api/ai/rebalance')
        .set('Authorization', 'Bearer ' + leaderEngToken)
        .send({ taskId: 'task-103', newAssigneeId: 'u-emp-eng1' });
      expect(res.status).toBe(403);
    });

    test('POST /api/ai/rebalance rejects Leader reassigning to employee outside their team with 403', async () => {
      // leaderEng reassigning task-101 (team-eng) to u-emp-prod1 (team-prod)
      const res = await request(app)
        .post('/api/ai/rebalance')
        .set('Authorization', 'Bearer ' + leaderEngToken)
        .send({ taskId: 'task-101', newAssigneeId: 'u-emp-prod1' });
      expect(res.status).toBe(403);
    });

    test('Manager CAN execute POST /api/ai/rebalance across any team', async () => {
      const res = await request(app)
        .post('/api/ai/rebalance')
        .set('Authorization', 'Bearer ' + managerToken)
        .send({ taskId: 'task-101', newAssigneeId: 'u-emp-eng2' });
      expect(res.status).toBe(200);
      expect(res.body.task.assignedTo).toBe('u-emp-eng2');
    });

    test('Employee attempting POST /api/ai/rebalance is rejected with 403', async () => {
      const res = await request(app)
        .post('/api/ai/rebalance')
        .set('Authorization', 'Bearer ' + empEng1Token)
        .send({ taskId: 'task-101', newAssigneeId: 'u-emp-eng1' });
      expect(res.status).toBe(403);
    });
  });

  // ==========================================
  // SECTION 3: TASK LIFECYCLE & EDGE CASES
  // ==========================================
  describe('3. Task Lifecycle & Validation Edge Cases', () => {
    test('Task creation with past due date returns 400', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', 'Bearer ' + managerToken)
        .send({
          title: 'Past Due Task',
          assignedTo: 'u-emp-eng1',
          priority: 'HIGH',
          dueDate: '2020-01-01T00:00:00.000Z'
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/due date/i);
    });

    test('Updating COMPLETED task directly to PENDING returns 400', async () => {
      // Set task-101 status to COMPLETED first
      db.update('tasks', 'task-101', { status: 'COMPLETED', assignedTo: 'u-emp-eng1' });

      const res = await request(app)
        .put('/api/tasks/task-101/status')
        .set('Authorization', 'Bearer ' + empEng1Token)
        .send({ status: 'PENDING' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Completed tasks cannot be reset directly to pending');
    });

    test('Reopening COMPLETED task to IN_PROGRESS succeeds', async () => {
      const res = await request(app)
        .put('/api/tasks/task-101/status')
        .set('Authorization', 'Bearer ' + empEng1Token)
        .send({ status: 'IN_PROGRESS' });
      expect(res.status).toBe(200);
      expect(res.body.task.status).toBe('IN_PROGRESS');
    });
  });

  // ==========================================
  // SECTION 4: APPROVAL WORKFLOW EDGE CASES
  // ==========================================
  describe('4. Approval Workflow Edge Cases', () => {
    let pendingTaskId;

    beforeEach(async () => {
      // Leader creates a pending approval task
      const createRes = await request(app)
        .post('/api/tasks')
        .set('Authorization', 'Bearer ' + leaderEngToken)
        .send({
          title: 'Approval Edge Case Task',
          description: 'Testing approval workflow edge cases',
          assignedTo: 'u-emp-eng1',
          priority: 'MEDIUM',
          dueDate: '2028-12-31T00:00:00.000Z'
        });
      pendingTaskId = createRes.body.task.id;
    });

    test('Manager rejecting without reason returns 400', async () => {
      const res = await request(app)
        .post('/api/approvals/' + pendingTaskId + '/reject')
        .set('Authorization', 'Bearer ' + managerToken)
        .send({ rejectionReason: '   ' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('rejection reason');
    });

    test('Manager approves task and subsequent double approval returns 400', async () => {
      const approveRes = await request(app)
        .post('/api/approvals/' + pendingTaskId + '/approve')
        .set('Authorization', 'Bearer ' + managerToken);
      expect(approveRes.status).toBe(200);

      const doubleRes = await request(app)
        .post('/api/approvals/' + pendingTaskId + '/approve')
        .set('Authorization', 'Bearer ' + managerToken);
      expect(doubleRes.status).toBe(400);
      expect(doubleRes.body.error).toContain('not pending approval');
    });

    test('Manager rejects task and subsequent double rejection returns 400', async () => {
      const rejectRes = await request(app)
        .post('/api/approvals/' + pendingTaskId + '/reject')
        .set('Authorization', 'Bearer ' + managerToken)
        .send({ rejectionReason: 'Needs scope refinement.' });
      expect(rejectRes.status).toBe(200);

      const doubleRejectRes = await request(app)
        .post('/api/approvals/' + pendingTaskId + '/reject')
        .set('Authorization', 'Bearer ' + managerToken)
        .send({ rejectionReason: 'Another reason' });
      expect(doubleRejectRes.status).toBe(400);
    });

    test('Resubmitting rejected task resets approvalStatus to PENDING_APPROVAL and clears rejectionReason', async () => {
      // Reject first
      await request(app)
        .post('/api/approvals/' + pendingTaskId + '/reject')
        .set('Authorization', 'Bearer ' + managerToken)
        .send({ rejectionReason: 'Needs clearer requirements.' });

      // Resubmit by Leader edit
      const editRes = await request(app)
        .put('/api/tasks/' + pendingTaskId)
        .set('Authorization', 'Bearer ' + leaderEngToken)
        .send({ title: 'Revised Approval Task' });

      expect(editRes.status).toBe(200);
      expect(editRes.body.task.approvalStatus).toBe('PENDING_APPROVAL');
      expect(editRes.body.task.rejectionReason).toBeNull();
    });
  });

  // ==========================================
  // SECTION 5: NOTIFICATIONS & PAGINATION RESPONSE SHAPE
  // ==========================================
  describe('5. Notifications API & Response Shape Verification', () => {
    test('GET /api/notifications returns structured paginated response with notifications array and pagination metadata', async () => {
      const res = await request(app)
        .get('/api/notifications?page=1&limit=5')
        .set('Authorization', 'Bearer ' + empEng1Token);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('notifications');
      expect(res.body).toHaveProperty('pagination');
      expect(Array.isArray(res.body.notifications)).toBe(true);
      expect(res.body.pagination).toHaveProperty('page');
      expect(res.body.pagination).toHaveProperty('pageSize');
      expect(res.body.pagination).toHaveProperty('total');
    });

    test('IDOR attempt on notification PATCH /api/notifications/:id/read returns 404 or 403', async () => {
      // Insert a notification for emp2
      const notifId = 'notif-test-emp2-' + Date.now();
      db.insert('notifications', {
        id: notifId,
        userId: 'u-emp-eng2',
        title: 'Secret Notif',
        message: 'For Emp 2',
        type: 'SYSTEM',
        isRead: false,
        createdAt: new Date().toISOString()
      });

      // emp1 tries to mark emp2's notification as read
      const res = await request(app)
        .patch('/api/notifications/' + notifId + '/read')
        .set('Authorization', 'Bearer ' + empEng1Token);
      expect([403, 404]).toContain(res.status);
    });
  });

  // ==========================================
  // SECTION 6: API VALIDATION & 404 RESPONSES
  // ==========================================
  describe('6. API Validation & Safe Error Responses', () => {
    test('Non-existent endpoint returns 404 without stack trace', async () => {
      const res = await request(app)
        .get('/api/nonexistent-route-endpoint')
        .set('Authorization', 'Bearer ' + managerToken);
      expect(res.status).toBe(404);
      expect(JSON.stringify(res.body)).not.toContain('stack');
    });
  });

});
