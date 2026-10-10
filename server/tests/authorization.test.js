process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../index');
const db = require('../db/database');
const seed = require('../db/seed');

describe('TaskFlow Production Authorization & RBAC Test Suite (Phase 2)', () => {
  let managerToken;
  let leaderEngToken;
  let leaderProdToken;
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

    const ldrProdRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'maya.lin@taskflow.io', password: 'password123' });
    leaderProdToken = ldrProdRes.body.accessToken;

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

  describe('1. MANAGER Role Permissions', () => {
    test('Manager can access global organization tasks, teams, and users', async () => {
      const tasksRes = await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${managerToken}`);
      expect(tasksRes.status).toBe(200);
      expect((tasksRes.body.tasks || tasksRes.body).length).toBe(7);

      const teamsRes = await request(app)
        .get('/api/teams')
        .set('Authorization', `Bearer ${managerToken}`);
      expect(teamsRes.status).toBe(200);
      expect(teamsRes.body.length).toBe(2);

      const usersRes = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${managerToken}`);
      expect(usersRes.status).toBe(200);
      expect(usersRes.body.length).toBe(7);
    });

    test('Manager can create tasks directly without approval requirement', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          title: 'Direct Manager Assignment Task',
          description: 'High priority infrastructure fix',
          priority: 'HIGH',
          assignedTo: 'u-emp-eng1',
          teamId: 'team-eng',
          dueDate: '2026-12-31'
        });

      expect(res.status).toBe(201);
      expect(res.body.task.approvalStatus).toBe('NOT_REQUIRED');
      expect(res.body.task.status).toBe('PENDING');
    });

    test('Manager can approve pending leader-created task', async () => {
      const res = await request(app)
        .post('/api/approvals/task-102/approve')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.task.approvalStatus).toBe('APPROVED');
    });

    test('Manager can reject pending task with valid reason', async () => {
      const res = await request(app)
        .post('/api/approvals/task-102/reject')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ rejectionReason: 'Scope needs clarification' });

      expect(res.status).toBe(200);
      expect(res.body.task.approvalStatus).toBe('REJECTED');
    });
  });

  describe('2. LEADER Role Permissions & Boundaries', () => {
    test('Leader receives only tasks belonging to their assigned team', async () => {
      const res = await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${leaderEngToken}`);

      expect(res.status).toBe(200);
      const taskList = res.body.tasks || res.body;
      expect(taskList.every(t => t.teamId === 'team-eng')).toBe(true);
    });

    test('Leader cannot view details of task belonging to another team (returns 403)', async () => {
      const res = await request(app)
        .get('/api/tasks/task-103')
        .set('Authorization', `Bearer ${leaderEngToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Access denied');
    });

    test('Leader can create task for employee in their own team (requires approval)', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${leaderEngToken}`)
        .send({
          title: 'Team Internal Feature',
          description: 'Engineering work',
          priority: 'MEDIUM',
          assignedTo: 'u-emp-eng1',
          dueDate: '2026-12-31'
        });

      expect(res.status).toBe(201);
      expect(res.body.task.teamId).toBe('team-eng');
      expect(res.body.task.approvalStatus).toBe('PENDING_APPROVAL');
    });

    test('Leader CANNOT assign task to employee belonging to another team (returns 403)', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${leaderEngToken}`)
        .send({
          title: 'Cross-team Intrusion Task',
          description: 'Leader trying to assign to Product employee',
          priority: 'HIGH',
          assignedTo: 'u-emp-prod1',
          dueDate: '2026-12-31'
        });

      expect(res.status).toBe(403);
    });

    test('Leader CANNOT approve tasks (returns 403)', async () => {
      const res = await request(app)
        .post('/api/approvals/task-102/approve')
        .set('Authorization', `Bearer ${leaderEngToken}`);

      expect(res.status).toBe(403);
    });

    test('Leader CANNOT reject tasks (returns 403)', async () => {
      const res = await request(app)
        .post('/api/approvals/task-102/reject')
        .set('Authorization', `Bearer ${leaderEngToken}`)
        .send({ rejectionReason: 'Unauthorized rejection attempt' });

      expect(res.status).toBe(403);
    });

    test('Leader can edit a REJECTED task in their team and resubmit for approval', async () => {
      const res = await request(app)
        .put('/api/tasks/task-105')
        .set('Authorization', `Bearer ${leaderEngToken}`)
        .send({
          title: 'Refactor Legacy Analytics SQL Queries (Revised)',
          description: 'Clarified scope and memory footprint targets.'
        });

      expect(res.status).toBe(200);
      expect(res.body.task.approvalStatus).toBe('PENDING_APPROVAL');
      expect(res.body.task.rejectionReason).toBeNull();
    });
  });

  describe('3. EMPLOYEE Role Permissions & Scope Isolation', () => {
    test('Employee sees only tasks assigned to themselves', async () => {
      const res = await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${empEng1Token}`);

      expect(res.status).toBe(200);
      const taskList = res.body.tasks || res.body;
      expect(taskList.every(t => t.assignedTo === 'u-emp-eng1')).toBe(true);
    });

    test('Employee CANNOT view task assigned to another employee (returns 403)', async () => {
      const res = await request(app)
        .get('/api/tasks/task-101')
        .set('Authorization', `Bearer ${empEng1Token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Access denied');
    });

    test('Employee CANNOT create tasks (returns 403)', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${empEng1Token}`)
        .send({
          title: 'Unauthorized Employee Task',
          priority: 'LOW',
          assignedTo: 'u-emp-eng1',
          dueDate: '2026-12-31'
        });

      expect(res.status).toBe(403);
    });

    test('Employee CANNOT perform full task edits (returns 403)', async () => {
      const res = await request(app)
        .put('/api/tasks/task-102')
        .set('Authorization', `Bearer ${empEng1Token}`)
        .send({ title: 'Employee Modifying Title' });

      expect(res.status).toBe(403);
    });

    test('Employee CAN update status of task assigned to themselves', async () => {
      const res = await request(app)
        .put('/api/tasks/task-104/status')
        .set('Authorization', `Bearer ${empEng2Token}`)
        .send({ status: 'COMPLETED' });

      expect(res.status).toBe(200);
      expect(res.body.task.status).toBe('COMPLETED');
    });

    test('Employee CANNOT update status of task assigned to another employee (returns 403)', async () => {
      const res = await request(app)
        .put('/api/tasks/task-104/status')
        .set('Authorization', `Bearer ${empEng1Token}`)
        .send({ status: 'IN_PROGRESS' });

      expect(res.status).toBe(403);
    });
  });

  describe('4. IDOR & Parameter Forgery Prevention', () => {
    test('Leader specifying another teamId in task creation is forced to their own teamId', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${leaderEngToken}`)
        .send({
          title: 'Team Forgery Attempt Task',
          priority: 'LOW',
          assignedTo: 'u-emp-eng1',
          teamId: 'team-prod',
          dueDate: '2026-12-31'
        });

      expect(res.status).toBe(201);
      expect(res.body.task.teamId).toBe('team-eng');
    });

    test('Leader specifying approvalStatus="APPROVED" in body is forced to PENDING_APPROVAL', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${leaderEngToken}`)
        .send({
          title: 'Approval Bypass Attempt Task',
          priority: 'HIGH',
          assignedTo: 'u-emp-eng1',
          approvalStatus: 'APPROVED',
          dueDate: '2026-12-31'
        });

      expect(res.status).toBe(201);
      expect(res.body.task.approvalStatus).toBe('PENDING_APPROVAL');
    });

    test('Client specifying fake createdBy is overridden to authenticated user ID', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${leaderEngToken}`)
        .send({
          title: 'CreatedBy Forgery Attempt Task',
          priority: 'MEDIUM',
          assignedTo: 'u-emp-eng1',
          createdBy: 'u-mgr-1',
          dueDate: '2026-12-31'
        });

      expect(res.status).toBe(201);
      expect(res.body.task.createdBy).toBe('u-ldr-eng');
    });

    test('Non-manager attempting to promote themselves or change team via user endpoint fails (returns 403)', async () => {
      const res = await request(app)
        .put('/api/users/u-emp-eng1/team')
        .set('Authorization', `Bearer ${empEng1Token}`)
        .send({ role: 'MANAGER', teamId: 'team-prod' });

      expect(res.status).toBe(403);
    });

    test('Leader attempting to modify another team details fails (returns 403)', async () => {
      const res = await request(app)
        .put('/api/teams/team-prod')
        .set('Authorization', `Bearer ${leaderEngToken}`)
        .send({ name: 'Hijacked Team Name' });

      expect(res.status).toBe(403);
    });
  });
});
