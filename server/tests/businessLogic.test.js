process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../index');
const db = require('../db/database');
const seed = require('../db/seed');

describe('TaskFlow Phase 4 — Business Logic Hardening Test Suite', () => {
  let managerToken;
  let leaderEngToken;
  let empEng1Token;
  let empEng2Token;
  let empProd1Token;

  beforeEach(async () => {
    await seed();

    const mgrRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sarah.jenkins@taskflow.io', password: 'password123' });
    managerToken = mgrRes.body.accessToken;

    const ldrEngRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alex.rivera@taskflow.io', password: 'password123' });
    leaderEngToken = ldrEngRes.body.accessToken;

    const empEng1Res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'david.kim@taskflow.io', password: 'password123' });
    empEng1Token = empEng1Res.body.accessToken;

    const empEng2Res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'elena.rostova@taskflow.io', password: 'password123' });
    empEng2Token = empEng2Res.body.accessToken;

    const empProd1Res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'marcus.vance@taskflow.io', password: 'password123' });
    empProd1Token = empProd1Res.body.accessToken;
  });

  describe('1. Task State Transitions', () => {
    test('Valid status transitions PENDING -> IN_PROGRESS -> COMPLETED succeed', async () => {
      const res1 = await request(app)
        .put('/api/tasks/task-104/status')
        .set('Authorization', `Bearer ${empEng2Token}`)
        .send({ status: 'IN_PROGRESS' });
      expect(res1.status).toBe(200);

      const res2 = await request(app)
        .put('/api/tasks/task-104/status')
        .set('Authorization', `Bearer ${empEng2Token}`)
        .send({ status: 'COMPLETED' });
      expect(res2.status).toBe(200);
      expect(res2.body.task.status).toBe('COMPLETED');
    });

    test('Reopening a COMPLETED task to IN_PROGRESS succeeds', async () => {
      const res = await request(app)
        .put('/api/tasks/task-104/status')
        .set('Authorization', `Bearer ${empEng2Token}`)
        .send({ status: 'IN_PROGRESS' });
      expect(res.status).toBe(200);
      expect(res.body.task.status).toBe('IN_PROGRESS');
    });

    test('Direct invalid transition COMPLETED -> PENDING is rejected with 400', async () => {
      await request(app)
        .put('/api/tasks/task-104/status')
        .set('Authorization', `Bearer ${empEng2Token}`)
        .send({ status: 'COMPLETED' });

      const res = await request(app)
        .put('/api/tasks/task-104/status')
        .set('Authorization', `Bearer ${empEng2Token}`)
        .send({ status: 'PENDING' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid status transition');
    });

    test('Arbitrary invalid status string is rejected with 400', async () => {
      const res = await request(app)
        .put('/api/tasks/task-104/status')
        .set('Authorization', `Bearer ${empEng2Token}`)
        .send({ status: 'SUPER_COMPLETED' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid status value');
    });
  });

  describe('2. Approval Workflow Hardening', () => {
    test('Leader approval attempt is rejected with 403', async () => {
      const res = await request(app)
        .post('/api/approvals/task-102/approve')
        .set('Authorization', `Bearer ${leaderEngToken}`);

      expect(res.status).toBe(403);
    });

    test('Employee approval attempt is rejected with 403', async () => {
      const res = await request(app)
        .post('/api/approvals/task-102/approve')
        .set('Authorization', `Bearer ${empEng1Token}`);

      expect(res.status).toBe(403);
    });

    test('Rejection without a valid reason is denied with 400', async () => {
      const res = await request(app)
        .post('/api/approvals/task-102/reject')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ rejectionReason: '    ' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('rejection reason');
    });

    test('Manager can approve pending task', async () => {
      const res = await request(app)
        .post('/api/approvals/task-102/approve')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.task.approvalStatus).toBe('APPROVED');
    });

    test('Double approval on an already APPROVED task is rejected with 400', async () => {
      await request(app)
        .post('/api/approvals/task-102/approve')
        .set('Authorization', `Bearer ${managerToken}`);

      const res = await request(app)
        .post('/api/approvals/task-102/approve')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('is not pending approval');
    });

    test('Resubmitting a REJECTED task resets status to PENDING_APPROVAL and clears rejectionReason', async () => {
      const res = await request(app)
        .put('/api/tasks/task-105')
        .set('Authorization', `Bearer ${leaderEngToken}`)
        .send({ title: 'Refactor Legacy Analytics SQL Queries (Phase 4 Revision)' });

      expect(res.status).toBe(200);
      expect(res.body.task.approvalStatus).toBe('PENDING_APPROVAL');
      expect(res.body.task.rejectionReason).toBeNull();
    });
  });

  describe('3. Task Assignment Consistency & Cross-Team Protection', () => {
    test('Leader assigning task outside their team is rejected with 403', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${leaderEngToken}`)
        .send({
          title: 'Cross Team Assignment Attempt',
          priority: 'HIGH',
          assignedTo: 'u-emp-prod1',
          dueDate: '2026-12-31'
        });

      expect(res.status).toBe(403);
    });

    test('Manager assigning employee to a mismatched team is rejected with 400', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          title: 'Mismatched Team Assignment',
          priority: 'HIGH',
          assignedTo: 'u-emp-eng1',
          teamId: 'team-prod',
          dueDate: '2026-12-31'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Assigned user must belong to the specified team');
    });

    test('Manager assigning non-existent user returns 404', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          title: 'Ghost User Assignment',
          priority: 'LOW',
          assignedTo: 'u-ghost-999',
          dueDate: '2026-12-31'
        });

      expect(res.status).toBe(404);
    });

    test('Creating task with past due date is rejected with 400', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          title: 'Past Due Task',
          priority: 'HIGH',
          assignedTo: 'u-emp-eng1',
          dueDate: '2020-01-01'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Due date cannot be in the past');
    });

    test('Creating task with invalid date string is rejected with 400', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          title: 'Invalid Date Format Task',
          priority: 'HIGH',
          assignedTo: 'u-emp-eng1',
          dueDate: 'not-a-valid-date'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid due date format');
    });
  });

  describe('4. Pagination & Query Parameter Hardening', () => {
    test('Tasks endpoint supports page & limit pagination parameters', async () => {
      const res = await request(app)
        .get('/api/tasks?page=1&limit=2')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('tasks');
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.tasks.length).toBe(2);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.pageSize).toBe(2);
    });

    test('Search filter properly scopes results by title or description', async () => {
      const res = await request(app)
        .get('/api/tasks?search=Security')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      const list = res.body.tasks || res.body;
      expect(list.length).toBeGreaterThan(0);
      expect(list[0].title).toContain('Security');
    });

    test('Priority filter properly filters task list', async () => {
      const res = await request(app)
        .get('/api/tasks?priority=HIGH')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      const list = res.body.tasks || res.body;
      expect(list.every(t => t.priority === 'HIGH')).toBe(true);
    });
  });
});
